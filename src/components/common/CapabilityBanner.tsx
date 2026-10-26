import React, { useState } from 'react';
import { useBluetooth } from '../../context/BluetoothContext';
import { ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, HelpCircle } from 'lucide-react';

export const CapabilityBanner: React.FC = () => {
  const { capability, isMockMode, setMockMode } = useBluetooth();
  const [expanded, setExpanded] = useState(false);

  if (!capability) return null;

  if (isMockMode) {
    return (
      <div className="bg-amber-950/40 border-b border-amber-800/60 px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Simulation / Mock Mode Active:</strong> Device data is simulated for automated testing & UI evaluation. No actual Bluetooth packets are being transmitted to real hardware.
          </span>
        </div>
        <button
          onClick={() => setMockMode(false)}
          className="px-2.5 py-1 rounded bg-amber-800/50 hover:bg-amber-700/60 text-amber-100 font-mono text-[11px] border border-amber-600/50 transition-colors"
        >
          Switch to Live Web Bluetooth
        </button>
      </div>
    );
  }

  if (capability.isSupported) {
    return null; // All good, no need to show intrusive alert
  }

  return (
    <div className="bg-rose-950/50 border-b border-rose-800/80 px-4 py-3 text-xs text-rose-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-rose-300 flex items-center gap-2">
              <span>Web Bluetooth is unavailable in this browser session</span>
              <span className="text-[10px] bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700 text-rose-200">
                {!capability.isSecureContext ? 'Insecure Context' : 'Unsupported Browser'}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {capability.reason || 'Browser lacks Web Bluetooth API.'}{' '}
              {!capability.isSecureContext && (
                <span>Accessing via LAN IP (e.g. http://192.168.x.x) disables Web Bluetooth security policies.</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800/60 border border-rose-700/80 text-rose-100 font-mono text-[11px] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How to Fix</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>
          <button
            onClick={() => setMockMode(true)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono text-[11px] transition-colors"
          >
            Enable Mock Mode
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-rose-800/50 space-y-2 text-slate-300 text-[11px]">
          <p className="font-medium text-slate-200">Recommended Steps to Enable Bluetooth Diagnostics:</p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-slate-300">
            {capability.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
            <li>
              <strong>Testing on Android Phone over Wi-Fi:</strong> Run{' '}
              <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300">adb reverse tcp:5173 tcp:5173</code> then open{' '}
              <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300">http://localhost:5173</code> on phone Chrome (localhost is a secure context!).
            </li>
            <li>
              Or in Chrome for Android: navigate to <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> and add your computer's LAN IP.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
