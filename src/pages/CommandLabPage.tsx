import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  calculateChecksum8,
  calculateCrc16Ccitt,
  calculateXorChecksum,
  hexToBytes,
  bytesToHex,
  formatHexDump,
  bytesToAscii,
} from '../utils/byteUtils';
import {
  FlaskConical,
  ShieldAlert,
  Send,
  Eye,
  Calculator,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  FileCode,
  BookOpen,
} from 'lucide-react';
import { GattCharacteristicInfo } from '../types/bluetooth';

export const CommandLabPage: React.FC = () => {
  const {
    status,
    services,
    writeCharacteristic,
    readCharacteristic,
    addExperiment,
  } = useBluetooth();

  // Selected characteristic
  const [selectedServiceUuid, setSelectedServiceUuid] = useState<string>('');
  const [selectedCharUuid, setSelectedCharUuid] = useState<string>('');

  // Write builder
  const [hexInput, setHexInput] = useState<string>('');
  const [intendedPurpose, setIntendedPurpose] = useState<string>('');
  const [writeType, setWriteType] = useState<'write' | 'writeWithoutResponse'>('write');

  // Safety unlocks
  const [isSafetyLockEngaged, setIsSafetyLockEngaged] = useState<boolean>(true);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<boolean>(false);
  const [executionStatus, setExecutionStatus] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Available characteristics with write permissions
  const writableCharacteristics: { serviceUuid: string; char: GattCharacteristicInfo }[] = [];
  services.forEach((s) => {
    s.characteristics.forEach((c) => {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        writableCharacteristics.push({ serviceUuid: s.uuid, char: c });
      }
    });
  });

  const parsedPayload = hexToBytes(hexInput);
  const payloadBytes = parsedPayload.bytes;
  const payloadHexFormatted = bytesToHex(payloadBytes);

  // Checksums on the input
  const sum8 = payloadBytes.length > 0 ? calculateChecksum8(payloadBytes) : 0;
  const xor8 = payloadBytes.length > 0 ? calculateXorChecksum(payloadBytes) : 0;
  const crc16 = payloadBytes.length > 0 ? calculateCrc16Ccitt(payloadBytes) : 0;

  const handleSelectCharacteristic = (serviceUuid: string, charUuid: string) => {
    setSelectedServiceUuid(serviceUuid);
    setSelectedCharUuid(charUuid);

    const s = services.find((serv) => serv.uuid === serviceUuid);
    const c = s?.characteristics.find((ch) => ch.uuid === charUuid);
    if (c) {
      if (c.properties.write) {
        setWriteType('write');
      } else if (c.properties.writeWithoutResponse) {
        setWriteType('writeWithoutResponse');
      }
    }
  };

  const handleExecuteWrite = async () => {
    if (!selectedServiceUuid || !selectedCharUuid || payloadBytes.length === 0) return;
    setIsExecuting(true);
    setExecutionStatus(null);

    try {
      await writeCharacteristic(selectedServiceUuid, selectedCharUuid, payloadBytes, writeType);

      // Record experiment log
      await addExperiment({
        title: `Safe Write: ${payloadBytes.length} bytes to ${selectedCharUuid.substring(0, 8)}...`,
        hypothesis: intendedPurpose || 'Testing MCU response to structured command payload',
        serviceUuid: selectedServiceUuid,
        characteristicUuid: selectedCharUuid,
        action: 'WRITE_TEST',
        inputPayloadHex: payloadHexFormatted,
        result: 'SUCCESS',
        confidence: 'LOW',
        watchTimeVerified: false,
        notes: `Executed ${writeType} with ${payloadBytes.length} bytes. Check notification stream for response.`,
      });

      setExecutionStatus('Write command transmitted successfully! Check Data Inspector for peripheral responses.');
      setIsConfirmationModalOpen(false);
    } catch (err: any) {
      setExecutionStatus(`Write failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-cyan-400" />
          <span>Safe Command Laboratory</span>
        </h1>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Reverse engineering and protocol inspection framework with strict two-stage safety controls against destructive commands.
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-xs font-mono text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-amber-300">Safety First: Safe Diagnostic Mode</div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Smartwatches without touchscreen controls can enter unrecoverable bootloops if sent random or corrupt firmware packets.
            This laboratory enforces <strong>explicit characteristic selection</strong>, <strong>payload preview</strong>, and
            <strong>manual safety release</strong> before any write operation is permitted.
          </p>
        </div>
      </div>

      {/* Main Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Target Characteristic & Payload Editor */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>1. Target Characteristic & Payload</span>
          </h2>

          {/* Characteristic Selector */}
          <div className="space-y-2 text-xs font-mono">
            <label className="text-slate-300 font-semibold">Select Destination Characteristic:</label>
            {status !== 'connected' ? (
              <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-slate-500">
                Connect watch first to populate writable characteristics.
              </div>
            ) : writableCharacteristics.length === 0 ? (
              <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-slate-400">
                No characteristics with write permissions discovered on this peripheral.
              </div>
            ) : (
              <select
                value={selectedCharUuid ? `${selectedServiceUuid}|${selectedCharUuid}` : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [s, c] = e.target.value.split('|');
                    handleSelectCharacteristic(s, c);
                  } else {
                    setSelectedServiceUuid('');
                    setSelectedCharUuid('');
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
              >
                <option value="">-- Choose Writable Characteristic --</option>
                {writableCharacteristics.map(({ serviceUuid, char }) => (
                  <option key={`${serviceUuid}|${char.uuid}`} value={`${serviceUuid}|${char.uuid}`}>
                    {char.name} ({char.uuid.substring(0, 8)}...) - [
                    {char.properties.write ? 'Write' : ''}
                    {char.properties.write && char.properties.writeWithoutResponse ? '/' : ''}
                    {char.properties.writeWithoutResponse ? 'NoResp' : ''}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Write Type Choice */}
          <div className="space-y-2 text-xs font-mono">
            <label className="text-slate-300 font-semibold">GATT Write Type:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="writeType"
                  value="write"
                  checked={writeType === 'write'}
                  onChange={() => setWriteType('write')}
                  className="accent-cyan-500"
                />
                <span>With Response (Handshake ACK)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="writeType"
                  value="writeWithoutResponse"
                  checked={writeType === 'writeWithoutResponse'}
                  onChange={() => setWriteType('writeWithoutResponse')}
                  className="accent-cyan-500"
                />
                <span>Without Response (Stream)</span>
              </label>
            </div>
          </div>

          {/* Hex Input */}
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-semibold">Hexadecimal Payload:</label>
              <span className="text-cyan-400">{payloadBytes.length} bytes</span>
            </div>
            <textarea
              rows={3}
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="e.g. 04 07 E7 0A 1A 0C 1E 00 (space-separated or raw hex)"
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 outline-none font-mono"
            />
            {parsedPayload.error && (
              <p className="text-[11px] text-rose-400">{parsedPayload.error}</p>
            )}
          </div>

          {/* Intended Purpose Field */}
          <div className="space-y-2 text-xs font-mono">
            <label className="text-slate-300 font-semibold">Document Intended Purpose / Hypothesis:</label>
            <input
              type="text"
              value={intendedPurpose}
              onChange={(e) => setIntendedPurpose(e.target.value)}
              placeholder="e.g. Testing opcode 0x04 time sync on DaFit service"
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 outline-none"
            />
          </div>

          {/* Preset Diagnostic Payloads */}
          <div className="space-y-2 text-xs font-mono pt-2">
            <label className="text-slate-400 text-[11px] uppercase tracking-wider">Quick Preset Templates:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHexInput('AA 01 00 00 AB');
                  setIntendedPurpose('Standard Ping / Heartbeat probe');
                }}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px]"
              >
                Ping (AA 01 00)
              </button>
              <button
                type="button"
                onClick={() => {
                  // CTS time payload for current moment
                  const now = new Date();
                  const year = now.getFullYear();
                  const bytes = [
                    year & 0xff,
                    (year >> 8) & 0xff,
                    now.getMonth() + 1,
                    now.getDate(),
                    now.getHours(),
                    now.getMinutes(),
                    now.getSeconds(),
                    now.getDay() || 7,
                    0,
                    1,
                  ];
                  setHexInput(bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
                  setIntendedPurpose('Bluetooth SIG CTS 10-byte Current Time packet');
                }}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px]"
              >
                10-byte CTS Payload
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Analysis, Checksums & Safety Controls */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-400" />
              <span>2. Packet Analysis & Checksum Engine</span>
            </h2>

            {/* Checksums */}
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-lab-card/80 p-3 rounded-lg border border-lab-border">
                <div className="text-slate-400 text-[10px] mb-1">SUM8 (Mod 256)</div>
                <div className="text-white font-bold text-sm">
                  0x{sum8.toString(16).padStart(2, '0').toUpperCase()} ({sum8})
                </div>
              </div>

              <div className="bg-lab-card/80 p-3 rounded-lg border border-lab-border">
                <div className="text-slate-400 text-[10px] mb-1">XOR Checksum</div>
                <div className="text-white font-bold text-sm">
                  0x{xor8.toString(16).padStart(2, '0').toUpperCase()} ({xor8})
                </div>
              </div>

              <div className="bg-lab-card/80 p-3 rounded-lg border border-lab-border">
                <div className="text-slate-400 text-[10px] mb-1">CRC-16 CCITT</div>
                <div className="text-white font-bold text-sm">
                  0x{crc16.toString(16).padStart(4, '0').toUpperCase()}
                </div>
              </div>
            </div>

            {/* ASCII & Byte breakdown preview */}
            <div className="space-y-2 text-xs font-mono">
              <div className="text-slate-300 font-semibold">ASCII Translation:</div>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-300 break-words">
                {payloadBytes.length > 0 ? bytesToAscii(payloadBytes) : '(empty)'}
              </div>
            </div>

            {/* Hex Dump */}
            <div className="space-y-2 text-xs font-mono">
              <div className="text-slate-300 font-semibold">Memory Dump:</div>
              <div className="bg-black/90 p-3 rounded border border-slate-800 text-emerald-400 text-[11px] leading-relaxed overflow-x-auto">
                <pre>{formatHexDump(payloadBytes)}</pre>
              </div>
            </div>

            {executionStatus && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-cyan-300">
                {executionStatus}
              </div>
            )}
          </div>

          {/* Safety Interlock and Execute Button */}
          <div className="pt-4 border-t border-lab-border space-y-4">
            <div className="flex items-center justify-between bg-lab-card/60 p-3 rounded-lg border border-lab-border text-xs font-mono">
              <div className="flex items-center gap-2">
                {isSafetyLockEngaged ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-rose-400" />
                )}
                <span className={isSafetyLockEngaged ? 'text-amber-300' : 'text-rose-300 font-bold'}>
                  {isSafetyLockEngaged ? 'Safety Interlock Engaged' : 'Safety Interlock Disengaged'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSafetyLockEngaged(!isSafetyLockEngaged)}
                className={`px-3 py-1 rounded text-[11px] font-mono border transition-colors ${
                  isSafetyLockEngaged
                    ? 'bg-amber-950/60 hover:bg-amber-900 border-amber-800 text-amber-200'
                    : 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-200'
                }`}
              >
                {isSafetyLockEngaged ? 'Disengage Interlock' : 'Engage Lock'}
              </button>
            </div>

            <button
              type="button"
              disabled={
                isSafetyLockEngaged ||
                status !== 'connected' ||
                !selectedCharUuid ||
                payloadBytes.length === 0
              }
              onClick={() => setIsConfirmationModalOpen(true)}
              className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <Send className="w-4 h-4" />
              <span>Review & Execute Safe Write</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmationModalOpen && (
        <Modal
          isOpen={isConfirmationModalOpen}
          onClose={() => setIsConfirmationModalOpen(false)}
          title="Confirm GATT Write Operation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-mono text-slate-300">
            <div className="bg-rose-950/40 border border-rose-800 rounded p-3 text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                You are about to transmit a Bluetooth Low Energy packet to your physical smartwatch. Confirm the parameters below.
              </span>
            </div>

            <div className="space-y-2 bg-lab-card p-3 rounded border border-lab-border">
              <div>
                <span className="text-slate-500">Destination Service:</span>{' '}
                <code className="text-white">{selectedServiceUuid}</code>
              </div>
              <div>
                <span className="text-slate-500">Destination Characteristic:</span>{' '}
                <code className="text-cyan-300">{selectedCharUuid}</code>
              </div>
              <div>
                <span className="text-slate-500">Write Mode:</span>{' '}
                <code className="text-white capitalize">{writeType}</code>
              </div>
              <div>
                <span className="text-slate-500">Payload Length:</span>{' '}
                <strong className="text-white">{payloadBytes.length} bytes</strong>
              </div>
              <div>
                <span className="text-slate-500">Payload (Hex):</span>{' '}
                <code className="text-emerald-400 break-all">{payloadHexFormatted}</code>
              </div>
              {intendedPurpose && (
                <div>
                  <span className="text-slate-500">Documented Purpose:</span>{' '}
                  <span className="text-slate-200">{intendedPurpose}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmationModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Abort
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleExecuteWrite}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                {isExecuting ? 'Transmitting...' : 'Confirm & Transmit'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
