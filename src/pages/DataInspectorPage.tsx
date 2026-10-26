import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { bytesToHex, formatHexDump } from '../utils/byteUtils';
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Download,
  Copy,
  Check,
  Filter,
  Search,
  Eye,
  Bell,
  Clock,
  Layers,
} from 'lucide-react';
import { NotificationEvent } from '../types/bluetooth';

export const DataInspectorPage: React.FC = () => {
  const { notifications, clearNotifications } = useBluetooth();

  const [isPaused, setIsPaused] = useState(false);
  const [filterCharUuid, setFilterCharUuid] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const displayedNotifications = isPaused
    ? notifications
    : notifications; // notifications already updated via React state

  const filteredEvents = displayedNotifications.filter((ev) => {
    if (!filterCharUuid.trim()) return true;
    const q = filterCharUuid.toLowerCase().trim();
    return (
      ev.characteristicUuid.toLowerCase().includes(q) ||
      ev.payloadHex.toLowerCase().includes(q) ||
      (ev.asciiPreview && ev.asciiPreview.toLowerCase().includes(q))
    );
  });

  const handleCopyHex = (id: string, hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportEventsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notifications, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dizo_notifications_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportEventsAsCsv = () => {
    const headers = ['ID', 'Timestamp', 'ISO Time', 'Service UUID', 'Characteristic UUID', 'Length', 'Payload (Hex)', 'ASCII'];
    const rows = notifications.map((e) => [
      e.id,
      e.timestamp.toString(),
      new Date(e.timestamp).toISOString(),
      `"${e.serviceUuid}"`,
      `"${e.characteristicUuid}"`,
      e.payloadLength.toString(),
      `"${e.payloadHex}"`,
      `"${(e.asciiPreview || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `dizo_notifications_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <span>Data Inspector & Notification Monitor</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Real-time inspection stream of Bluetooth GATT notification events, indication packets, and read payloads.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              isPaused
                ? 'bg-amber-950/80 border-amber-700 text-amber-200'
                : 'bg-lab-card hover:bg-slate-800 border-lab-border text-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={notifications.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-rose-950/60 border border-lab-border hover:border-rose-800 text-xs font-mono text-slate-300 hover:text-rose-200 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={exportEventsAsJson}
              disabled={notifications.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-300 disabled:opacity-40"
              title="Export captured notifications as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={exportEventsAsCsv}
              disabled={notifications.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-300 disabled:opacity-40"
              title="Export captured notifications as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and stats toolbar */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={filterCharUuid}
            onChange={(e) => setFilterCharUuid(e.target.value)}
            placeholder="Filter by UUID, Hex bytes, or ASCII text..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>
            Total Events: <strong className="text-white">{notifications.length}</strong>
          </span>
          <span>
            Filtered: <strong className="text-cyan-400">{filteredEvents.length}</strong>
          </span>
          {isPaused && (
            <Badge variant="warning" dot>
              STREAM PAUSED
            </Badge>
          )}
        </div>
      </div>

      {/* Notifications Table / Stream */}
      <div className="bg-lab-surface border border-lab-border rounded-xl overflow-hidden shadow-sm">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center space-y-3 font-mono">
            <Bell className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-slate-300 font-semibold text-sm">No Notification Packets Captured</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              To capture live packets, go to the <strong>GATT Explorer</strong>, find a characteristic with <strong>Notify</strong> or <strong>Indicate</strong> permissions (e.g. 0xFF03), and click <strong>Subscribe</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-lab-card/80 border-b border-lab-border text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Characteristic UUID</th>
                  <th className="px-4 py-3">Length</th>
                  <th className="px-4 py-3">Hex Payload</th>
                  <th className="px-4 py-3">ASCII / Decoded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lab-border/40">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-lab-card/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleTimeString()}.
                      {new Date(ev.timestamp).getMilliseconds().toString().padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-slate-300 font-medium">{ev.characteristicUuid}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{ev.payloadLength} B</td>
                    <td className="px-4 py-3 font-bold text-cyan-300 max-w-xs truncate" title={ev.payloadHex}>
                      {ev.payloadHex}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={ev.asciiPreview}>
                      <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                        {ev.asciiPreview || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => handleCopyHex(ev.id, ev.payloadHex)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center"
                        title="Copy hex payload"
                      >
                        {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[11px]"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Packet Inspection Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title="Packet Detailed Inspection"
          maxWidth="lg"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3 bg-lab-card p-3 rounded-lg border border-lab-border text-slate-300">
              <div>
                <span className="text-slate-500">Timestamp:</span>{' '}
                {new Date(selectedEvent.timestamp).toISOString()}
              </div>
              <div>
                <span className="text-slate-500">Length:</span> {selectedEvent.payloadLength} bytes
              </div>
              <div className="col-span-2 truncate">
                <span className="text-slate-500">Char UUID:</span> {selectedEvent.characteristicUuid}
              </div>
            </div>

            {/* Hex Dump */}
            <div className="space-y-1">
              <span className="text-slate-400 font-semibold">Hex Dump (Address | Hex | ASCII):</span>
              <div className="bg-black/90 p-3 rounded border border-slate-800 text-emerald-400 leading-relaxed overflow-x-auto">
                <pre>{formatHexDump(new Uint8Array(selectedEvent.payloadBytes))}</pre>
              </div>
            </div>

            {/* Decimal Representation */}
            <div className="space-y-1">
              <span className="text-slate-400 font-semibold">Decimal Byte Array (0-255):</span>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-200 break-words">
                [{selectedEvent.payloadBytes.join(', ')}]
              </div>
            </div>

            {/* UTF-8 Text Representation if printable */}
            {selectedEvent.utf8Preview && (
              <div className="space-y-1">
                <span className="text-slate-400 font-semibold">Decoded UTF-8 Text:</span>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-cyan-300 break-words">
                  "{selectedEvent.utf8Preview}"
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleCopyHex(selectedEvent.id, selectedEvent.payloadHex)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Raw Hex</span>
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <Modal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          title="Confirm Clear Notifications"
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs font-mono text-slate-300">
            <p>
              Are you sure you want to delete all {notifications.length} captured notification packets from memory and IndexedDB storage?
            </p>
            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await clearNotifications();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Clear All
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
