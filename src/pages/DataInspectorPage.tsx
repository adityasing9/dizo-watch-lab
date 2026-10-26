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
  Search,
  Bell,
  BellOff,
  Radio,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { NotificationEvent, GattCharacteristicInfo } from '../types/bluetooth';

export const DataInspectorPage: React.FC = () => {
  const {
    services,
    subscribeCharacteristic,
    unsubscribeCharacteristic,
    notifications,
    clearNotifications,
  } = useBluetooth();

  const [isPaused, setIsPaused] = useState(false);
  const [filterCharUuid, setFilterCharUuid] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [togglingCharUuid, setTogglingCharUuid] = useState<string | null>(null);

  // Discover all characteristics that support notification or indication
  const notifiableCharacteristics: { serviceUuid: string; char: GattCharacteristicInfo }[] = [];
  services.forEach((s) => {
    s.characteristics.forEach((c) => {
      if (c.properties.notify || c.properties.indicate) {
        notifiableCharacteristics.push({ serviceUuid: s.uuid, char: c });
      }
    });
  });

  const handleToggleSubscription = async (serviceUuid: string, char: GattCharacteristicInfo) => {
    setTogglingCharUuid(char.uuid);
    try {
      if (char.isNotifying) {
        await unsubscribeCharacteristic(serviceUuid, char.uuid);
      } else {
        await subscribeCharacteristic(serviceUuid, char.uuid);
      }
    } catch (err: any) {
      alert(`Subscription failed: ${err.message}`);
    } finally {
      setTogglingCharUuid(null);
    }
  };

  const displayedNotifications = isPaused ? notifications : notifications;

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

  const exportEventsAsText = () => {
    const lines = notifications.map(
      (e) =>
        `[${new Date(e.timestamp).toISOString()}] Char: ${e.characteristicUuid} | Len: ${e.payloadLength} | Hex: ${e.payloadHex} | ASCII: ${e.asciiPreview}`
    );
    const content = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', content);
    downloadAnchor.setAttribute('download', `dizo_notifications_${Date.now()}.txt`);
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
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-950/80 border border-yellow-800/80 px-2 py-0.5 rounded">
              Core Feature D • Telemetry Feed
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
              <Terminal className="w-6 h-6 text-yellow-400" />
              <span>Notification Monitor</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time packet inspection of Bluetooth GATT notification events and indication streams.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-bold transition-colors ${
                isPaused
                  ? 'bg-amber-950/80 border-amber-700 text-amber-200'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-yellow-400" />}
              <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={notifications.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-800 text-xs font-mono text-slate-300 hover:text-rose-200 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={exportEventsAsJson}
                disabled={notifications.length === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-yellow-400 font-bold disabled:opacity-40"
                title="Export captured notifications as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                onClick={exportEventsAsText}
                disabled={notifications.length === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 disabled:opacity-40"
                title="Export captured notifications as Text"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>TXT</span>
              </button>
              <button
                onClick={exportEventsAsCsv}
                disabled={notifications.length === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 disabled:opacity-40"
                title="Export captured notifications as CSV"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Characteristics that support notifications or indications */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Notification & Indication Channels
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {notifiableCharacteristics.length} available
          </span>
        </div>

        {notifiableCharacteristics.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-3 text-center bg-slate-900/40 rounded-xl border border-slate-800">
            Connect to watch and discover services to view notifiable channels.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {notifiableCharacteristics.map(({ serviceUuid, char }) => {
              const isToggling = togglingCharUuid === char.uuid;
              return (
                <div
                  key={char.uuid}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{char.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{char.uuid}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {char.properties.notify && <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-emerald-400">Notify</span>}
                      {char.properties.indicate && <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-purple-400">Indicate</span>}
                      {char.isNotifying && <span className="text-[9px] bg-yellow-950 text-yellow-400 px-1 py-0.2 rounded font-bold">Active</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleSubscription(serviceUuid, char)}
                    disabled={isToggling}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all shrink-0 ${
                      char.isNotifying
                        ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                        : 'bg-yellow-400 hover:bg-yellow-300 text-slate-950'
                    }`}
                  >
                    {isToggling ? '...' : char.isNotifying ? 'Unsubscribe' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and stats toolbar */}
      <div className="bg-lab-card border border-lab-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={filterCharUuid}
            onChange={(e) => setFilterCharUuid(e.target.value)}
            placeholder="Filter by UUID, Hex bytes, or ASCII text..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-yellow-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>
            Total Events: <strong className="text-white">{notifications.length}</strong>
          </span>
          <span>
            Filtered: <strong className="text-yellow-400">{filteredEvents.length}</strong>
          </span>
          {isPaused && (
            <Badge variant="warning" dot>
              STREAM PAUSED
            </Badge>
          )}
        </div>
      </div>

      {/* Scientific warning notice */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Scientist Principle:</strong> Do not claim incoming data represents heart rate, battery percentage, steps, or time until its payload format has been verified experimentally against the device display.
        </span>
      </div>

      {/* Notifications Table / Stream */}
      <div className="bg-lab-card border border-lab-border rounded-2xl overflow-hidden shadow-sm">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center space-y-3 font-mono">
            <Bell className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-slate-300 font-semibold text-sm">No Notification Packets Captured</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Subscribe to a characteristic above to start capturing live telemetry events.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 border-b border-lab-border text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Characteristic UUID</th>
                  <th className="px-4 py-3">Length</th>
                  <th className="px-4 py-3">Hex Payload</th>
                  <th className="px-4 py-3">ASCII / Preview</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lab-border/40">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleTimeString()}.
                      {new Date(ev.timestamp).getMilliseconds().toString().padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
                        {ev.characteristicUuid}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {ev.payloadLength} bytes
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-yellow-400 font-bold bg-black/60 px-2 py-0.5 rounded border border-yellow-900/30 text-[11px]">
                        {ev.payloadHex}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                      {ev.asciiPreview || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyHex(ev.id, ev.payloadHex)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Copy Hex"
                        >
                          {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setSelectedEvent(ev)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Packet Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title="Inspect Telemetry Event"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="text-slate-400">
              Source: <code className="text-yellow-300">{selectedEvent.characteristicUuid}</code>
            </div>
            <div className="text-slate-400">
              Time: <span className="text-slate-200">{new Date(selectedEvent.timestamp).toISOString()}</span>
            </div>
            <div className="bg-black/80 border border-slate-800 rounded p-3 text-emerald-400 leading-relaxed overflow-x-auto">
              <pre>{formatHexDump(selectedEvent.payloadBytes)}</pre>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Notification History"
      >
        <div className="space-y-3 font-mono text-xs">
          <p className="text-slate-300">
            Are you sure you want to clear all {notifications.length} captured notification events from memory?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await clearNotifications();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              Clear All Events
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
