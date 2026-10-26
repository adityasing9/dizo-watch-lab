import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { logger } from '../services/diagnostics/diagnosticLogger';
import { DiagnosticLog } from '../types/diagnostics';
import {
  Watch,
  Bluetooth,
  Binary,
  ScrollText,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Terminal,
  ShieldCheck,
  KeyRound,
  FlaskConical,
  Bell,
  Eye,
  FileCode,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tabId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const {
    status,
    device,
    services,
    capability,
    notifications,
    timeSyncStatus,
    experiments,
    isMockMode,
  } = useBluetooth();

  const [recentLogs, setRecentLogs] = useState<DiagnosticLog[]>([]);

  useEffect(() => {
    setRecentLogs(logger.getLogs().slice(0, 6));
    const unsub = logger.subscribe((newLog) => {
      setRecentLogs((prev) => [newLog, ...prev.slice(0, 5)]);
    });
    return unsub;
  }, []);

  // Compute exact metrics required by specification
  const totalCharacteristics = services.reduce((acc, s) => acc + s.characteristics.length, 0);

  const readableCharacteristicsCount = services.reduce(
    (acc, s) => acc + s.characteristics.filter((c) => c.properties.read).length,
    0
  );

  const writableCharacteristicsCount = services.reduce(
    (acc, s) =>
      acc +
      s.characteristics.filter((c) => c.properties.write || c.properties.writeWithoutResponse).length,
    0
  );

  const activeNotificationSubscriptionsCount = services.reduce(
    (acc, s) => acc + s.characteristics.filter((c) => c.isNotifying).length,
    0
  );

  const getConnectionStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge variant="success" dot>CONNECTED</Badge>;
      case 'connecting':
        return <Badge variant="warning" dot>CONNECTING</Badge>;
      case 'disconnecting':
        return <Badge variant="warning" dot>DISCONNECTING</Badge>;
      case 'error':
        return <Badge variant="danger" dot>CONNECTION ERROR</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="neutral" dot>DISCONNECTED</Badge>;
    }
  };

  const getPairingAssistantBadge = () => {
    return <Badge variant="yellow" dot>RECOVERY READY</Badge>;
  };

  const getTimeSyncBadge = () => {
    switch (timeSyncStatus) {
      case 'TIME_SYNC_VERIFIED':
        return <Badge variant="success" dot>VERIFIED ON WATCH</Badge>;
      case 'COMMAND_TESTED':
        return <Badge variant="warning" dot>COMMAND TESTED</Badge>;
      case 'CANDIDATE_COMMAND_IDENTIFIED':
        return <Badge variant="yellow">CANDIDATE IDENTIFIED</Badge>;
      case 'POSSIBLE_CHARACTERISTIC_IDENTIFIED':
        return <Badge variant="info">POSSIBLE CHAR FOUND</Badge>;
      case 'INVESTIGATION_IN_PROGRESS':
        return <Badge variant="warning">INVESTIGATING</Badge>;
      case 'UNSUPPORTED_OR_UNRESOLVED':
        return <Badge variant="danger">UNRESOLVED</Badge>;
      case 'NOT_INVESTIGATED':
      default:
        return <Badge variant="neutral">NOT INVESTIGATED</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero with Broken Touchscreen Objective */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Watch className="w-64 h-64 text-yellow-400" />
        </div>

        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>DIZO Watch Lab</span>
              <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-950/80 border border-yellow-800/80 px-2 py-0.5 rounded">
                GATT Research Platform & Recovery Toolkit
              </span>
            </h1>
            {isMockMode && <Badge variant="warning">Simulated Environment</Badge>}
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Open-source Bluetooth Low Energy diagnostic and recovery workbench built specifically for the{' '}
            <strong className="text-white">DIZO Watch D</strong>. Engineered to investigate and bypass the on-screen
            phone-binding confirmation prompt without relying on the broken touchscreen, while maintaining reproducible
            scientific rigor.
          </p>

          <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
            <span className="bg-lab-card border border-lab-border px-2.5 py-1 rounded text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Safety Interlock: Unverified & destructive writes strictly prohibited
            </span>
          </div>
        </div>
      </div>

      {/* Primary Status Metric Cards (Specification Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Connection Status & Device Name */}
        <div className="bg-lab-card border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Device Connection</span>
            {getConnectionStatusBadge()}
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white truncate">
              {device ? device.name || 'DIZO Watch D' : 'No Device Selected'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate font-mono">
              Status: <span className="text-slate-200 capitalize">{status}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Discovered Services */}
        <div className="bg-lab-card border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">GATT Services</span>
            <Binary className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {services.length} <span className="text-xs font-normal text-slate-400">Discovered</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Total: {totalCharacteristics} Characteristics
            </div>
          </div>
        </div>

        {/* Metric 3: Readable vs Writable Characteristics */}
        <div className="bg-lab-card border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Permissions Matrix</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {readableCharacteristicsCount} <span className="text-xs font-normal text-slate-400">Read</span> /{' '}
              <span className="text-yellow-400">{writableCharacteristicsCount}</span>{' '}
              <span className="text-xs font-normal text-slate-400">Write</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              GATT endpoints available
            </div>
          </div>
        </div>

        {/* Metric 4: Active Subscriptions & Research Status */}
        <div className="bg-lab-card border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Telemetry & Research</span>
            <Bell className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {activeNotificationSubscriptionsCount} <span className="text-xs font-normal text-slate-400">Active Subs</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Experiments: <span className="text-yellow-400">{experiments.length} logged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Highest-Priority Recovery Card: Pairing Assistant Shortcut */}
      <div className="bg-gradient-to-r from-yellow-950/40 via-lab-card to-lab-card border border-yellow-700/60 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-yellow-400" />
              <span className="text-base font-bold text-white">Core Feature C: Pairing Assistant</span>
              {getPairingAssistantBadge()}
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Touchscreen broken and stuck on &ldquo;Accept Phone Binding&rdquo;? The Pairing Assistant monitors status registers and provides experimental command pathways to accept pairing over BLE.
            </p>
          </div>

          <button
            onClick={() => onNavigate('pairing')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-mono text-xs font-bold transition-all shadow-md shrink-0"
          >
            <span>Launch Binding Recovery & Rotate 180°</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Device Telemetry Card */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-lab-border pb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-mono">
            <Watch className="w-4 h-4 text-yellow-400" />
            <span>Target Hardware Profile: DIZO Watch D</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {device?.connected ? 'Live Session Active' : 'Offline / Standby'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Advertised Device Name</div>
            <div className="text-slate-100 font-semibold">{device?.name || 'Not available'}</div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Browser Device Identifier</div>
            <div className="text-slate-100 font-semibold truncate" title={device?.id || 'Not available'}>
              {device?.id ? `${device.id.substring(0, 16)}...` : 'Not available'}
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Connection Timestamp</div>
            <div className="text-slate-100 font-semibold">
              {device?.connectedAt ? new Date(device.connectedAt).toLocaleTimeString() : 'Not available'}
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Notifications Captured</div>
            <div className="text-slate-100 font-semibold">{notifications.length} events</div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Scientist Principle:</strong> Properties such as battery percentage, signal strength (RSSI), or firmware
            version will only be populated when explicitly read from confirmed GATT characteristics (e.g. 0x2A19 or 0x2A26).
            DIZO Watch Lab strictly avoids fabricating simulated telemetry.
          </span>
        </div>
      </div>

      {/* Navigation Quick Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Diagnostic Workflow Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('connect')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-card hover:border-yellow-400/60 border border-lab-border transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-yellow-300 font-mono">
                <Bluetooth className="w-4 h-4 text-yellow-400" />
                <span>Device Connect</span>
              </div>
              <p className="text-xs text-slate-400">Request device & connect GATT server</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-yellow-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('gatt')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-card hover:border-yellow-400/60 border border-lab-border transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-yellow-300 font-mono">
                <Binary className="w-4 h-4 text-sky-400" />
                <span>GATT Explorer</span>
              </div>
              <p className="text-xs text-slate-400">Inspect services & read characteristics</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('protocol-research')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-card hover:border-yellow-400/60 border border-lab-border transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-yellow-300 font-mono">
                <FlaskConical className="w-4 h-4 text-purple-400" />
                <span>Protocol Research</span>
              </div>
              <p className="text-xs text-slate-400">State diffing & byte-by-byte delta</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('time-sync')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-card hover:border-yellow-400/60 border border-lab-border transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-yellow-300 font-mono">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Date & Time Sync</span>
              </div>
              <p className="text-xs text-slate-400">Host clock alignment & verification</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Live Diagnostic Stream Feed */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white font-mono">Live Diagnostic Audit Trail</h2>
          </div>
          <button
            onClick={() => onNavigate('logs')}
            className="text-xs font-mono text-yellow-400 hover:text-yellow-300 flex items-center gap-1 font-bold"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No diagnostic events recorded yet. Connect a device or test a characteristic to see live logs.
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => {
              const levelColors = {
                INFO: 'text-sky-400',
                SUCCESS: 'text-emerald-400',
                WARNING: 'text-amber-400',
                ERROR: 'text-rose-400',
              };

              return (
                <div
                  key={log.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`text-[10px] font-bold ${levelColors[log.level]} shrink-0`}>
                      [{log.level}]
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded shrink-0 border border-slate-800">
                      {log.category}
                    </span>
                    <span className="text-slate-200 truncate">{log.message}</span>
                  </div>

                  {log.payloadHex && (
                    <span className="text-[11px] text-yellow-400 font-mono bg-black/60 px-2 py-0.5 rounded shrink-0 border border-yellow-900/40">
                      {log.payloadHex}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
