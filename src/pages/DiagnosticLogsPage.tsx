import React, { useState, useEffect } from 'react';
import { logger } from '../services/diagnostics/diagnosticLogger';
import { DiagnosticLog, LogCategory, LogFilter, LogLevel } from '../types/diagnostics';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  ScrollText,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
} from 'lucide-react';

export const DiagnosticLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    searchQuery: '',
    levels: [],
    category: 'ALL',
  });
  const [selectedLog, setSelectedLog] = useState<DiagnosticLog | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const refreshLogs = () => {
    setLogs(logger.getLogs());
  };

  useEffect(() => {
    refreshLogs();
    const unsub = logger.subscribe((newLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });
    return unsub;
  }, []);

  const filteredLogs = logger.filterLogs(logs, filter);

  const toggleLevelFilter = (lvl: LogLevel) => {
    setFilter((prev) => {
      const exists = prev.levels.includes(lvl);
      return {
        ...prev,
        levels: exists ? prev.levels.filter((l) => l !== lvl) : [...prev.levels, lvl],
      };
    });
  };

  const handleCopyLogJson = (log: DiagnosticLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const handleExportJson = () => {
    const json = logger.exportAsJson(filteredLogs);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dizo_diagnostic_logs_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportCsv = () => {
    const csv = logger.exportAsCsv(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dizo_diagnostic_logs_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClearLogs = async () => {
    await logger.clear();
    setLogs(logger.getLogs());
    setShowClearModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-400" />
            <span>Diagnostic Event Logging</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Persisted IndexedDB audit log of Bluetooth state transitions, GATT operations, reads, notifications, and errors.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setShowClearModal(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-rose-950/60 border border-lab-border hover:border-rose-800 text-xs font-mono text-slate-300 hover:text-rose-200 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-300 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-300 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-4 space-y-4 shadow-sm text-xs font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={filter.searchQuery}
              onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
              placeholder="Search message, UUID, or payload hex..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
            />
          </div>

          {/* Category selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Category:</span>
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 outline-none font-mono"
            >
              <option value="ALL">All Categories</option>
              <option value="SYSTEM">SYSTEM</option>
              <option value="BLUETOOTH">BLUETOOTH</option>
              <option value="GATT">GATT</option>
              <option value="READ">READ</option>
              <option value="WRITE">WRITE</option>
              <option value="NOTIFY">NOTIFY</option>
              <option value="TIME_SYNC">TIME_SYNC</option>
            </select>
          </div>
        </div>

        {/* Level pills & counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-lab-border/50">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Severity Filter:</span>
            {(['INFO', 'SUCCESS', 'WARNING', 'ERROR'] as LogLevel[]).map((lvl) => {
              const active = filter.levels.includes(lvl);
              const colorMap: Record<LogLevel, string> = {
                INFO: active ? 'bg-sky-600 text-white' : 'bg-slate-900 text-sky-400 border border-sky-800/60',
                SUCCESS: active ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-emerald-400 border border-emerald-800/60',
                WARNING: active ? 'bg-amber-600 text-white' : 'bg-slate-900 text-amber-400 border border-amber-800/60',
                ERROR: active ? 'bg-rose-600 text-white' : 'bg-slate-900 text-rose-400 border border-rose-800/60',
              };

              return (
                <button
                  key={lvl}
                  onClick={() => toggleLevelFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${colorMap[lvl]}`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          <div className="text-slate-400">
            Showing <strong className="text-white">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-300">{logs.length}</strong> events
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-lab-surface border border-lab-border rounded-xl overflow-hidden shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-slate-500">
            No diagnostic events matched your active filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-lab-card border-b border-lab-border text-slate-400 uppercase text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">UUID / Target</th>
                  <th className="px-4 py-3">Payload (Hex)</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lab-border/30">
                {filteredLogs.map((log) => {
                  const levelBadgeVariant: Record<LogLevel, 'info' | 'success' | 'warning' | 'danger'> = {
                    INFO: 'info',
                    SUCCESS: 'success',
                    WARNING: 'warning',
                    ERROR: 'danger',
                  };

                  return (
                    <tr key={log.id} className="hover:bg-lab-card/40 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={levelBadgeVariant[log.level]}>{log.level}</Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-300 font-semibold">
                        {log.category}
                      </td>
                      <td className="px-4 py-2.5 text-slate-100 max-w-sm truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 max-w-xs truncate" title={log.characteristicUuid || log.serviceUuid || ''}>
                        {log.characteristicUuid ? (
                          <code>{log.characteristicUuid.substring(0, 8)}...</code>
                        ) : log.serviceUuid ? (
                          <code>{log.serviceUuid.substring(0, 8)}...</code>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-cyan-300 max-w-xs truncate font-bold" title={log.payloadHex || ''}>
                        {log.payloadHex || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Diagnostic Log Detail"
          maxWidth="md"
        >
          <div className="space-y-3 font-mono text-xs text-slate-300">
            <div className="bg-lab-card p-3 rounded border border-lab-border space-y-2">
              <div>
                <span className="text-slate-500">ID:</span> {selectedLog.id}
              </div>
              <div>
                <span className="text-slate-500">ISO Timestamp:</span> {new Date(selectedLog.timestamp).toISOString()}
              </div>
              <div>
                <span className="text-slate-500">Severity:</span>{' '}
                <strong className="text-white">{selectedLog.level}</strong>
              </div>
              <div>
                <span className="text-slate-500">Category:</span> {selectedLog.category}
              </div>
              <div>
                <span className="text-slate-500">Message:</span>{' '}
                <div className="text-slate-100 mt-1 font-sans">{selectedLog.message}</div>
              </div>
              {selectedLog.serviceUuid && (
                <div>
                  <span className="text-slate-500">Service UUID:</span> <code>{selectedLog.serviceUuid}</code>
                </div>
              )}
              {selectedLog.characteristicUuid && (
                <div>
                  <span className="text-slate-500">Characteristic UUID:</span> <code>{selectedLog.characteristicUuid}</code>
                </div>
              )}
              {selectedLog.payloadHex && (
                <div>
                  <span className="text-slate-500">Payload:</span>{' '}
                  <code className="text-cyan-300 font-bold">{selectedLog.payloadHex}</code>
                </div>
              )}
              {selectedLog.details && (
                <div>
                  <span className="text-slate-500">Additional Details:</span>
                  <pre className="bg-black/60 p-2 rounded mt-1 text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleCopyLogJson(selectedLog)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
              >
                {copiedLogId === selectedLog.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy JSON</span>
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <Modal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          title="Clear Diagnostic Log History"
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs font-mono text-slate-300">
            <p>
              Are you sure you want to permanently erase all {logs.length} diagnostic events from IndexedDB storage?
            </p>
            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Erase All
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
