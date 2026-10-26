import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import {
  SMARTWATCH_TIME_PACKETS,
  SmartwatchTimePacket,
  buildSuperSyncSequence,
} from '../utils/timePacketGenerators';
import {
  detectWritablePipes,
  detectNotifyPipes,
  writePipeResilient,
  SmartwatchPipe,
} from '../utils/smartwatchPipes';
import { bytesToHex } from '../utils/byteUtils';
import {
  Watch,
  Bluetooth,
  BluetoothConnected,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Signal,
  ArrowRight,
  Terminal,
  Send,
  Radio,
  Layers,
  RotateCcw,
  Copy,
  Check,
  Smartphone,
  Info,
} from 'lucide-react';

interface SimpleWatchLabPageProps {
  onSwitchToAdvanced: () => void;
}

interface ActivityLogItem {
  id: string;
  time: string;
  text: string;
  type: 'tx' | 'rx' | 'info' | 'success' | 'warn' | 'error';
  hex?: string;
  charUuid?: string;
}

export const SimpleWatchLabPage: React.FC<SimpleWatchLabPageProps> = ({ onSwitchToAdvanced }) => {
  const {
    status,
    device,
    services,
    notifications,
    setTimeSyncStatus,
    requestDevice,
    connect,
    disconnect,
    connectDirect,
    startLiveScan,
    stopLiveScan,
    writeCharacteristic,
    subscribeCharacteristic,
    discoverServices,
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

  // Pipe Detection & Selection (Default to 'all' for maximum coverage)
  const writablePipes = useMemo(() => detectWritablePipes(services), [services]);
  const notifyPipes = useMemo(() => detectNotifyPipes(services), [services]);
  const [selectedPipeId, setSelectedPipeId] = useState<string>('all');

  // Activity Logs Console State
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const [copiedLog, setCopiedLog] = useState(false);

  const addLog = (
    text: string,
    type: ActivityLogItem['type'] = 'info',
    hex?: string,
    charUuid?: string
  ) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    const item: ActivityLogItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      time,
      text,
      type,
      hex,
      charUuid,
    };
    setActivityLogs((prev) => [...prev.slice(-99), item]);
  };

  const handleCopyLogs = () => {
    const text = activityLogs
      .map((l) => `[${l.time}] ${l.type.toUpperCase()}: ${l.text} ${l.hex ? `[${l.hex}]` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // Auto-scroll console
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLogs]);

  // Sync notification events into the live activity log
  const prevNotifCountRef = useRef(0);
  useEffect(() => {
    if (notifications.length > prevNotifCountRef.current) {
      const newItems = notifications.slice(0, notifications.length - prevNotifCountRef.current);
      newItems.forEach((n) => {
        const shortChar = n.characteristicUuid.slice(4, 8) || n.characteristicUuid.slice(0, 8);
        addLog(`RX Notification from ${shortChar}`, 'rx', n.payloadHex, n.characteristicUuid);
      });
    }
    prevNotifCountRef.current = notifications.length;
  }, [notifications]);

  // Auto-subscribe to notify pipe upon connection
  const subscribedPipesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (status === 'connected' && notifyPipes.length > 0) {
      notifyPipes.forEach(async (np) => {
        if (!subscribedPipesRef.current.has(np.id)) {
          subscribedPipesRef.current.add(np.id);
          try {
            await subscribeCharacteristic(np.serviceUuid, np.characteristicUuid);
            addLog(`Listening for MCU responses on ${np.name}`, 'info', undefined, np.characteristicUuid);
          } catch (e: any) {
            console.warn('Auto-subscribe note:', e.message);
          }
        }
      });
    } else if (status !== 'connected') {
      subscribedPipesRef.current.clear();
    }
  }, [status, notifyPipes, subscribeCharacteristic]);

  // Time Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProtocolIndex, setSyncProtocolIndex] = useState(0);
  const [syncFeedbackStage, setSyncFeedbackStage] = useState<'idle' | 'prompt' | 'success' | 'failed'>('idle');
  const [lastSyncedTimeStr, setLastSyncedTimeStr] = useState<string>('');
  const [showManualProtocolLab, setShowManualProtocolLab] = useState(false);

  // 1-Tap Connect: Start Live BLE Scan
  const handleStartScan = async () => {
    setErrorMessage(null);
    setStatusMessage('Scanning for nearby DIZO Watch D...');
    setIsScanning(true);
    setDiscoveredDevices([]);
    addLog('Starting Bluetooth LE radar scan...', 'info');

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
      // Fallback: try standard requestDevice picker
      try {
        setStatusMessage('Opening system device chooser...');
        await requestDevice();
        await connect();
      } catch (pickerErr: any) {
        setErrorMessage(pickerErr.message || err.message || 'Scanning failed.');
        addLog(`Scan error: ${pickerErr.message || err.message}`, 'error');
      }
    }
  };

  const handleStopScan = async () => {
    setIsScanning(false);
    setStatusMessage(null);
    try {
      await stopLiveScan();
      addLog('Scan stopped.', 'info');
    } catch (e) {
      console.warn(e);
    }
  };

  // Connect to a discovered device
  const handleConnectDevice = async (deviceId: string, deviceName?: string) => {
    setIsConnecting(true);
    setErrorMessage(null);
    setStatusMessage(`Connecting to ${deviceName || deviceId}...`);
    addLog(`Initiating GATT link with ${deviceName || deviceId}...`, 'info');

    if (isScanning) {
      await handleStopScan();
    }

    try {
      await connectDirect(deviceId, deviceName);
      setStatusMessage(null);
      addLog(`Connected to ${deviceName || deviceId}! Discovered ${writablePipes.length} writable pipes.`, 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish connection.');
      addLog(`Connection failed: ${err.message}`, 'error');
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

  // Determine active target pipes based on selection
  const getActivePipesToTarget = (): SmartwatchPipe[] => {
    if (selectedPipeId === 'all') {
      return writablePipes;
    }
    if (selectedPipeId !== 'auto') {
      const found = writablePipes.find((p) => p.id === selectedPipeId);
      if (found) return [found];
    }
    // 'auto' picks top ranked pipe (FF02, then FFD2, etc.)
    return writablePipes.length > 0 ? [writablePipes[0]] : [];
  };

  // Execute a single packet transmission to target pipe(s)
  const transmitPacket = async (packet: SmartwatchTimePacket, targetDate = new Date()) => {
    const targets = getActivePipesToTarget();
    if (targets.length === 0) {
      throw new Error('No writable GATT characteristic discovered on watch.');
    }

    const payloadBytes = packet.getBytes(targetDate);
    const hex = bytesToHex(payloadBytes);
    let anySuccess = false;
    let lastErr = '';

    for (const pipe of targets) {
      const shortChar = pipe.characteristicUuid.slice(4, 8) || pipe.characteristicUuid.slice(0, 8);
      addLog(`TX -> ${shortChar} [${packet.name}]`, 'tx', hex, pipe.characteristicUuid);

      const res = await writePipeResilient(writeCharacteristic, pipe, payloadBytes);
      if (res.success) {
        anySuccess = true;
        addLog(`TX OK -> ${shortChar} via ${res.usedWriteType}`, 'success', hex, pipe.characteristicUuid);
      } else {
        lastErr = res.error || 'Write rejected';
        addLog(`TX SKIP -> ${shortChar}: ${lastErr}`, 'warn', hex, pipe.characteristicUuid);
      }
    }

    if (!anySuccess) {
      throw new Error(lastErr || 'All write attempts failed.');
    }
  };

  // Comprehensive Super-Sync (Handshake -> Candidates -> Screen Refresh)
  const handleAutoSync = async () => {
    if (status !== 'connected') {
      setErrorMessage('Please connect your watch first.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    const now = new Date();
    setLastSyncedTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    const steps = buildSuperSyncSequence(now);
    const targets = getActivePipesToTarget();
    addLog(`Initiating Super-Sync (${steps.length} frames across ${targets.length} pipes)...`, 'info');

    let successCount = 0;
    try {
      for (const step of steps) {
        setStatusMessage(`Transmitting: ${step.name}...`);
        const hex = bytesToHex(step.bytes);

        for (const pipe of targets) {
          const shortChar = pipe.characteristicUuid.slice(4, 8) || pipe.characteristicUuid.slice(0, 8);
          addLog(`TX -> ${shortChar} [${step.name}]`, 'tx', hex, pipe.characteristicUuid);

          const res = await writePipeResilient(writeCharacteristic, pipe, step.bytes);
          if (res.success) {
            successCount++;
            addLog(`TX OK -> ${shortChar} via ${res.usedWriteType}`, 'success', hex, pipe.characteristicUuid);
          } else {
            addLog(`TX SKIP -> ${shortChar}: ${res.error}`, 'warn', hex, pipe.characteristicUuid);
          }
        }

        // Brief delay between frames so MCU processes each cleanly
        await new Promise((r) => setTimeout(r, 220));
      }

      setStatusMessage(null);
      setSyncFeedbackStage('prompt');
      addLog(`Super-Sync finished (${successCount} frames sent). Press side crown button to wake watch!`, 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Auto-Sync failed to write to watch GATT.');
      addLog(`Auto-Sync error: ${err.message}`, 'error');
      setSyncFeedbackStage('failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Single candidate test from the lab
  const handleSendSingleCandidate = async (packet: SmartwatchTimePacket) => {
    if (status !== 'connected') {
      setErrorMessage('Please connect your watch first.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    const now = new Date();
    setLastSyncedTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    try {
      setStatusMessage(`Transmitting: ${packet.name}...`);
      await transmitPacket(packet, now);
      setStatusMessage(null);
      setSyncFeedbackStage('prompt');
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to transmit ${packet.name}`);
      setSyncFeedbackStage('failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmSyncWorked = () => {
    setTimeSyncStatus('TIME_SYNC_VERIFIED');
    setSyncFeedbackStage('success');
    addLog('Time synchronization confirmed and verified on watch screen!', 'success');
  };

  const handleTryNextProtocol = async () => {
    const nextIdx = (syncProtocolIndex + 1) % SMARTWATCH_TIME_PACKETS.length;
    setSyncProtocolIndex(nextIdx);
    const nextPacket = SMARTWATCH_TIME_PACKETS[nextIdx];
    await handleSendSingleCandidate(nextPacket);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
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
        <div className="space-y-5">
          {/* Watch Status Card */}
          <div className="bg-slate-900/90 border border-emerald-700/60 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600/70 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
                <BluetoothConnected className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white truncate">
                    {device?.name || 'DIZO Watch D'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  ID: <code className="text-slate-300">{device?.id}</code>
                </div>
              </div>
            </div>

            <button
              onClick={() => disconnect()}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-200 transition-colors shrink-0"
              title="Disconnect"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>

          {/* Live Detected GATT Pipes Header */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-semibold flex items-center gap-1.5 text-cyan-300">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Target Command Pipe:
              </span>
              <button
                onClick={() => discoverServices()}
                className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
                title="Refresh GATT tree"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-scan</span>
              </button>
            </div>

            {/* Pipe Selector */}
            <div className="flex flex-col gap-1.5">
              <select
                value={selectedPipeId}
                onChange={(e) => setSelectedPipeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none focus:border-cyan-500"
              >
                <option value="all">⚡ Broadcast to ALL Discovered Writable Pipes (Recommended)</option>
                <option value="auto">
                  🎯 Auto (Best Match: {writablePipes[0]?.name || 'Auto-detect'})
                </option>
                {writablePipes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.characteristicUuid.slice(4, 8) || p.characteristicUuid.slice(0, 8)}) - {p.preferredWriteType}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  Detected Writable Pipes:{' '}
                  <strong className="text-cyan-400">{writablePipes.length}</strong>
                </span>
                {notifyPipes.length > 0 && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Listening on {notifyPipes[0].name.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Big Live Digital Clock Display */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 text-center space-y-4 shadow-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Exact Phone Time to Send</span>
            </div>

            <div className="font-mono text-4xl sm:text-5xl font-black text-white tracking-wider tabular-nums py-1">
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
            <div className="pt-3 max-w-sm mx-auto space-y-2.5">
              <button
                onClick={handleAutoSync}
                disabled={isSyncing}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-400 to-teal-400 hover:brightness-110 active:scale-[0.98] text-slate-950 font-mono font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-cyan-950/60 disabled:opacity-50"
              >
                <Clock className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Running Super-Sync...' : 'Auto-Sync Time to Watch'}</span>
              </button>

              <p className="text-[11px] font-mono text-slate-400 leading-tight">
                Pushes Handshake, Realtek/Linwear Calendar frames & LCD Redraw command.
              </p>
            </div>
          </div>

          {/* Verification Feedback Banner */}
          {syncFeedbackStage === 'prompt' && (
            <div className="bg-cyan-950/80 border border-cyan-500 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-cyan-900/80 border border-cyan-400 flex items-center justify-center mx-auto text-cyan-200">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Time Packets Dispatched!</h3>
                <div className="p-3 bg-slate-950/70 border border-cyan-700/60 rounded-2xl text-xs font-mono text-amber-300 text-left space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <Info className="w-4 h-4 text-cyan-400" />
                    Crucial Step: Force Watch LCD Redraw
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Smartwatch screens cache the clock image while on. Click the <strong>physical side crown button</strong> on your watch once to turn the screen off, then once more to wake it up!
                  </p>
                </div>
                <p className="text-xs font-mono text-slate-300 pt-1">
                  Did the clock update to <strong className="text-cyan-300 font-bold">{lastSyncedTimeStr}</strong>?
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
                  <span>No Change, Try Next Protocol</span>
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

          {/* Candidate Protocol Lab (Manual 1-Tap Testing Accordion) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
            <button
              onClick={() => setShowManualProtocolLab(!showManualProtocolLab)}
              className="w-full flex items-center justify-between text-xs font-mono text-slate-200 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="font-bold">Candidate Protocol Lab ({SMARTWATCH_TIME_PACKETS.length} Formats)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>{showManualProtocolLab ? 'Collapse' : 'Expand'}</span>
                {showManualProtocolLab ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showManualProtocolLab && (
              <div className="pt-2 space-y-2.5 border-t border-slate-800/80">
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                  Test specific candidate packet formats individually to pinpoint the exact framing required by your watch MCU:
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {SMARTWATCH_TIME_PACKETS.map((pkt) => {
                    const testBytes = pkt.getBytes(currentDate);
                    const hexStr = bytesToHex(testBytes);

                    return (
                      <div
                        key={pkt.id}
                        className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-3 text-left transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                            <span>{pkt.name}</span>
                            <span className="text-[9px] bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-normal shrink-0">
                              {pkt.category}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            <code>{hexStr}</code> ({testBytes.length} bytes)
                          </div>
                        </div>

                        <button
                          onClick={() => handleSendSingleCandidate(pkt)}
                          disabled={isSyncing}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs shrink-0 transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Live Activity & MCU Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-inner">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Live Bluetooth Activity Console
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="text-[10px] hover:text-cyan-300 text-slate-400 flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800"
                  title="Copy log to clipboard"
                >
                  {copiedLog ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedLog ? 'Copied!' : 'Copy Log'}</span>
                </button>
                <button
                  onClick={() => setActivityLogs([])}
                  className="text-[10px] hover:text-slate-200 text-slate-500 flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="h-44 overflow-y-auto font-mono text-[11px] p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-1">
              {activityLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-6">
                  Ready. Tap &quot;Auto-Sync Time&quot; or select a candidate format to begin transmission.
                </div>
              ) : (
                activityLogs.map((log) => {
                  let colorClass = 'text-slate-300';
                  if (log.type === 'tx') colorClass = 'text-cyan-400 font-semibold';
                  if (log.type === 'rx') colorClass = 'text-amber-300 font-semibold';
                  if (log.type === 'success') colorClass = 'text-emerald-400';
                  if (log.type === 'error') colorClass = 'text-rose-400 font-semibold';
                  if (log.type === 'warn') colorClass = 'text-amber-400';

                  return (
                    <div key={log.id} className="leading-tight flex items-start gap-1.5 break-all">
                      <span className="text-slate-500 select-none shrink-0">[{log.time}]</span>
                      <span className={colorClass}>
                        {log.text}
                        {log.hex && <code className="ml-1 bg-slate-800 px-1 py-0.5 rounded text-white">{log.hex}</code>}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={consoleBottomRef} />
            </div>
          </div>

          {/* Alternative Companion App Notice */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 text-xs font-mono text-slate-400 space-y-2">
            <div className="text-slate-300 font-bold flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Alternative Manufacturer Companion App</span>
            </div>
            <p className="leading-relaxed">
              DIZO smartwatches are manufactured by <strong>Linwear</strong>. If the DIZO app is unavailable or your watch requires an initial Bluetooth bond, you can also install <strong>OnWear</strong> or <strong>OnWear Pro</strong> (the official Linwear companion app) directly from the Google Play Store or APKPure.
            </p>
          </div>
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
