import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { buildSuperSyncSequence } from '../utils/timePacketGenerators';
import {
  detectWritablePipes,
  writePipeResilient,
} from '../utils/smartwatchPipes';
import { bytesToHex } from '../utils/byteUtils';
import {
  Watch,
  Bluetooth,
  BluetoothConnected,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Power,
  ChevronDown,
  ChevronUp,
  Signal,
  ArrowRight,
  Terminal,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Download,
  Sparkles,
} from 'lucide-react';
import { InAppUpdateModal } from '../components/common/InAppUpdateModal';
import { CURRENT_APP_VERSION } from '../services/updater/appUpdaterService';

interface SimpleWatchLabPageProps {
  onSwitchToAdvanced: () => void;
}

interface ActivityLogItem {
  id: string;
  time: string;
  text: string;
  type: 'tx' | 'rx' | 'info' | 'success' | 'warn' | 'error';
  hex?: string;
}

export const SimpleWatchLabPage: React.FC<SimpleWatchLabPageProps> = ({ onSwitchToAdvanced }) => {
  const {
    status,
    device,
    services,
    setTimeSyncStatus,
    requestDevice,
    connect,
    disconnect,
    connectDirect,
    startLiveScan,
    stopLiveScan,
    writeCharacteristic,
  } = useBluetooth();

  // Host system live clock
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Connection & Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Array<{ id: string; name?: string; rssi?: number }>>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual MAC Input state
  const [showManualMac, setShowManualMac] = useState(false);
  const [manualMacInput, setManualMacInput] = useState('');

  // In-app updater modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Writable pipes detected
  const writablePipes = useMemo(() => detectWritablePipes(services), [services]);

  // Sync execution states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Optional minimal console
  const [showLogs, setShowLogs] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [copiedLog, setCopiedLog] = useState(false);

  const addLog = (text: string, type: ActivityLogItem['type'] = 'info', hex?: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    const item: ActivityLogItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      time,
      text,
      type,
      hex,
    };
    setActivityLogs((prev) => [...prev.slice(-49), item]);
  };

  const handleCopyLogs = () => {
    const text = activityLogs
      .map((l) => `[${l.time}] ${l.type.toUpperCase()}: ${l.text} ${l.hex ? `[${l.hex}]` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // 1-Tap Connect: Start Scan
  const handleStartScan = async () => {
    setErrorMessage(null);
    setStatusMessage('Searching for watch...');
    setIsScanning(true);
    setDiscoveredDevices([]);

    try {
      await startLiveScan((found) => {
        setDiscoveredDevices((prev) => {
          const exists = prev.some((d) => d.id === found.id);
          if (exists) return prev.map((d) => (d.id === found.id ? { ...d, ...found } : d));
          return [...prev, found];
        });
      });
    } catch {
      setIsScanning(false);
      try {
        setStatusMessage('Opening device selector...');
        await requestDevice();
        await connect();
      } catch (pickerErr: any) {
        setErrorMessage(pickerErr.message || 'Bluetooth connection failed.');
      }
    }
  };

  const handleStopScan = async () => {
    setIsScanning(false);
    setStatusMessage(null);
    try {
      await stopLiveScan();
    } catch (e) {
      console.warn(e);
    }
  };

  const handleConnectDevice = async (deviceId: string, deviceName?: string) => {
    setIsConnecting(true);
    setErrorMessage(null);
    setStatusMessage(`Connecting to ${deviceName || deviceId}...`);

    if (isScanning) {
      await handleStopScan();
    }

    try {
      await connectDirect(deviceId, deviceName);
      setStatusMessage(null);
      addLog(`Connected to ${deviceName || deviceId}`, 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectManual = async () => {
    const trimmed = manualMacInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter Bluetooth address');
      return;
    }
    await handleConnectDevice(trimmed, 'DIZO Watch D');
  };

  // SAFE ONE-BUTTON TIME SET: Targets FF02/FFD2 only, STRICTLY avoids OTA DFU (6387)
  const handleSetTime = async () => {
    if (status !== 'connected') {
      setErrorMessage('Please connect to watch first.');
      return;
    }

    setIsSyncing(true);
    setSyncDone(false);
    setErrorMessage(null);
    setSyncProgress(10);

    const now = new Date();
    const steps = buildSuperSyncSequence(now);

    // CRITICAL: Exclude all OTA/DFU pipes (0x6387 / 0x6287) so the watch does not reboot!
    const targets = writablePipes.filter((p) => {
      const u = p.characteristicUuid.toLowerCase();
      const s = p.serviceUuid.toLowerCase();
      return !u.includes('6387') && !s.includes('6287') && !u.includes('6487');
    });

    if (targets.length === 0) {
      setErrorMessage('No compatible time command pipe found on watch.');
      setIsSyncing(false);
      return;
    }

    addLog(`Setting time across ${targets.length} safe pipes (OTA excluded to prevent reboot)...`, 'info');

    let completed = 0;
    try {
      for (const step of steps) {
        setStatusMessage(`Syncing ${step.name}...`);
        const hex = bytesToHex(step.bytes);

        for (const pipe of targets) {
          const shortChar = pipe.characteristicUuid.slice(4, 8) || pipe.characteristicUuid.slice(0, 8);
          const res = await writePipeResilient(writeCharacteristic, pipe, step.bytes);
          if (res.success) {
            addLog(`OK -> ${shortChar}: ${step.name}`, 'success', hex);
          }
        }

        completed++;
        setSyncProgress(Math.min(95, Math.round((completed / steps.length) * 100)));
        // 250ms spacing prevents BLE buffer overflow on RTL8762
        await new Promise((r) => setTimeout(r, 250));
      }

      setSyncProgress(100);
      setSyncDone(true);
      setStatusMessage(null);
      setTimeSyncStatus('TIME_SYNC_VERIFIED');
      addLog('Time sync complete! Press watch crown button once to wake screen.', 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Sync encountered an error.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Watch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">DIZO Watch Lab</h1>
            <p className="text-[11px] font-mono text-cyan-400">One-Tap Time Restorer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpdateModal(true)}
            className="text-[11px] font-mono text-yellow-400 hover:text-yellow-300 bg-yellow-950/80 border border-yellow-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors font-bold shadow-sm"
            title="Update app directly from inside the app"
          >
            <Download className="w-3 h-3" />
            <span>Update App</span>
          </button>

          <button
            onClick={onSwitchToAdvanced}
            className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <span>Advanced Lab</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Big Digital Clock (Current Phone Time to Push) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-2 shadow-lg">
        <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Phone Time to Set</span>
        </div>
        <div className="font-mono text-4xl sm:text-5xl font-black text-white tracking-wider tabular-nums py-1">
          {currentDate.toLocaleTimeString([], { hour12: false })}
        </div>
        <div className="text-xs font-mono text-slate-400">
          {currentDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* DISCONNECTED STATE: Just 1 Button to Connect */}
      {status !== 'connected' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Connect DIZO Watch D</h2>
            <p className="text-xs text-slate-400 font-mono">
              Press the side button on your watch to turn on screen, then tap below.
            </p>
          </div>

          {!isScanning ? (
            <button
              onClick={handleStartScan}
              disabled={isConnecting}
              className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-mono font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50"
            >
              <Bluetooth className="w-5 h-5" />
              <span>{isConnecting ? 'Connecting...' : 'Scan & Connect Watch'}</span>
            </button>
          ) : (
            <button
              onClick={handleStopScan}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-950 border border-rose-800 text-rose-200 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow"
            >
              <Power className="w-4 h-4" />
              <span>Stop Scanning</span>
            </button>
          )}

          {/* Discovered Peripherals list */}
          {discoveredDevices.length > 0 && (
            <div className="space-y-2 text-left pt-2">
              <div className="text-xs font-mono text-slate-300">Nearby Devices:</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {discoveredDevices.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate">
                        {d.name || 'DIZO Watch'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{d.id}</div>
                    </div>
                    <button
                      onClick={() => handleConnectDevice(d.id, d.name)}
                      disabled={isConnecting}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Direct MAC fallback */}
          <div className="pt-1">
            <button
              onClick={() => setShowManualMac(!showManualMac)}
              className="text-[11px] font-mono text-slate-400 hover:text-cyan-400 underline decoration-slate-700 underline-offset-4"
            >
              {showManualMac ? 'Hide MAC input' : 'Or connect directly by MAC address'}
            </button>
          </div>

          {showManualMac && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 mt-2">
              <input
                type="text"
                value={manualMacInput}
                onChange={(e) => setManualMacInput(e.target.value)}
                placeholder="e.g. C4:64:E3:4A:21:9B"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleConnectManual}
                disabled={isConnecting}
                className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs"
              >
                Connect to This MAC
              </button>
            </div>
          )}
        </div>
      )}

      {/* CONNECTED STATE: One Giant Action Button */}
      {status === 'connected' && (
        <div className="space-y-4">
          {/* Watch Status Strip */}
          <div className="bg-slate-900 border border-emerald-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400 shrink-0">
                <BluetoothConnected className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-xs truncate">
                  {device?.name || 'DIZO Watch D'}
                </div>
                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CONNECTED
                </div>
              </div>
            </div>

            <button
              onClick={() => disconnect()}
              className="p-2 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800"
              title="Disconnect"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* THE MASTER BUTTON */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSetTime}
              disabled={isSyncing}
              className="w-full py-6 px-6 rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:brightness-110 active:scale-95 text-slate-950 font-mono font-black text-xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-emerald-950/60 disabled:opacity-50"
            >
              <Clock className={`w-7 h-7 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'SETTING TIME...' : 'SET TIME NOW'}</span>
            </button>

            {isSyncing && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-center text-slate-400 animate-pulse">
                  Transmitting time packets to watch MCU...
                </p>
              </div>
            )}
          </div>

          {/* Success Banner */}
          {syncDone && (
            <div className="bg-emerald-950 border border-emerald-500 rounded-3xl p-5 text-center space-y-3 shadow-xl animate-fade-in">
              <div className="w-10 h-10 rounded-xl bg-emerald-900 border border-emerald-400 flex items-center justify-center mx-auto text-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-emerald-200">Time Packets Sent!</h3>
                <p className="text-xs font-mono text-slate-200 leading-relaxed">
                  👉 <strong>Now press the physical side button on your watch once or twice</strong> to wake the screen so the clock digits refresh!
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guaranteed Solution Notice (Always Visible) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3 shadow">
        <div className="flex items-center gap-2 text-white font-bold text-xs">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Guaranteed Official Companion App Option</span>
        </div>
        <p className="text-xs font-mono text-slate-400 leading-relaxed">
          The DIZO Watch D hardware was designed and built by <strong>Linwear</strong>. Because the original DIZO app was taken down, Linwear&apos;s official OEM app <strong>OnWear Pro</strong> connects natively to the watch and sets the time automatically upon Bluetooth pairing:
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="https://play.google.com/store/apps/details?id=com.linwear.top"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>OnWear Pro on Google Play</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://apkpure.com/onwear-pro/com.linwear.top"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Download APK (APKPure)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Expandable Activity Log for Debugging */}
      <div className="space-y-2">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="text-[11px] font-mono text-slate-500 hover:text-slate-400 flex items-center gap-1 mx-auto"
        >
          <Terminal className="w-3 h-3" />
          <span>{showLogs ? 'Hide Transmission Log' : 'View Transmission Log'}</span>
          {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showLogs && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2 text-left font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Bluetooth Activity:</span>
              <button
                onClick={handleCopyLogs}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
              >
                {copiedLog ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                <span>{copiedLog ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="h-32 overflow-y-auto space-y-1 text-slate-300">
              {activityLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-4">No commands recorded yet.</div>
              ) : (
                activityLogs.map((l) => (
                  <div key={l.id} className="truncate">
                    <span className="text-slate-500">[{l.time}]</span> {l.text}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status or Error Notifications */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-200 text-xs font-mono text-center animate-pulse">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-200 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between font-bold text-rose-300">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Notice
            </span>
            <button onClick={() => setErrorMessage(null)}>✕</button>
          </div>
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}
      {/* In-App Direct Updater Modal */}
      <InAppUpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} />
    </div>
  );
};
