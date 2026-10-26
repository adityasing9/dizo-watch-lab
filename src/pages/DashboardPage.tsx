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
  RefreshCw,
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

  const totalCharacteristics = services.reduce((acc, s) => acc + s.characteristics.length, 0);

  const getTimeSyncBadge = () => {
    switch (timeSyncStatus) {
      case 'TIME_SYNC_VERIFIED':
        return <Badge variant="success" dot>VERIFIED ON WATCH</Badge>;
      case 'COMMAND_TESTED':
        return <Badge variant="warning" dot>COMMAND TESTED</Badge>;
      case 'CANDIDATE_COMMAND_IDENTIFIED':
        return <Badge variant="accent">CANDIDATE IDENTIFIED</Badge>;
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
      {/* Top Banner / Hero */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Watch className="w-64 h-64 text-cyan-400" />
        </div>

        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>DIZO Watch Lab</span>
              <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
                GATT Research Platform
              </span>
            </h1>
            {isMockMode && (
              <Badge variant="warning">Simulated Environment</Badge>
            )}
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Hardware protocol inspection and Bluetooth Low Energy diagnostic workstation designed specifically for the{' '}
            <strong className="text-white">DIZO Watch D</strong>. The immediate objective is to determine whether date and
            time can be synchronized over Bluetooth because the physical touchscreen is non-functional and the companion
            mobile app is no longer available.
          </p>

          <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
            <span className="bg-lab-card border border-lab-border px-2.5 py-1 rounded text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Safety Policy: Destructive & undocumented writes disabled by default
            </span>
          </div>
        </div>
      </div>

      {/* Primary Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bluetooth Capability Card */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Web Bluetooth API</span>
            {capability?.isSupported ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {capability?.isSupported ? 'Available & Active' : 'Unavailable'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate" title={capability?.browserInfo}>
              Context: {capability?.isSecureContext ? 'Secure (HTTPS/Local)' : 'Insecure (LAN HTTP)'}
            </div>
          </div>
        </div>

        {/* Connection State Card */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">GATT Connection</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white capitalize">{status}</div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {device ? device.name || 'Unnamed Device' : 'No target connected'}
            </div>
          </div>
        </div>

        {/* GATT Discovered Services & Chars Card */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">GATT Tree</span>
            <Binary className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {services.length} <span className="text-sm font-normal text-slate-400">Services</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {totalCharacteristics} Characteristics discovered
            </div>
          </div>
        </div>

        {/* Time Sync Investigation Goal Card */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Time Sync Goal</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <div className="mb-1">{getTimeSyncBadge()}</div>
            <div className="text-xs text-slate-400">Touchscreen recovery target</div>
          </div>
        </div>
      </div>

      {/* Target Device Telemetry Card */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-lab-border pb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Watch className="w-4 h-4 text-cyan-400" />
            <span>Target Hardware Profile: DIZO Watch D</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {device?.connected ? 'Live Session Active' : 'Offline / Standby'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-lab-card/60 p-3 rounded-lg border border-lab-border/60">
            <div className="text-slate-400 text-[11px] mb-1">Advertised Device Name</div>
            <div className="text-slate-100 font-semibold">{device?.name || 'Not available'}</div>
          </div>

          <div className="bg-lab-card/60 p-3 rounded-lg border border-lab-border/60">
            <div className="text-slate-400 text-[11px] mb-1">Browser Device Identifier</div>
            <div className="text-slate-100 font-semibold truncate" title={device?.id || 'Not available'}>
              {device?.id ? `${device.id.substring(0, 16)}...` : 'Not available'}
            </div>
          </div>

          <div className="bg-lab-card/60 p-3 rounded-lg border border-lab-border/60">
            <div className="text-slate-400 text-[11px] mb-1">Connection Timestamp</div>
            <div className="text-slate-100 font-semibold">
              {device?.connectedAt ? new Date(device.connectedAt).toLocaleTimeString() : 'Not available'}
            </div>
          </div>

          <div className="bg-lab-card/60 p-3 rounded-lg border border-lab-border/60">
            <div className="text-slate-400 text-[11px] mb-1">Notifications Captured</div>
            <div className="text-slate-100 font-semibold">{notifications.length} events</div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Engineering Notice:</strong> Properties such as battery percentage, signal strength (RSSI), or firmware
            version will only be populated when explicitly read from confirmed GATT characteristics (e.g. 0x2A19 or 0x2A26).
            DIZO Watch Lab strictly avoids fabricating simulated telemetry.
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Diagnostic Workflow Shortcuts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('connection')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-surface hover:bg-lab-card border border-lab-border hover:border-cyan-700/60 transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-cyan-300">
                <Bluetooth className="w-4 h-4 text-cyan-400" />
                <span>Device Connection</span>
              </div>
              <p className="text-xs text-slate-400">Request device & connect GATT server</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('gatt')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-surface hover:bg-lab-card border border-lab-border hover:border-cyan-700/60 transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-cyan-300">
                <Binary className="w-4 h-4 text-purple-400" />
                <span>GATT Explorer</span>
              </div>
              <p className="text-xs text-slate-400">Inspect services & read characteristics</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('time-sync')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-surface hover:bg-lab-card border border-cyan-800/60 hover:border-cyan-500 transition-all text-left group bg-gradient-to-br from-cyan-950/20 to-transparent"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-cyan-300 group-hover:text-cyan-200">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Time Sync Lab</span>
              </div>
              <p className="text-xs text-slate-300">Primary research & clock alignment</p>
            </div>
            <ArrowRight className="w-4 h-4 text-cyan-400 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onNavigate('logs')}
            className="flex items-center justify-between p-4 rounded-xl bg-lab-surface hover:bg-lab-card border border-lab-border hover:border-cyan-700/60 transition-all text-left group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 group-hover:text-cyan-300">
                <ScrollText className="w-4 h-4 text-emerald-400" />
                <span>Diagnostic Logs</span>
              </div>
              <p className="text-xs text-slate-400">Inspect events & export CSV/JSON</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Live Diagnostic Stream Feed */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Live Diagnostic Events</h2>
          </div>
          <button
            onClick={() => onNavigate('logs')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
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
                  className="bg-lab-card/70 border border-lab-border/70 rounded-lg p-2.5 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`text-[10px] font-bold ${levelColors[log.level]} shrink-0`}>
                      [{log.level}]
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded shrink-0">
                      {log.category}
                    </span>
                    <span className="text-slate-200 truncate">{log.message}</span>
                  </div>

                  {log.payloadHex && (
                    <span className="text-[11px] text-cyan-300 font-mono bg-black/40 px-2 py-0.5 rounded shrink-0">
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
