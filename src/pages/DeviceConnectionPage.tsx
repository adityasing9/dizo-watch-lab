import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { validateUuid } from '../utils/uuidUtils';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  Trash2,
  HelpCircle,
  Power,
  Clock,
  Binary,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Smartphone,
  Download,
} from 'lucide-react';

interface DeviceConnectionPageProps {
  onNavigate: (tabId: string) => void;
}

export const DeviceConnectionPage: React.FC<DeviceConnectionPageProps> = ({ onNavigate }) => {
  const {
    status,
    device,
    isMockMode,
    setMockMode,
    requestDevice,
    connect,
    disconnect,
    connectDirect,
    startLiveScan,
    stopLiveScan,
    isNative,
  } = useBluetooth();

  const [connectionMethod, setConnectionMethod] = useState<'chooser' | 'liveScan' | 'manualMac'>('chooser');
  const [directMacInput, setDirectMacInput] = useState('');
  const [liveDevices, setLiveDevices] = useState<Array<{ id: string; name?: string; rssi?: number }>>([]);
  const [isLiveScanning, setIsLiveScanning] = useState(false);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(label);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  const handleCopyDeviceId = () => {
    if (!device?.id) return;
    navigator.clipboard.writeText(device.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const [discoveryMode, setDiscoveryMode] = useState<'all' | 'prefix'>('all');
  const [namePrefix, setNamePrefix] = useState('DIZO');
  const [customOptionalServices, setCustomOptionalServices] = useState<string[]>([
    '000001ff-3c17-d293-8e48-14fe2e4da212',
    '00006287-3c17-d293-8e48-14fe2e4da212',
  ]);
  const [newUuidInput, setNewUuidInput] = useState('');
  const [uuidInputError, setUuidInputError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddCustomUuid = () => {
    setUuidInputError(null);
    if (!newUuidInput.trim()) return;

    const validation = validateUuid(newUuidInput.trim());
    if (!validation.isValid) {
      setUuidInputError(validation.error || 'Invalid UUID format.');
      return;
    }

    if (customOptionalServices.includes(validation.normalized)) {
      setUuidInputError('UUID already in optional services list.');
      return;
    }

    setCustomOptionalServices([...customOptionalServices, validation.normalized]);
    setNewUuidInput('');
  };

  const handleRemoveUuid = (uuid: string) => {
    setCustomOptionalServices(customOptionalServices.filter((u) => u !== uuid));
  };

  const handleRequestAndConnect = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let options: any = {
        optionalServices: customOptionalServices,
      };

      if (discoveryMode === 'prefix' && namePrefix.trim().length > 0) {
        options.filters = [{ namePrefix: namePrefix.trim() }];
      } else {
        options.acceptAllDevices = true;
      }

      await requestDevice(options);
      await connect();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during device selection or connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartLiveScan = async () => {
    setIsLiveScanning(true);
    setErrorMessage(null);
    setLiveDevices([]);
    try {
      await startLiveScan((discovered) => {
        setLiveDevices((prev) => {
          const exists = prev.some((d) => d.id === discovered.id);
          if (exists) {
            return prev.map((d) => (d.id === discovered.id ? { ...d, ...discovered } : d));
          }
          return [...prev, discovered];
        });
      });
    } catch (err: any) {
      setIsLiveScanning(false);
      setErrorMessage(err.message || 'Live scan failed to start.');
    }
  };

  const handleStopLiveScan = async () => {
    setIsLiveScanning(false);
    try {
      await stopLiveScan();
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleConnectDirectMac = async (macToConnect?: string, name?: string) => {
    const targetMac = (macToConnect || directMacInput).trim();
    if (!targetMac) {
      setErrorMessage('Please enter a valid Bluetooth MAC address (e.g. C4:64:E3:4A:21:9B).');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    if (isLiveScanning) {
      await handleStopLiveScan();
    }
    try {
      await connectDirect(targetMac, name);
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to connect to ${targetMac}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    if (!device) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await connect();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reconnect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Bluetooth className="w-6 h-6 text-cyan-400" />
            <span>Device Connection Hub</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Connect to your DIZO Watch D over Bluetooth Low Energy to test time synchronization.
          </p>
        </div>

        {/* Quick Mock Mode toggle pill */}
        <button
          onClick={() => setMockMode(!isMockMode)}
          className={`self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center gap-2 ${
            isMockMode
              ? 'bg-amber-950/60 border-amber-700/80 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isMockMode ? 'Mock Mode: ON (Simulated)' : 'Live BLE Active'}</span>
        </button>
      </div>

      {/* Primary Connection Hero Card */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        {/* Subtle backdrop glow */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            status === 'connected' ? 'bg-emerald-500/10' : 'bg-cyan-500/10'
          }`}
        />

        {status === 'connected' ? (
          /* CONNECTED STATE */
          <div className="space-y-6 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-lab-border/80">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/90 border border-emerald-600/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40 shrink-0">
                  <BluetoothConnected className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold text-white">
                      {device?.name || 'DIZO Watch D'}
                    </span>
                    <Badge variant="success" dot>Connected</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
                    <span>ID: <code className="text-slate-200">{device?.id || 'Unknown'}</code></span>
                    <button
                      onClick={handleCopyDeviceId}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="Copy Device ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => disconnect()}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-mono flex items-center gap-2 transition-all active:scale-95"
              >
                <Power className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>

            {/* Quick Navigation Cards on Connected */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => onNavigate('time-sync')}
                className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 to-slate-900/60 border border-cyan-800/80 hover:border-cyan-500 hover:bg-cyan-950/60 transition-all text-left group shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">
                    Launch ➔
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">Time Synchronization Lab</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Test standard CTS and vendor command packets to restore the watch's clock.
                </p>
              </button>

              <button
                onClick={() => onNavigate('gatt')}
                className="p-4 rounded-xl bg-gradient-to-br from-purple-950/30 to-slate-900/60 border border-purple-800/60 hover:border-purple-500 hover:bg-purple-950/50 transition-all text-left group shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-400">
                    <Binary className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-purple-400 font-semibold group-hover:translate-x-1 transition-transform">
                    Explore ➔
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">GATT Service Explorer</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enumerate primary services, inspect characteristics, and read live firmware parameters.
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="flex flex-col items-center text-center space-y-6 relative z-10 py-2 sm:py-4">
            {/* Animated Bluetooth Radar Avatar */}
            <div className="relative">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center border shadow-2xl transition-all duration-300 ${
                  isLoading
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 scale-105'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300'
                }`}
              >
                <Bluetooth
                  className={`w-10 h-10 sm:w-12 sm:h-12 ${
                    isLoading ? 'animate-pulse text-cyan-400' : 'text-slate-400'
                  }`}
                />
              </div>
              {isLoading && (
                <div className="absolute inset-0 -m-3 rounded-3xl border-2 border-cyan-500/50 animate-ping pointer-events-none" />
              )}
            </div>

            <div className="max-w-md space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {isLoading ? 'Scanning for DIZO Watch D...' : 'Scan & Connect to Watch'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Press the side crown button on your DIZO Watch D to wake its screen, then tap the button below to pair.
              </p>
            </div>

            {/* Connection Method Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-lab-card/80 border border-lab-border rounded-xl text-xs font-mono">
              <button
                onClick={() => setConnectionMethod('chooser')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  connectionMethod === 'chooser'
                    ? 'bg-cyan-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. System Chooser
              </button>
              <button
                onClick={() => setConnectionMethod('liveScan')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  connectionMethod === 'liveScan'
                    ? 'bg-cyan-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Live Radar Scan
              </button>
              <button
                onClick={() => setConnectionMethod('manualMac')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  connectionMethod === 'manualMac'
                    ? 'bg-cyan-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Direct MAC Connect
              </button>
            </div>

            {/* METHOD 1: SYSTEM CHOOSER */}
            {connectionMethod === 'chooser' && (
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={handleRequestAndConnect}
                  disabled={isLoading}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 active:scale-[0.98] text-slate-950 font-mono font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-lg shadow-cyan-950/60 disabled:opacity-50"
                >
                  <Bluetooth className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Searching Peripherals...' : 'Scan & Connect Watch'}</span>
                </button>

                {device && (
                  <button
                    onClick={handleReconnect}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Reconnect Last Device ({device.name})</span>
                  </button>
                )}

                <div className="flex items-center justify-center gap-2 text-xs font-mono pt-1">
                  <span className="text-slate-400">Filter:</span>
                  <button
                    onClick={() => setDiscoveryMode('all')}
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] ${
                      discoveryMode === 'all'
                        ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    All Devices
                  </button>
                  <button
                    onClick={() => setDiscoveryMode('prefix')}
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] ${
                      discoveryMode === 'prefix'
                        ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    DIZO Only
                  </button>
                </div>
              </div>
            )}

            {/* METHOD 2: LIVE RADAR SCANNER */}
            {connectionMethod === 'liveScan' && (
              <div className="w-full max-w-md space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300 font-semibold">
                    {isLiveScanning ? 'Listening for Bluetooth signals...' : 'Ready to start live scan'}
                  </span>
                  <button
                    onClick={isLiveScanning ? handleStopLiveScan : handleStartLiveScan}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow ${
                      isLiveScanning
                        ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {isLiveScanning ? 'Stop Live Scan' : 'Start Live Scan'}
                  </button>
                </div>

                {liveDevices.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs font-mono text-slate-400">
                    {isLiveScanning
                      ? 'Scanning airwaves... Peripherals will appear here automatically.'
                      : 'Tap "Start Live Scan" to discover nearby devices in real time.'}
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {liveDevices.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono hover:border-cyan-700/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            {d.name || 'Unnamed BLE Device'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{d.id}</span>
                            {d.rssi !== undefined && (
                              <span className="text-cyan-400 font-semibold">{d.rssi} dBm</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleConnectDirectMac(d.id, d.name)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shrink-0 transition-transform active:scale-95 disabled:opacity-50"
                        >
                          Connect ➔
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* METHOD 3: DIRECT MAC CONNECT */}
            {connectionMethod === 'manualMac' && (
              <div className="w-full max-w-sm space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 font-semibold block">
                    Watch MAC Address:
                  </label>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Found in your phone's Bluetooth paired list, user manual, or box.
                  </p>
                  <input
                    type="text"
                    value={directMacInput}
                    onChange={(e) => setDirectMacInput(e.target.value)}
                    placeholder="e.g. C4:64:E3:4A:21:9B"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase tracking-wider focus:border-cyan-500 outline-none"
                  />
                </div>

                <button
                  onClick={() => handleConnectDirectMac()}
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow disabled:opacity-50"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>{isLoading ? 'Connecting...' : 'Connect to MAC Directly'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Distinct Error Notice Alert */}
      {errorMessage && (
        <div className="bg-rose-950/70 border border-rose-800/90 rounded-2xl p-5 text-rose-200 space-y-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 font-bold text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                {errorMessage.toLowerCase().includes('globally disabled')
                  ? 'Web Bluetooth Globally Disabled'
                  : 'Connection Notice'}
              </span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="px-3 py-1 rounded-full bg-rose-900/80 hover:bg-rose-800 border border-rose-700/80 text-rose-100 font-mono text-xs transition-colors shrink-0"
            >
              Dismiss ✕
            </button>
          </div>

          <div className="p-3 bg-black/50 rounded-xl border border-rose-900/70 font-mono text-xs text-rose-200 break-words leading-relaxed">
            {errorMessage}
          </div>

          {/* Contextual guidance */}
          {errorMessage.toLowerCase().includes('globally disabled') ? (
            <div className="bg-black/60 p-4 rounded-xl border border-rose-900/80 space-y-3 font-mono text-xs text-slate-300">
              <div className="font-bold text-amber-300">How to Resolve "Web Bluetooth API globally disabled":</div>
              <ul className="space-y-2 list-disc pl-5">
                <li>
                  <strong>Incognito Mode:</strong> Chrome disables Bluetooth in Incognito. Open in a standard browser tab.
                </li>
                <li>
                  <strong>Bluetooth Radio:</strong> Ensure Windows or Android Bluetooth is switched ON.
                </li>
                <li>
                  <strong>Android Phone Users:</strong> Use our native Android App APK below for direct hardware Bluetooth access without browser limitations!
                </li>
              </ul>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="/dizo-watch-lab.apk"
                  download="dizo-watch-lab.apk"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors inline-flex items-center gap-2 text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Android APK</span>
                </a>
                <button
                  onClick={() => {
                    setMockMode(true);
                    setErrorMessage(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
                >
                  Enable Mock Simulation
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-300 font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong>Tip:</strong> If using an Android phone, make sure both <strong>Bluetooth</strong> and <strong>Location Services (GPS)</strong> are toggled ON in quick settings, and allow <em>Nearby Devices</em> permission when prompted.
            </div>
          )}
        </div>
      )}

      {/* Collapsible Advanced GATT Configuration */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Advanced BLE & GATT Settings
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
            <span>{showAdvanced ? 'Hide Settings' : 'Configure UUID Whitelist'}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-6 border-t border-lab-border/70 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Filter Mode */}
              <div className="bg-lab-card/60 p-4 rounded-xl border border-lab-border space-y-3">
                <div className="text-slate-200 font-semibold">Discovery Filter Mode</div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="filterMode"
                      value="all"
                      checked={discoveryMode === 'all'}
                      onChange={() => setDiscoveryMode('all')}
                      className="accent-cyan-500"
                    />
                    <span>Broad Discovery (acceptAllDevices: true)</span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-5">
                    Recommended. Shows all nearby Bluetooth peripherals in chooser dialog.
                  </p>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2">
                    <input
                      type="radio"
                      name="filterMode"
                      value="prefix"
                      checked={discoveryMode === 'prefix'}
                      onChange={() => setDiscoveryMode('prefix')}
                      className="accent-cyan-500"
                    />
                    <span>Device Name Prefix Filter</span>
                  </label>
                  {discoveryMode === 'prefix' && (
                    <div className="pl-5 pt-1">
                      <input
                        type="text"
                        value={namePrefix}
                        onChange={(e) => setNamePrefix(e.target.value)}
                        placeholder="e.g. DIZO or Watch"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Services Whitelist */}
              <div className="bg-lab-card/60 p-4 rounded-xl border border-lab-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-slate-200 font-semibold">Optional Services Whitelist</div>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {customOptionalServices.length} custom declared
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Services must be declared here if you wish to inspect proprietary vendor channels.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUuidInput}
                    onChange={(e) => setNewUuidInput(e.target.value)}
                    placeholder="Enter 128-bit UUID..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                  />
                  <button
                    onClick={handleAddCustomUuid}
                    className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-slate-100 flex items-center gap-1 font-mono text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {uuidInputError && <div className="text-[11px] text-rose-400 font-mono">{uuidInputError}</div>}

                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {customOptionalServices.map((uuid) => (
                    <div
                      key={uuid}
                      className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-slate-800 text-slate-300"
                    >
                      <span className="truncate">{uuid}</span>
                      <button
                        onClick={() => handleRemoveUuid(uuid)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hardware Connection Troubleshooting Cards */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>DIZO Watch D Hardware Connection Tips</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-lab-card/50 p-4 rounded-xl border border-lab-border/70 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <span>1. Single Client BLE Limit</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Smartwatches typically allow <strong>only one connected phone</strong> at a time.
              Disconnect or turn off Bluetooth on any other phone bonded with the watch.
            </p>
          </div>

          <div className="bg-lab-card/50 p-4 rounded-xl border border-lab-border/70 space-y-2">
            <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <span>2. Keep Display Awake</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Press the physical crown button on the DIZO Watch D to illuminate the display before scanning so it advertises at full speed.
            </p>
          </div>

          <div className="bg-lab-card/50 p-4 rounded-xl border border-lab-border/70 space-y-2">
            <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <span>3. Battery Level</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              If the battery is critically low (&lt;15%), Bluetooth may enter power-save standby. Place on the magnetic charger while testing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
