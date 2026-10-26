import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatHexDump, bytesToUtf8 } from '../utils/byteUtils';
import { formatUuidDisplay } from '../utils/uuidUtils';
import {
  Binary,
  ChevronDown,
  ChevronRight,
  Eye,
  Bell,
  BellOff,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Info,
  Terminal,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { GattCharacteristicInfo, GattServiceInfo } from '../types/bluetooth';

interface GattExplorerPageProps {
  onNavigate: (tabId: string) => void;
}

export const GattExplorerPage: React.FC<GattExplorerPageProps> = ({ onNavigate }) => {
  const {
    status,
    services,
    discoverServices,
    readCharacteristic,
    subscribeCharacteristic,
    unsubscribeCharacteristic,
  } = useBluetooth();

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const [inspectModalChar, setInspectModalChar] = useState<GattCharacteristicInfo | null>(null);
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const toggleService = (uuid: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [uuid]: prev[uuid] === undefined ? false : !prev[uuid],
    }));
  };

  const handleCopyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(uuid);
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  const handleRead = async (serviceUuid: string, charUuid: string) => {
    const key = `read-${serviceUuid}-${charUuid}`;
    setLoadingOperation(key);
    setOperationError(null);
    try {
      await readCharacteristic(serviceUuid, charUuid);
    } catch (err: any) {
      setOperationError(err.message || 'Read failed.');
    } finally {
      setLoadingOperation(null);
    }
  };

  const handleToggleNotify = async (char: GattCharacteristicInfo) => {
    const key = `notify-${char.serviceUuid}-${char.uuid}`;
    setLoadingOperation(key);
    setOperationError(null);
    try {
      if (char.isNotifying) {
        await unsubscribeCharacteristic(char.serviceUuid, char.uuid);
      } else {
        await subscribeCharacteristic(char.serviceUuid, char.uuid);
      }
    } catch (err: any) {
      setOperationError(err.message || 'Notification subscription failed.');
    } finally {
      setLoadingOperation(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Binary className="w-5 h-5 text-cyan-400" />
            <span>GATT Service Explorer</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Live discovery table of primary GATT services, characteristics, permissions, and values.
          </p>
        </div>

        {status === 'connected' && (
          <button
            onClick={() => discoverServices()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-200 transition-colors self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rediscover Services</span>
          </button>
        )}
      </div>

      {operationError && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{operationError}</span>
          <button onClick={() => setOperationError(null)} className="text-rose-400 hover:text-rose-100 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Disconnection Warning or Empty State */}
      {status !== 'connected' ? (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <Binary className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-semibold text-white">No Active GATT Session</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              GATT discovery requires an active Bluetooth Low Energy connection to the DIZO Watch D.
            </p>
          </div>
          <button
            onClick={() => onNavigate('connection')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-semibold transition-colors shadow-md"
          >
            Go to Device Connection
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center mx-auto text-cyan-400 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Enumerating GATT Services...</h3>
          <p className="text-xs text-slate-400 font-mono">
            Querying primary services and characteristics from the peripheral's attribute table.
          </p>
        </div>
      ) : (
        /* Discovered Services Tree */
        <div className="space-y-4">
          {services.map((service, sIndex) => {
            const isExpanded = expandedServices[service.uuid] !== false; // expanded by default
            const display = formatUuidDisplay(service.uuid);

            return (
              <div
                key={service.uuid}
                className="bg-lab-surface border border-lab-border rounded-xl overflow-hidden transition-all shadow-sm"
              >
                {/* Service Header Row */}
                <div
                  className="p-4 bg-lab-card/60 hover:bg-lab-card flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer border-b border-lab-border/60"
                  onClick={() => toggleService(service.uuid)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      className="p-1 rounded text-slate-400 hover:text-slate-200"
                      aria-label="Toggle service"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100">{service.name}</span>
                        {service.isStandard ? (
                          <Badge variant="info">Standard SIG</Badge>
                        ) : (
                          <Badge variant="neutral">Custom Vendor</Badge>
                        )}
                        {service.isObservedReference && (
                          <Badge variant="warning">Previously observed — verification required</Badge>
                        )}
                      </div>

                      <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                        <span>UUID: <code className="text-slate-300">{display.full}</code></span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUuid(service.uuid);
                          }}
                          className="text-slate-500 hover:text-cyan-400"
                          title="Copy service UUID"
                        >
                          {copiedUuid === service.uuid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-400">
                    <span className="bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded">
                      {service.characteristics.length} Characteristic{service.characteristics.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Characteristics Table */}
                {isExpanded && (
                  <div className="divide-y divide-lab-border/50">
                    {service.characteristics.length === 0 ? (
                      <div className="p-4 text-xs font-mono text-slate-500 italic">
                        No characteristics discovered or enumerated for this service.
                      </div>
                    ) : (
                      service.characteristics.map((char) => {
                        const charDisplay = formatUuidDisplay(char.uuid);
                        const isReadLoading = loadingOperation === `read-${service.uuid}-${char.uuid}`;
                        const isNotifyLoading = loadingOperation === `notify-${service.uuid}-${char.uuid}`;

                        return (
                          <div
                            key={char.uuid}
                            className="p-4 hover:bg-lab-card/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-xs text-slate-200">{char.name}</span>
                                {char.isStandard ? (
                                  <Badge variant="info">0x{char.normalizedUuid.substring(4, 8).toUpperCase()}</Badge>
                                ) : (
                                  <Badge variant="neutral">Vendor Char</Badge>
                                )}
                                {char.isObservedReference && (
                                  <Badge variant="warning">Previously observed — verification required</Badge>
                                )}
                                {char.isNotifying && (
                                  <Badge variant="success" dot>NOTIFYING</Badge>
                                )}
                              </div>

                              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-mono">
                                  UUID: <code className="text-slate-300">{char.uuid}</code>
                                </span>
                                <button
                                  onClick={() => handleCopyUuid(char.uuid)}
                                  className="text-slate-500 hover:text-cyan-400"
                                  title="Copy characteristic UUID"
                                >
                                  {copiedUuid === char.uuid ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {/* Permission Badges */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] uppercase font-mono text-slate-500 mr-1">Perms:</span>
                                {char.properties.read && <Badge variant="accent">Read</Badge>}
                                {char.properties.write && <Badge variant="warning">Write</Badge>}
                                {char.properties.writeWithoutResponse && <Badge variant="warning">WriteNoResp</Badge>}
                                {char.properties.notify && <Badge variant="success">Notify</Badge>}
                                {char.properties.indicate && <Badge variant="purple">Indicate</Badge>}
                              </div>

                              {/* Last Read Value Preview */}
                              {char.lastValueHex && (
                                <div className="mt-2 bg-slate-900/90 border border-slate-700/80 rounded p-2 text-xs font-mono flex flex-wrap items-center gap-3">
                                  <span className="text-slate-400 text-[10px]">VALUE:</span>
                                  <span className="text-cyan-300 font-bold">{char.lastValueHex}</span>
                                  {char.lastValueAscii && (
                                    <span className="text-slate-400 border-l border-slate-700 pl-3">
                                      "{char.lastValueAscii}"
                                    </span>
                                  )}
                                  <span className="text-slate-500 text-[10px] ml-auto">
                                    {char.lastReadTimestamp ? new Date(char.lastReadTimestamp).toLocaleTimeString() : ''}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Actions Buttons */}
                            <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
                              {char.properties.read && (
                                <button
                                  onClick={() => handleRead(service.uuid, char.uuid)}
                                  disabled={isReadLoading}
                                  className="px-2.5 py-1.5 rounded bg-lab-card hover:bg-slate-700 border border-lab-border text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                  title="Read value directly from peripheral"
                                >
                                  <Eye className={`w-3.5 h-3.5 ${isReadLoading ? 'animate-spin' : 'text-cyan-400'}`} />
                                  <span>{isReadLoading ? 'Reading...' : 'Read'}</span>
                                </button>
                              )}

                              {(char.properties.notify || char.properties.indicate) && (
                                <button
                                  onClick={() => handleToggleNotify(char)}
                                  disabled={isNotifyLoading}
                                  className={`px-2.5 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50 border ${
                                    char.isNotifying
                                      ? 'bg-emerald-950/80 hover:bg-rose-950/80 text-emerald-300 hover:text-rose-300 border-emerald-700'
                                      : 'bg-lab-card hover:bg-slate-700 text-slate-200 border-lab-border'
                                  }`}
                                  title={char.isNotifying ? 'Stop notifications' : 'Subscribe to notifications'}
                                >
                                  {char.isNotifying ? (
                                    <>
                                      <BellOff className="w-3.5 h-3.5 text-rose-400" />
                                      <span>Stop Notify</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bell className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Subscribe</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {char.lastValueHex && (
                                <button
                                  onClick={() => setInspectModalChar(char)}
                                  className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                                  title="Inspect full raw byte dump"
                                >
                                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Inspect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raw Byte Inspection Modal */}
      {inspectModalChar && (
        <Modal
          isOpen={Boolean(inspectModalChar)}
          onClose={() => setInspectModalChar(null)}
          title={`Raw Hex Dump: ${inspectModalChar.name}`}
          maxWidth="lg"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="text-slate-400">
              UUID: <code className="text-cyan-300">{inspectModalChar.uuid}</code>
            </div>

            <div className="bg-black/80 border border-slate-800 rounded p-3 overflow-x-auto text-emerald-400 text-xs leading-relaxed">
              <pre>
                {inspectModalChar.lastValueBytes
                  ? formatHexDump(inspectModalChar.lastValueBytes)
                  : '(No bytes recorded)'}
              </pre>
            </div>

            {/* Optional UTF-8 Interpretation View */}
            {inspectModalChar.lastValueBytes && inspectModalChar.lastValueBytes.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold">Optional UTF-8 Text Interpretation:</div>
                <div className="text-yellow-300 font-mono break-all">
                  {bytesToUtf8(inspectModalChar.lastValueBytes) || '(No printable UTF-8 characters)'}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  if (inspectModalChar.lastValueHex) {
                    navigator.clipboard.writeText(inspectModalChar.lastValueHex);
                  }
                }}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Hex</span>
              </button>
              <button
                onClick={() => setInspectModalChar(null)}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
