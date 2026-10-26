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
  ShieldAlert,
  HelpCircle,
  Activity,
  Power,
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
  } = useBluetooth();

  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(label);
    setTimeout(() => setCopiedSetting(null), 2000);
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
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bluetooth className="w-5 h-5 text-cyan-400" />
          <span>Device Connection Manager</span>
        </h1>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Scan for nearby BLE peripherals, configure Web Bluetooth GATT filters, and establish connection with DIZO Watch D.
        </p>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-lab-border">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${
                status === 'connected'
                  ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-400'
                  : status === 'connecting'
                  ? 'bg-amber-950/80 border-amber-700/80 text-amber-400 animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {status === 'connected' ? (
                <BluetoothConnected className="w-7 h-7" />
              ) : (
                <BluetoothOff className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-bold text-white">
                  {device?.name || 'No Target Selected'}
                </span>
                <span className="capitalize">
                  {status === 'connected' ? (
                    <Badge variant="success" dot>Connected</Badge>
                  ) : status === 'connecting' ? (
                    <Badge variant="warning" dot>Connecting...</Badge>
                  ) : (
                    <Badge variant="neutral" dot>Disconnected</Badge>
                  )}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Identifier: <strong className="text-slate-300">{device?.id || 'Not available'}</strong>
                </span>
                {device?.connectedAt && (
                  <span>
                    Connected: <strong className="text-slate-300">{new Date(device.connectedAt).toLocaleTimeString()}</strong>
                  </span>
                )}
                {device?.disconnectedAt && (
                  <span>
                    Disconnected: <strong className="text-slate-300">{new Date(device.disconnectedAt).toLocaleTimeString()}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {status === 'connected' ? (
              <>
                <button
                  onClick={() => disconnect()}
                  className="px-4 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-mono flex items-center gap-2 transition-colors"
                >
                  <Power className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
                <button
                  onClick={() => onNavigate('gatt')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <span>Open GATT Explorer</span>
                </button>
              </>
            ) : device ? (
              <>
                <button
                  onClick={handleReconnect}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Reconnect Device</span>
                </button>
                <button
                  onClick={handleRequestAndConnect}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <span>Select Another</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleRequestAndConnect}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                <Bluetooth className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} />
                <span>{isLoading ? 'Scanning Devices...' : 'Select & Connect Watch'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-800 rounded-xl p-5 text-xs text-rose-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Connection Notice: {errorMessage.includes('globally disabled') ? 'Web Bluetooth Globally Disabled' : 'Connection Error'}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-slate-400 hover:text-white font-mono text-xs"
              >
                Dismiss
              </button>
            </div>

            <p className="leading-relaxed font-mono">{errorMessage}</p>

            {errorMessage.toLowerCase().includes('globally disabled') && (
              <div className="bg-black/60 p-4 rounded-lg border border-rose-900/80 space-y-3 font-mono text-[11px] text-slate-300">
                <div className="font-bold text-amber-300">How to Resolve "Web Bluetooth API globally disabled":</div>
                <ul className="space-y-2 list-disc pl-5">
                  <li>
                    <strong>1. Check Incognito / Private Mode:</strong> Chromium (Chrome & Edge) permanently disables Web Bluetooth in Incognito/InPrivate tabs for privacy. If you are in an Incognito window, open <code className="text-cyan-300">http://localhost:5173</code> in a standard browser window.
                  </li>
                  <li>
                    <strong>2. Check Windows Bluetooth Radio:</strong> Press <code className="text-cyan-300">Win + A</code> on Windows and verify that the <strong>Bluetooth</strong> quick toggle is switched <strong>ON</strong>.
                  </li>
                  <li>
                    <strong>3. Browser Site Permissions:</strong> In Chrome/Edge, paste this address into your URL bar:
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-slate-900 px-2 py-1 rounded text-cyan-300 border border-slate-700">chrome://settings/content/bluetoothDevices</code>
                      <button
                        onClick={() => copyToClipboard('chrome://settings/content/bluetoothDevices', 'perm')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
                      >
                        {copiedSetting === 'perm' ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    Ensure <em>"Sites can ask to connect to Bluetooth devices"</em> is selected.
                  </li>
                  <li>
                    <strong>4. Browser Feature Flag:</strong> Open Chrome flags:
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-slate-900 px-2 py-1 rounded text-cyan-300 border border-slate-700">chrome://flags/#enable-web-bluetooth</code>
                      <button
                        onClick={() => copyToClipboard('chrome://flags/#enable-web-bluetooth', 'flag')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
                      >
                        {copiedSetting === 'flag' ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    Set to <strong>Enabled</strong> and click Relaunch.
                  </li>
                </ul>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-white font-bold block">✨ Native Android App Built & Ready:</span>
                    <span className="text-slate-400 block text-[10px]">
                      Install directly on your Android phone to use physical hardware BLE without browser restrictions.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/dizo-watch-lab.apk"
                      download="dizo-watch-lab.apk"
                      className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors shadow-sm inline-flex items-center gap-1.5"
                    >
                      <span>📥 Download Android APK</span>
                    </a>
                    <button
                      onClick={() => {
                        setMockMode(true);
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                    >
                      Mock Mode
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discovery Filter & Options Configuration */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span>Web Bluetooth Discovery Parameters</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Configures navigator.bluetooth.requestDevice()</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Filter Mode */}
            <div className="bg-lab-card/60 p-4 rounded-lg border border-lab-border space-y-3">
              <div className="text-slate-300 font-semibold">Discovery Filter Mode</div>

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
                  Recommended. Shows all nearby Bluetooth peripherals in browser chooser.
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
                  <span>Name Prefix Filter</span>
                </label>
                {discoveryMode === 'prefix' && (
                  <div className="pl-5 pt-1">
                    <input
                      type="text"
                      value={namePrefix}
                      onChange={(e) => setNamePrefix(e.target.value)}
                      placeholder="e.g. DIZO or Watch"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Optional Services Declaration (Critical for Web Bluetooth!) */}
            <div className="bg-lab-card/60 p-4 rounded-lg border border-lab-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-slate-300 font-semibold">Optional Services Filter</div>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {customOptionalServices.length} custom declared
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Web Bluetooth requires pre-declaring any service UUIDs your app plans to access later via GATT discovery.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUuidInput}
                  onChange={(e) => setNewUuidInput(e.target.value)}
                  placeholder="Enter 128-bit UUID (e.g. 000001ff-...)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                />
                <button
                  onClick={handleAddCustomUuid}
                  className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-slate-100 flex items-center gap-1 font-mono text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {uuidInputError && <div className="text-[11px] text-rose-400 font-mono">{uuidInputError}</div>}

              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {customOptionalServices.map((uuid) => (
                  <div
                    key={uuid}
                    className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded text-[11px] font-mono border border-slate-800 text-slate-300"
                  >
                    <span className="truncate">{uuid}</span>
                    <button
                      onClick={() => handleRemoveUuid(uuid)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 ml-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Conflict & Hardware Troubleshooting Guide (Section 15) */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Troubleshooting DIZO Watch D Connection Conflicts</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-lab-card/50 p-4 rounded-lg border border-lab-border/70 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <span>1. Single Client BLE Limit</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              BLE smartwatches act as peripherals and typically support <strong>only one active connection</strong> at a time.
              If the watch is bonded to the official DIZO app, Realme Link, or your phone's OS Bluetooth, disconnect or turn off Bluetooth on that phone first.
            </p>
          </div>

          <div className="bg-lab-card/50 p-4 rounded-lg border border-lab-border/70 space-y-2">
            <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <span>2. Wake Peripheral Display</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Many low-power smartwatches reduce BLE advertising intervals or disable GATT responses when sleeping.
              Press the physical crown/button on the DIZO Watch D to wake the display before scanning.
            </p>
          </div>

          <div className="bg-lab-card/50 p-4 rounded-lg border border-lab-border/70 space-y-2">
            <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <span>3. Battery Charge Check</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              If battery level is below 15%, the MCU power management unit may shut down Bluetooth radio transmission.
              Place the watch on its magnetic charger cable if discovery fails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
