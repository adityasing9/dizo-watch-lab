import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import {
  Settings,
  HelpCircle,
  Smartphone,
  Wifi,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import { clearAllLogsFromDb, clearAllNotificationsFromDb } from '../services/storage/indexedDb';

export const SettingsHelpPage: React.FC = () => {
  const { capability, isMockMode, setMockMode, refreshCapability } = useBluetooth();
  const [activeSection, setActiveSection] = useState<'network' | 'android' | 'protocol' | 'storage'>('network');
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);

  const handleWipeAll = async () => {
    await clearAllLogsFromDb();
    await clearAllNotificationsFromDb();
    setWipeNotice('All local IndexedDB logs and notification records have been erased.');
    setTimeout(() => setWipeNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>Settings, Network Context & Android Conversion Architecture</span>
        </h1>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Platform compatibility diagnostics, secure context configuration for Android phones, and native BLE transition guide.
        </p>
      </div>

      {/* Browser Capability Diagnostic Report */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-4 shadow-sm font-mono text-xs">
        <div className="flex items-center justify-between border-b border-lab-border pb-3">
          <h2 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Browser Capability Diagnostic Report</span>
          </h2>
          <button
            onClick={() => refreshCapability()}
            className="text-cyan-400 hover:text-cyan-300 text-[11px] underline"
          >
            Re-evaluate
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border space-y-1">
            <div className="text-slate-400 text-[10px]">Web Bluetooth API</div>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              {capability?.hasDeviceChooser ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Supported (navigator.bluetooth)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">Unavailable / Disabled</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border space-y-1">
            <div className="text-slate-400 text-[10px]">Secure Context (isSecureContext)</div>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              {capability?.isSecureContext ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Secure (HTTPS or localhost)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">Insecure (LAN HTTP)</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border space-y-1">
            <div className="text-slate-400 text-[10px]">Diagnostic Operating Mode</div>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              {isMockMode ? (
                <span className="text-amber-300">Offline Simulation Mode</span>
              ) : (
                <span className="text-cyan-300">Live Web Bluetooth Client</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 p-3 rounded border border-slate-800 text-slate-400 text-[11px] truncate">
          User Agent: <code className="text-slate-300">{capability?.browserInfo}</code>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-lab-border gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveSection('network')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeSection === 'network'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Local Network & Phone Access</span>
        </button>

        <button
          onClick={() => setActiveSection('android')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeSection === 'android'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Android & Capacitor Plan</span>
        </button>

        <button
          onClick={() => setActiveSection('protocol')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeSection === 'protocol'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>DIZO Protocol Research</span>
        </button>

        <button
          onClick={() => setActiveSection('storage')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeSection === 'storage'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Storage & Reset</span>
        </button>
      </div>

      {/* Section 1: Network Context */}
      {activeSection === 'network' && (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-5 text-xs font-mono">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span>Development Server & LAN Access Architecture</span>
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Vite is configured with <code className="text-cyan-300">--host 0.0.0.0</code>, allowing responsive UI testing from your Android phone on the same Wi-Fi network.
              However, <strong>Web Bluetooth will be disabled by Android Chrome if opened over an insecure LAN IP (e.g. http://192.168.x.x:5173)</strong> because browsers mandate a Secure Context.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-lab-card/80 p-4 rounded-lg border border-lab-border space-y-3">
              <div className="font-bold text-cyan-300 flex items-center gap-2">
                <span>Option A: ADB Port Forwarding (Recommended)</span>
                <Badge variant="success">Zero Config SSL</Badge>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Connect your Android phone to your Windows laptop with a USB cable and run:
              </p>
              <pre className="bg-black/90 p-2.5 rounded border border-slate-800 text-emerald-400 text-[11px] overflow-x-auto">
                adb reverse tcp:5173 tcp:5173
              </pre>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Then open <strong className="text-white">http://localhost:5173</strong> directly in Chrome on your phone.
                Because the origin is <code>localhost</code>, Chrome treats it as a <strong>Secure Context</strong> and enables full Web Bluetooth!
              </p>
            </div>

            <div className="bg-lab-card/80 p-4 rounded-lg border border-lab-border space-y-3">
              <div className="font-bold text-amber-300 flex items-center gap-2">
                <span>Option B: Chrome Security Flag Override</span>
                <Badge variant="warning">Wireless Wi-Fi</Badge>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                If accessing over pure Wi-Fi without a USB cable:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[11px]">
                <li>Open <code className="text-cyan-300">chrome://flags</code> on your Android phone Chrome.</li>
                <li>Search for <strong>"Insecure origins treated as secure"</strong>.</li>
                <li>Add your laptop's IP: <code className="text-cyan-300">http://192.168.X.X:5173</code>.</li>
                <li>Relaunch Chrome on the phone.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Android & Capacitor Readiness */}
      {activeSection === 'android' && (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-5 text-xs font-mono">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Android Conversion Architecture (Capacitor / Native BLE)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              DIZO Watch Lab is engineered with strict separation between the UI and Bluetooth communications.
              All operations flow through the <code className="text-cyan-300">IBluetoothService</code> interface.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-slate-200 font-bold">Android Release Binary (APK):</div>
              <a
                href="/dizo-watch-lab.apk"
                download="dizo-watch-lab.apk"
                className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 text-xs font-mono"
              >
                <span>📥 Download DIZO Watch Lab APK (4.3 MB)</span>
              </a>
            </div>
            <div className="bg-lab-card p-4 rounded-lg border border-lab-border space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-emerald-400 font-bold mb-1">Web Bluetooth Capabilities (Current)</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    <li>Direct GATT discovery & read/write on Desktop Chrome/Edge</li>
                    <li>Zero-install diagnostic workstation</li>
                    <li>Full IndexedDB audit persistence</li>
                    <li>Instant iteration and packet inspection</li>
                  </ul>
                </div>
                <div>
                  <div className="text-cyan-400 font-bold mb-1">Native Android Additions (Via Capacitor Plugin)</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    <li>Background BLE connection & continuous synchronization</li>
                    <li>Direct access to Android <code className="text-slate-300">BluetoothGatt</code> without user chooser dialog</li>
                    <li>Full support for non-standard 128-bit UUIDs and raw advertising packets</li>
                    <li>Automatic re-connection on phone boot</li>
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-lab-border/60">
                <div className="font-bold text-slate-300 mb-1">Android Permissions Matrix:</div>
                <pre className="bg-black/90 p-3 rounded border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
{`<!-- AndroidManifest.xml for DIZO Watch Lab Native -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: DIZO Protocol Research */}
      {activeSection === 'protocol' && (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-5 text-xs font-mono">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>DIZO Watch D Chipset & Protocol Analysis</span>
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              The DIZO Watch D (and DW2111/DW2121 models) commonly utilizes Realtek RTL8762C / RTL8762D or Goodix BLE microcontrollers with customized firmware developed for companion applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-lab-card/80 p-4 rounded-lg border border-lab-border space-y-2">
              <div className="font-bold text-cyan-300">Standard Bluetooth CTS (0x1805)</div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                The open Bluetooth SIG Current Time Service. If present, it allows setting time with a 10-byte struct:
                <code className="block bg-slate-900 p-2 mt-1 rounded text-emerald-400">
                  [YearLo, YearHi, Month, Day, Hours, Mins, Secs, DayOfWeek, Frac, AdjustReason]
                </code>
              </p>
            </div>

            <div className="bg-lab-card/80 p-4 rounded-lg border border-lab-border space-y-2">
              <div className="font-bold text-purple-300">Vendor 0xFF02 / DaFit Protocol</div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Characteristic 0xFF02 is widely deployed across Realtek-based budget wearables as the main command pipe.
                Opcode 0x04 frequently represents the Set Time command, with notifications on 0xFF03 confirming reception.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Storage & Reset */}
      {activeSection === 'storage' && (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-5 text-xs font-mono">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>IndexedDB Diagnostic Storage Maintenance</span>
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              All diagnostic event logs, captured notifications, and structured protocol experiments are stored entirely on your local machine using browser IndexedDB.
              No telemetry, tracking, or cloud database is used.
            </p>
          </div>

          {wipeNotice && (
            <div className="bg-emerald-950/60 border border-emerald-800 rounded p-3 text-emerald-300">
              {wipeNotice}
            </div>
          )}

          <div className="bg-lab-card p-4 rounded-lg border border-lab-border space-y-3">
            <div className="font-bold text-rose-300">Danger Zone: Permanent Reset</div>
            <p className="text-slate-400 text-[11px]">
              Erases all recorded experiments, notification logs, and diagnostic entries from this browser.
            </p>
            <button
              onClick={handleWipeAll}
              className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
            >
              Wipe All Local Diagnostic Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
