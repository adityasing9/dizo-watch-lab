import React, { useState } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  bytesToHex,
  hexToBytes,
  calculateChecksum8,
  calculateXorChecksum,
  calculateCrc16Ccitt,
} from '../utils/byteUtils';
import { logger } from '../services/diagnostics/diagnosticLogger';
import {
  FlaskConical,
  Camera,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  FileCode,
  Tag,
  Edit3,
  RefreshCw,
  Send,
  Lock,
  Unlock,
} from 'lucide-react';

interface StateSnapshot {
  id: string;
  name: string;
  timestamp: number;
  characteristics: Record<string, { hex: string; length: number; name: string }>;
}

interface EvidenceAnnotation {
  id: string;
  timestamp: number;
  title: string;
  characteristicUuid: string;
  observedChange: string;
  interpretation: string;
  confidence: 'UNVERIFIED' | 'PROBABLE' | 'VERIFIED';
}

export const ProtocolResearchPage: React.FC = () => {
  const {
    status,
    services,
    readCharacteristic,
    writeCharacteristic,
    addExperiment,
  } = useBluetooth();

  // Snapshot states for controlled workflow
  const [snapshotA, setSnapshotA] = useState<StateSnapshot | null>(null);
  const [actionDescription, setActionDescription] = useState('');
  const [snapshotB, setSnapshotB] = useState<StateSnapshot | null>(null);
  const [isCapturing, setIsCapturing] = useState<'A' | 'B' | null>(null);

  // Evidence and user annotations
  const [annotations, setAnnotations] = useState<EvidenceAnnotation[]>(() => {
    const saved = localStorage.getItem('dizo_protocol_annotations');
    return saved ? JSON.parse(saved) : [];
  });

  const [newAnnotationModalOpen, setNewAnnotationModalOpen] = useState(false);
  const [selectedCharUuid, setSelectedCharUuid] = useState('');
  const [annotationTitle, setAnnotationTitle] = useState('');
  const [annotationObserved, setAnnotationObserved] = useState('');
  const [annotationInterpretation, setAnnotationInterpretation] = useState('');
  const [annotationConfidence, setAnnotationConfidence] = useState<'UNVERIFIED' | 'PROBABLE' | 'VERIFIED'>('UNVERIFIED');

  // Command workbench
  const [targetChar, setTargetChar] = useState('');
  const [targetService, setTargetService] = useState('');
  const [commandHex, setCommandHex] = useState('');
  const [commandPurpose, setCommandPurpose] = useState('');
  const [isSafetyLockEngaged, setIsSafetyLockEngaged] = useState(true);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Capture all readable characteristics into a snapshot
  const captureSnapshot = async (slot: 'A' | 'B') => {
    if (status !== 'connected') {
      alert('Please connect to the watch first.');
      return;
    }

    setIsCapturing(slot);
    const charsRecord: Record<string, { hex: string; length: number; name: string }> = {};

    try {
      for (const s of services) {
        for (const c of s.characteristics) {
          if (c.properties.read) {
            try {
              const val = await readCharacteristic(s.uuid, c.uuid);
              charsRecord[c.uuid] = {
                hex: bytesToHex(Array.from(val)),
                length: val.length,
                name: c.name || c.uuid.slice(0, 8),
              };
            } catch (rErr) {
              // Characteristic might require bonding or return security error
              charsRecord[c.uuid] = {
                hex: 'READ_RESTRICTED',
                length: 0,
                name: c.name || c.uuid.slice(0, 8),
              };
            }
          }
        }
      }

      const snap: StateSnapshot = {
        id: `snap_${Date.now()}`,
        name: slot === 'A' ? 'Initial Baseline (Before Action)' : `Post-Action (${actionDescription || 'Step 2'})`,
        timestamp: Date.now(),
        characteristics: charsRecord,
      };

      if (slot === 'A') {
        setSnapshotA(snap);
      } else {
        setSnapshotB(snap);
      }

      logger.success('RESEARCH', `Captured State Snapshot ${slot} (${Object.keys(charsRecord).length} characteristics)`);
    } catch (err: any) {
      logger.error('RESEARCH', `Failed to capture snapshot ${slot}: ${err.message}`);
    } finally {
      setIsCapturing(null);
    }
  };

  // Compare Snapshot A and Snapshot B
  const comparisonResults = React.useMemo(() => {
    if (!snapshotA || !snapshotB) return [];

    const allKeys = Array.from(new Set([...Object.keys(snapshotA.characteristics), ...Object.keys(snapshotB.characteristics)]));
    return allKeys.map((uuid) => {
      const valA = snapshotA.characteristics[uuid]?.hex || 'N/A';
      const valB = snapshotB.characteristics[uuid]?.hex || 'N/A';
      const name = snapshotA.characteristics[uuid]?.name || snapshotB.characteristics[uuid]?.name || uuid.slice(0, 8);
      const isChanged = valA !== valB;

      return {
        uuid,
        name,
        valA,
        valB,
        isChanged,
      };
    });
  }, [snapshotA, snapshotB]);

  // Save new annotation
  const handleSaveAnnotation = () => {
    if (!annotationTitle.trim() || !selectedCharUuid) return;

    const newAnn: EvidenceAnnotation = {
      id: `ann_${Date.now()}`,
      timestamp: Date.now(),
      title: annotationTitle.trim(),
      characteristicUuid: selectedCharUuid,
      observedChange: annotationObserved.trim(),
      interpretation: annotationInterpretation.trim(),
      confidence: annotationConfidence,
    };

    const updated = [newAnn, ...annotations];
    setAnnotations(updated);
    localStorage.setItem('dizo_protocol_annotations', JSON.stringify(updated));
    setNewAnnotationModalOpen(false);

    // Reset inputs
    setAnnotationTitle('');
    setAnnotationObserved('');
    setAnnotationInterpretation('');
    setAnnotationConfidence('UNVERIFIED');
    logger.info('RESEARCH', `Added protocol annotation: ${newAnn.title} (${newAnn.confidence})`);
  };

  const handleDeleteAnnotation = (id: string) => {
    const updated = annotations.filter((a) => a.id !== id);
    setAnnotations(updated);
    localStorage.setItem('dizo_protocol_annotations', JSON.stringify(updated));
  };

  // Export research evidence as JSON
  const handleExportEvidence = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      targetDevice: 'DIZO Watch D',
      snapshotA,
      actionPerformed: actionDescription,
      snapshotB,
      deltas: comparisonResults.filter((r) => r.isChanged),
      annotations,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dizo_protocol_research_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Safe manual write testing
  const parsedCommand = hexToBytes(commandHex);
  const sum8 = parsedCommand.bytes.length > 0 ? calculateChecksum8(parsedCommand.bytes) : 0;
  const xor8 = parsedCommand.bytes.length > 0 ? calculateXorChecksum(parsedCommand.bytes) : 0;
  const crc16 = parsedCommand.bytes.length > 0 ? calculateCrc16Ccitt(parsedCommand.bytes) : 0;

  const handleExecuteSafeWrite = async () => {
    if (!targetService || !targetChar || parsedCommand.bytes.length === 0 || isSafetyLockEngaged) return;

    setIsExecutingCommand(true);
    try {
      const s = services.find((serv) => serv.uuid === targetService);
      const c = s?.characteristics.find((ch) => ch.uuid === targetChar);
      const writeType = c?.properties.write ? 'write' : 'writeWithoutResponse';

      await writeCharacteristic(targetService, targetChar, parsedCommand.bytes, writeType);
      await addExperiment({
        title: `Protocol Research: ${parsedCommand.bytes.length}b to ${targetChar.slice(0, 8)}`,
        hypothesis: commandPurpose || 'Investigating MCU response',
        serviceUuid: targetService,
        characteristicUuid: targetChar,
        action: 'WRITE_TEST',
        inputPayloadHex: bytesToHex(parsedCommand.bytes),
        result: 'PENDING',
        confidence: 'SPECULATIVE',
        watchTimeVerified: false,
        notes: `Checksum Sum8: 0x${sum8.toString(16)}, CRC16: 0x${crc16.toString(16)}`,
      });
      alert('Write successful! Check Notification Monitor for incoming responses.');
    } catch (err: any) {
      alert(`Write failed: ${err.message}`);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-950/80 border border-yellow-800/80 px-2 py-0.5 rounded">
              Core Feature E • Protocol Workspace
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6 text-yellow-400" />
              <span>Protocol Research Workspace</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-2xl leading-relaxed">
              Conduct controlled protocol analysis on DIZO Watch D. Capture initial baseline states, perform known actions, detect byte-by-byte changes, and document findings with confidence scoring.
            </p>
          </div>

          <button
            onClick={handleExportEvidence}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-800/60 font-mono text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Evidence JSON</span>
          </button>
        </div>
      </div>

      {/* Controlled Experimental Workflow Step-by-Step */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-5 space-y-5">
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-yellow-400" />
          <span>Controlled 6-Step State Comparison Workflow</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Step 1: Capture Initial Baseline */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400">Step 1: Initial Baseline</span>
              {snapshotA ? <Badge variant="success">CAPTURED</Badge> : <Badge variant="neutral">EMPTY</Badge>}
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              Captures all readable GATT characteristics before initiating any trigger on the watch or phone.
            </p>
            <button
              onClick={() => captureSnapshot('A')}
              disabled={status !== 'connected' || isCapturing !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-slate-950 font-mono text-xs font-bold transition-all shadow"
            >
              <Camera className="w-4 h-4" />
              <span>{isCapturing === 'A' ? 'Reading GATT...' : 'Capture Snapshot A'}</span>
            </button>
            {snapshotA && (
              <div className="text-[10px] font-mono text-slate-400 pt-1">
                Captured {Object.keys(snapshotA.characteristics).length} registers at {new Date(snapshotA.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Step 2: Perform One Action */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400">Step 2: Single Known Action</span>
              <span className="text-[10px] font-mono text-slate-500">Controlled Trigger</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              Perform exactly ONE action (e.g. initiate phone pairing request, click side button, or toggle setting).
            </p>
            <input
              type="text"
              placeholder="e.g. Initiated phone pairing prompt on watch"
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-yellow-400"
            />
          </div>

          {/* Step 3: Capture Resulting State */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400">Step 3: Resulting State</span>
              {snapshotB ? <Badge variant="success">CAPTURED</Badge> : <Badge variant="neutral">EMPTY</Badge>}
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              Re-reads all readable GATT characteristics to observe state and register changes.
            </p>
            <button
              onClick={() => captureSnapshot('B')}
              disabled={status !== 'connected' || isCapturing !== null || !snapshotA}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-slate-950 font-mono text-xs font-bold transition-all shadow"
            >
              <Camera className="w-4 h-4" />
              <span>{isCapturing === 'B' ? 'Reading GATT...' : 'Capture Snapshot B'}</span>
            </button>
            {snapshotB && (
              <div className="text-[10px] font-mono text-slate-400 pt-1">
                Captured {Object.keys(snapshotB.characteristics).length} registers at {new Date(snapshotB.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Step 4 & 5: Delta Byte-by-Byte Comparator */}
        {snapshotA && snapshotB && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <span>Step 4: Byte-by-Byte Diff Comparator</span>
                <span className="text-yellow-400 font-normal">
                  ({comparisonResults.filter((r) => r.isChanged).length} changed)
                </span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Characteristic</th>
                    <th className="p-2.5">Snapshot A (Baseline)</th>
                    <th className="p-2.5">Snapshot B (Post-Action)</th>
                    <th className="p-2.5">Delta Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                  {comparisonResults.map((row) => (
                    <tr key={row.uuid} className={row.isChanged ? 'bg-yellow-950/20' : ''}>
                      <td className="p-2.5 text-slate-300">
                        <div className="font-semibold text-white">{row.name}</div>
                        <div className="text-[10px] text-slate-500">{row.uuid}</div>
                      </td>
                      <td className="p-2.5">
                        <code className="text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
                          {row.valA}
                        </code>
                      </td>
                      <td className="p-2.5">
                        <code className={`px-1.5 py-0.5 rounded border text-[11px] ${row.isChanged ? 'bg-yellow-950 text-yellow-400 border-yellow-700 font-bold' : 'bg-slate-950 text-slate-300 border-slate-800'}`}>
                          {row.valB}
                        </code>
                      </td>
                      <td className="p-2.5">
                        {row.isChanged ? (
                          <Badge variant="yellow" dot>SHIFT DETECTED</Badge>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Unchanged</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Protocol Interpretations & Annotations with Confidence Rating */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-yellow-400" />
              <span>Step 5 & 6: Protocol Interpretations & Confidence Ratings</span>
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Strictly classify findings as UNVERIFIED, PROBABLE, or VERIFIED. Repeat experiments before marking verified.
            </p>
          </div>

          <button
            onClick={() => setNewAnnotationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-mono text-xs font-bold transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Add Annotation</span>
          </button>
        </div>

        {annotations.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No protocol annotations recorded yet. Capture snapshots and annotate confirmed observations.
          </div>
        ) : (
          <div className="space-y-3">
            {annotations.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ann.title}</span>
                    <span className="text-[10px] text-slate-400">({ann.characteristicUuid.slice(0, 8)}...)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ann.confidence === 'VERIFIED' && <Badge variant="success">VERIFIED</Badge>}
                    {ann.confidence === 'PROBABLE' && <Badge variant="yellow">PROBABLE</Badge>}
                    {ann.confidence === 'UNVERIFIED' && <Badge variant="neutral">UNVERIFIED</Badge>}
                    <button onClick={() => handleDeleteAnnotation(ann.id)} className="text-slate-500 hover:text-rose-400 ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-slate-300 text-[11px]">
                  <span className="text-slate-500">Observation: </span>
                  {ann.observedChange}
                </div>

                <div className="text-yellow-300 text-[11px]">
                  <span className="text-slate-500">Interpretation: </span>
                  {ann.interpretation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Annotation Modal */}
      <Modal
        isOpen={newAnnotationModalOpen}
        onClose={() => setNewAnnotationModalOpen(false)}
        title="Record Protocol Interpretation"
      >
        <div className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-slate-300 block mb-1">Target Characteristic</label>
            <select
              value={selectedCharUuid}
              onChange={(e) => setSelectedCharUuid(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs"
            >
              <option value="">Select characteristic...</option>
              {services.map((s) =>
                s.characteristics.map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {c.name} ({c.uuid.slice(0, 8)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Observation Title</label>
            <input
              type="text"
              placeholder="e.g. AirSync FEA1 Authorization Bit Toggle"
              value={annotationTitle}
              onChange={(e) => setAnnotationTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Observed Behavior / Byte Change</label>
            <textarea
              rows={2}
              placeholder="e.g. Byte 0 shifts from 0x07 to 0x00 when pairing dialog appears"
              value={annotationObserved}
              onChange={(e) => setAnnotationObserved(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Interpretation & Hypothesis</label>
            <textarea
              rows={2}
              placeholder="e.g. Byte 0 represents pairing confirmation status flag"
              value={annotationInterpretation}
              onChange={(e) => setAnnotationInterpretation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Confidence Classification</label>
            <select
              value={annotationConfidence}
              onChange={(e) => setAnnotationConfidence(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs"
            >
              <option value="UNVERIFIED">UNVERIFIED (Initial observation, not yet reproduced)</option>
              <option value="PROBABLE">PROBABLE (Reproduced twice, pending hardware display proof)</option>
              <option value="VERIFIED">VERIFIED (100% Proven on physical DIZO Watch D hardware)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setNewAnnotationModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAnnotation}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-lg"
            >
              Save Annotation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
