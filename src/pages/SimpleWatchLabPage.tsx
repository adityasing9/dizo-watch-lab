import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { CANDIDATE_TIME_PROTOCOLS } from '../data/timeCandidateProtocols';
import {
  Watch,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  ChevronRight,
  Sparkles,
  Signal,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface SimpleWatchLabPageProps {
  onSwitchToAdvanced: () => void;
}

export const SimpleWatchLabPage: React.FC<SimpleWatchLabPageProps> = ({ onSwitchToAdvanced }) => {
  const {
    status,
    device,
    services,
    timeSyncStatus,
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

  // Time Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProtocolIndex, setSyncProtocolIndex] = useState(0);
  const [syncFeedbackStage, setSyncFeedbackStage] = useState<'idle' | 'prompt' | 'success' | 'failed'>('idle');
  const [lastSyncedTimeStr, setLastSyncedTimeStr] = useState<string>('');

  // 1-Tap Connect: Start Live BLE Scan
  const handleStartScan = async () => {
    setErrorMessage(null);
    setStatusMessage('Scanning for nearby DIZO Watch D...');
    setIsScanning(true);
    setDiscoveredDevices([]);

    try {
      await startLiveScan((found) => {
        setDiscoveredDevices((prev) => {
          const exists = prev.some((d) => d.id === found.id);
          if (exists) {
            return prev.map((d) => (d.id === found.id ? { ...d, ...found } : d));
          }
          return [...prev, found];
        });
      });
    } catch (err: any) {
      setIsScanning(false);
      // Fallback: try standard requestDevice picker if background scan fails
      try {
        setStatusMessage('Opening system device chooser...');
        await requestDevice();
        await connect();
      } catch (pickerErr: any) {
        setErrorMessage(pickerErr.message || err.message || 'Scanning failed.');
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

  // Connect to a discovered device
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish connection.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Direct manual MAC connect
  const handleConnectManual = async () => {
    const trimmed = manualMacInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid MAC address (e.g. C4:64:E3:4A:21:9B)');
      return;
    }
    await handleConnectDevice(trimmed, 'DIZO Watch D');
  };

  // Smart 1-Tap Time Sync Execution
  const handleSyncTime = async (protocolIdx = 0) => {
    if (status !== 'connected') {
      setErrorMessage('Please connect your watch first.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    setSyncProtocolIndex(protocolIdx);

    const now = new Date();
    setLastSyncedTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    const targetProtocol = CANDIDATE_TIME_PROTOCOLS[protocolIdx] || CANDIDATE_TIME_PROTOCOLS[0];
    const payload = targetProtocol.buildPayload(now);

    try {
      setStatusMessage(`Transmitting: ${targetProtocol.name}...`);
      await writeCharacteristic(
        targetProtocol.serviceUuid,
        targetProtocol.characteristicUuid,
        new Uint8Array(payload.bytes),
        targetProtocol.writeType
      );

      setStatusMessage(null);
      setSyncFeedbackStage('prompt');
    } catch (err: any) {
      // If candidate 0 failed, automatically try next candidate
      if (protocolIdx < CANDIDATE_TIME_PROTOCOLS.length - 1) {
        setStatusMessage(`Retrying with protocol #${protocolIdx + 2}...`);
        await handleSyncTime(protocolIdx + 1);
        return;
      }
      setErrorMessage(err.message || 'Failed to transmit time synchronization packet.');
      setSyncFeedbackStage('failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmSyncWorked = () => {
    setTimeSyncStatus('TIME_SYNC_VERIFIED');
    setSyncFeedbackStage('success');
  };

  const handleTryNextProtocol = () => {
    const nextIdx = (syncProtocolIndex + 1) % CANDIDATE_TIME_PROTOCOLS.length;
    handleSyncTime(nextIdx);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-md">
            <Watch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">DIZO Watch Lab</h1>
            <p className="text-[11px] font-mono text-cyan-400">One-Tap Time Restorer</p>
          </div>
        </div>

        <button
          onClick={onSwitchToAdvanced}
          className="text-xs font-mono text-slate-400 hover:text-cyan-300 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
        >
          <span>Advanced Lab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* DISCONNECTED STATE VIEW */}
      {status !== 'connected' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Watch Pulse Graphic */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center border shadow-xl transition-all duration-500 ${
                isScanning
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-400 scale-105'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <Bluetooth
                className={`w-10 h-10 ${isScanning ? 'animate-pulse text-cyan-400' : 'text-slate-500'}`}
              />
            </div>
            {isScanning && (
              <div className="absolute inset-0 -m-3 rounded-3xl border-2 border-cyan-500/40 animate-ping pointer-events-none" />
            )}
          </div>

          <div className="space-y-1.5 max-w-sm mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isScanning ? 'Scanning for Your Watch...' : 'Connect DIZO Watch D'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Press the side crown on your watch to wake the screen, then tap below to connect.
            </p>
          </div>

          {/* Big Action Button */}
          <div className="space-y-3 max-w-sm mx-auto">
            {!isScanning ? (
              <button
                onClick={handleStartScan}
                disabled={isConnecting}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-400 hover:from-cyan-400 hover:to-teal-300 active:scale-[0.98] text-slate-950 font-mono font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg shadow-cyan-950/60 disabled:opacity-50"
              >
                <Bluetooth className="w-5 h-5" />
                <span>{isConnecting ? 'Connecting...' : 'Scan & Connect Watch'}</span>
              </button>
            ) : (
              <button
                onClick={handleStopScan}
                className="w-full py-3.5 px-6 rounded-2xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow"
              >
                <Power className="w-4 h-4" />
                <span>Stop Scanning</span>
              </button>
            )}

            {/* Direct MAC fallback toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowManualMac(!showManualMac)}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-400 underline decoration-slate-700 underline-offset-4"
              >
                {showManualMac ? 'Hide MAC input' : 'Or connect directly by MAC address'}
              </button>
            </div>

            {showManualMac && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 mt-2">
                <label className="text-[11px] font-mono text-slate-300 block">
                  Bluetooth MAC Address:
                </label>
                <input
                  type="text"
                  value={manualMacInput}
                  onChange={(e) => setManualMacInput(e.target.value)}
                  placeholder="e.g. C4:64:E3:4A:21:9B"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:border-cyan-500 outline-none"
                />
                <button
                  onClick={handleConnectManual}
                  disabled={isConnecting}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect to This Address'}
                </button>
              </div>
            )}
          </div>

          {/* Discovered Peripherals List */}
          {discoveredDevices.length > 0 && (
            <div className="space-y-2 text-left pt-2">
              <div className="text-xs font-mono font-semibold text-slate-300 flex items-center justify-between">
                <span>Nearby Peripherals ({discoveredDevices.length}):</span>
                <span className="text-[10px] text-cyan-400 animate-pulse">● Live updating</span>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {discoveredDevices.map((d) => {
                  const isDizo = d.name?.toLowerCase().includes('dizo') || d.name?.toLowerCase().includes('watch');
                  return (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isDizo
                          ? 'bg-cyan-950/50 border-cyan-600/70 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                          <span>{d.name || 'Unnamed BLE Device'}</span>
                          {isDizo && (
                            <span className="text-[9px] bg-cyan-900 text-cyan-200 px-1.5 py-0.2 rounded font-mono font-normal">
                              MATCH
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{d.id}</span>
                          {d.rssi !== undefined && (
                            <span className="text-cyan-400 flex items-center gap-0.5">
                              <Signal className="w-2.5 h-2.5" />
                              {d.rssi} dBm
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleConnectDevice(d.id, d.name)}
                        disabled={isConnecting}
                        className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold shrink-0 transition-transform active:scale-95 disabled:opacity-50 ${
                          isDizo
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        Connect ➔
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Notice Checklist */}
          <div className="text-[11px] font-mono text-slate-400 bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 text-left space-y-1">
            <span className="text-slate-300 font-semibold block">Quick Checklist:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
              <li>Phone <strong>Bluetooth</strong> and <strong>Location (GPS)</strong> are ON.</li>
              <li>Watch screen is <strong>awake</strong> (press side crown).</li>
              <li>Unpair watch from phone Settings if paired earlier.</li>
            </ul>
          </div>
        </div>
      )}

      {/* CONNECTED STATE VIEW */}
      {status === 'connected' && (
        <div className="space-y-6">
          {/* Watch Status Card */}
          <div className="bg-slate-900/90 border border-emerald-700/60 rounded-3xl p-5 flex items-center justify-between gap-4 shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600/70 flex items-center justify-center text-emerald-400 shadow-inner">
                <BluetoothConnected className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">
                    {device?.name || 'DIZO Watch D'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  ID: <code className="text-slate-300">{device?.id}</code>
                </div>
              </div>
            </div>

            <button
              onClick={() => disconnect()}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-200 transition-colors"
              title="Disconnect"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>

          {/* Big Live Digital Clock Display */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Exact Phone Time to Send</span>
            </div>

            <div className="font-mono text-4xl sm:text-5xl font-black text-white tracking-wider tabular-nums py-2">
              {currentDate.toLocaleTimeString([], { hour12: false })}
            </div>

            <div className="text-xs font-mono text-slate-400">
              {currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {/* Massive Primary Sync Button */}
            <div className="pt-4 max-w-sm mx-auto space-y-3">
              <button
                onClick={() => handleSyncTime(0)}
                disabled={isSyncing}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-400 to-teal-400 hover:brightness-110 active:scale-[0.98] text-slate-950 font-mono font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-cyan-950/60 disabled:opacity-50"
              >
                <Clock className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Transmitting Time...' : 'Sync Time to Watch'}</span>
              </button>

              <p className="text-[11px] font-mono text-slate-400">
                Sends Bluetooth SIG CTS and smartwatch vendor packets directly to the watch MCU.
              </p>
            </div>
          </div>

          {/* Verification Feedback Banner */}
          {syncFeedbackStage === 'prompt' && (
            <div className="bg-cyan-950/60 border border-cyan-600/80 rounded-3xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-cyan-900/80 border border-cyan-500 flex items-center justify-center mx-auto text-cyan-300">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Time Packet Sent!</h3>
                <p className="text-xs font-mono text-slate-300">
                  Look at your watch screen right now. Did the clock update to{' '}
                  <strong className="text-cyan-300 font-bold">{lastSyncedTimeStr}</strong>?
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleConfirmSyncWorked}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yes, It Worked!</span>
                </button>

                <button
                  onClick={handleTryNextProtocol}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>No Change, Try Next Method</span>
                </button>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {syncFeedbackStage === 'success' && (
            <div className="bg-emerald-950/70 border border-emerald-500 rounded-3xl p-6 text-center space-y-3 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-900 border border-emerald-400 flex items-center justify-center mx-auto text-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-200">Date & Time Successfully Restored!</h3>
              <p className="text-xs font-mono text-slate-300 max-w-md mx-auto">
                Your DIZO Watch D has successfully synced over Bluetooth. You can now use your watch as a reliable timepiece.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status or Error Notifications */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs font-mono text-center animate-pulse">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Notice
            </span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
              ✕
            </button>
          </div>
          <p className="leading-relaxed break-words">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};
