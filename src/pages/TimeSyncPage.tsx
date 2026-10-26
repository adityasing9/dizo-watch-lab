import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { CANDIDATE_TIME_PROTOCOLS } from '../data/timeCandidateProtocols';
import {
  Clock,
  Calendar,
  Globe,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FlaskConical,
  Lock,
  ArrowRight,
  ShieldCheck,
  Send,
  Download,
  Info,
} from 'lucide-react';
import {
  ProtocolExperiment,
  TimeCandidateProtocol,
  TimeSyncInvestigationStatus,
} from '../types/bluetooth';
import { bytesToHex, formatHexDump } from '../utils/byteUtils';
import { logger } from '../services/diagnostics/diagnosticLogger';

interface TimeSyncPageProps {
  onNavigate: (tabId: string) => void;
}

export const TimeSyncPage: React.FC<TimeSyncPageProps> = ({ onNavigate }) => {
  const {
    status,
    services,
    experiments,
    timeSyncStatus,
    setTimeSyncStatus,
    addExperiment,
    updateExperiment,
    writeCharacteristic,
    readCharacteristic,
  } = useBluetooth();

  // Section A: Live Clock
  const [clockDate, setClockDate] = useState(new Date());
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setClockDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshClock = () => {
    const now = new Date();
    setClockDate(now);
    setLastRefreshedAt(now);
  };

  // Section D: Execution Workflow
  const [selectedProtocol, setSelectedProtocol] = useState<TimeCandidateProtocol | null>(null);
  const [isExecutingProtocol, setIsExecutingProtocol] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [executionResultPayload, setExecutionResultPayload] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [lastCreatedExpId, setLastCreatedExpId] = useState<string | null>(null);

  // Verification prompt
  const [verificationFeedback, setVerificationFeedback] = useState<'yes' | 'no' | null>(null);

  // Timezone calculations
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetMinutes = -clockDate.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMinsRemainder = Math.abs(offsetMinutes) % 60;
  const formattedUtcOffset = `UTC${offsetMinutes >= 0 ? '+' : '-'}${offsetHours
    .toString()
    .padStart(2, '0')}:${offsetMinsRemainder.toString().padStart(2, '0')}`;

  // Evaluate candidate matching against discovered services
  const evaluatedCandidates = CANDIDATE_TIME_PROTOCOLS.map((protocol) => {
    const matchingService = services.find(
      (s) => s.normalizedUuid === protocol.serviceUuid.toLowerCase()
    );
    const matchingChar = matchingService?.characteristics.find(
      (c) => c.normalizedUuid === protocol.characteristicUuid.toLowerCase()
    );

    const isAvailable = Boolean(matchingChar);
    const hasWritePermission = matchingChar
      ? protocol.writeType === 'writeWithoutResponse'
        ? matchingChar.properties.writeWithoutResponse || matchingChar.properties.write
        : matchingChar.properties.write
      : false;

    return {
      protocol,
      matchingService,
      matchingChar,
      isAvailable,
      hasWritePermission,
    };
  });

  const handleStartCandidateTest = (protocol: TimeCandidateProtocol) => {
    setSelectedProtocol(protocol);
    setActiveStep(1);
    setExecutionError(null);
    setExecutionResultPayload(null);
    setVerificationFeedback(null);
    setIsSyncModalOpen(true);
  };

  const handleExecuteProtocolStep = async () => {
    if (!selectedProtocol) return;
    setIsExecutingProtocol(true);
    setExecutionError(null);

    const payload = selectedProtocol.buildPayload(clockDate);

    try {
      // Step 5: Execute
      setActiveStep(5);

      await writeCharacteristic(
        selectedProtocol.serviceUuid,
        selectedProtocol.characteristicUuid,
        new Uint8Array(payload.bytes),
        selectedProtocol.writeType
      );

      // Step 6: Inspect any response / read back if readable
      setActiveStep(6);
      let responseHex: string | undefined = undefined;

      const matchingService = services.find((s) => s.normalizedUuid === selectedProtocol.serviceUuid.toLowerCase());
      const matchingChar = matchingService?.characteristics.find((c) => c.normalizedUuid === selectedProtocol.characteristicUuid.toLowerCase());

      if (matchingChar?.properties.read) {
        try {
          const readBack = await readCharacteristic(selectedProtocol.serviceUuid, selectedProtocol.characteristicUuid);
          responseHex = bytesToHex(readBack);
          setExecutionResultPayload(`Read-back response: [${responseHex}]`);
        } catch {
          // Some characteristics are write-only
          setExecutionResultPayload('Command written without error. Characteristic does not permit read-back.');
        }
      } else {
        setExecutionResultPayload('Packet dispatched to watch MCU. No read-back supported on write-only characteristic.');
      }

      // Record experiment
      const exp = await addExperiment({
        title: `Time Sync: ${selectedProtocol.name}`,
        hypothesis: `Testing whether ${selectedProtocol.name} sets the watch MCU RTC date & time`,
        serviceUuid: selectedProtocol.serviceUuid,
        characteristicUuid: selectedProtocol.characteristicUuid,
        action: 'TIME_SYNC_ATTEMPT',
        inputPayloadHex: payload.hex,
        result: 'PENDING',
        confidence: selectedProtocol.confidence,
        watchTimeVerified: false,
        notes: `Transmitted ${payload.bytes.length} bytes: ${payload.explanation}. Awaiting manual verification of watch display.`,
      });

      setLastCreatedExpId(exp.id);
      setTimeSyncStatus('COMMAND_TESTED');

      // Move to Step 7: Verify Resulting Watch Time
      setActiveStep(7);
    } catch (err: any) {
      setExecutionError(err.message || 'Execution error');
      setTimeSyncStatus('INVESTIGATION_IN_PROGRESS');
    } finally {
      setIsExecutingProtocol(false);
    }
  };

  const handleManualVerificationResponse = async (didChange: boolean) => {
    setVerificationFeedback(didChange ? 'yes' : 'no');

    if (didChange) {
      setTimeSyncStatus('TIME_SYNC_VERIFIED');
      if (lastCreatedExpId) {
        await updateExperiment(lastCreatedExpId, {
          result: 'SUCCESS',
          watchTimeVerified: true,
          confidence: 'VERIFIED',
          notes: 'User verified that watch screen updated to correct time!',
        });
      }
      logger.success('TIME_SYNC', 'SUCCESS: Watch display time verified by user!');
    } else {
      if (lastCreatedExpId) {
        await updateExperiment(lastCreatedExpId, {
          result: 'FAILURE',
          watchTimeVerified: false,
          notes: 'Watch time did not update after packet transmission. Protocol candidate rejected or prerequisite missing.',
        });
      }
      logger.warn('TIME_SYNC', 'Watch time did NOT update after command transmission.');
    }
  };

  const exportEvidenceReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      timeSyncStatus,
      targetDevice: status === 'connected' ? 'DIZO Watch D' : 'None',
      discoveredServicesCount: services.length,
      candidateProtocolsEvaluated: evaluatedCandidates.map((c) => ({
        name: c.protocol.name,
        service: c.protocol.serviceUuid,
        characteristic: c.protocol.characteristicUuid,
        isDiscoveredOnWatch: c.isAvailable,
        hasWritePermission: c.hasWritePermission,
      })),
      experimentsLogged: experiments,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `dizo_time_sync_investigation_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>Time Synchronization Research Lab</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Core project objective: Investigate and verify BLE date & time synchronization for DIZO Watch D without touchscreen controls.
          </p>
        </div>

        <button
          onClick={exportEvidenceReport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lab-card hover:bg-slate-800 border border-lab-border text-xs font-mono text-slate-300 self-start sm:self-center"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Evidence Report</span>
        </button>
      </div>

      {/* SECTION A: Current Phone / Host Time */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-lab-border/70 pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Section A: Reference Host Time (Source Clock)</span>
          </h2>
          <button
            onClick={refreshClock}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-400"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Clock</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border">
            <div className="text-slate-400 text-[10px] mb-1">Local Date</div>
            <div className="text-white font-bold text-sm sm:text-base">
              {clockDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>

          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border">
            <div className="text-slate-400 text-[10px] mb-1">Local Time</div>
            <div className="text-cyan-300 font-bold text-sm sm:text-base">
              {clockDate.toLocaleTimeString()}
            </div>
          </div>

          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border">
            <div className="text-slate-400 text-[10px] mb-1">Timezone & Offset</div>
            <div className="text-white font-bold text-sm sm:text-base truncate" title={timezoneName}>
              {timezoneName}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formattedUtcOffset}</div>
          </div>

          <div className="bg-lab-card/80 p-3.5 rounded-lg border border-lab-border">
            <div className="text-slate-400 text-[10px] mb-1">Host Clock Precision</div>
            <div className="text-slate-200 font-bold text-xs mt-0.5">
              Refreshed: {lastRefreshedAt.toLocaleTimeString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Sourced from system RTC</div>
          </div>
        </div>
      </div>

      {/* SECTION C: Time Synchronization Status */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-lab-border/70 pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Section C: Formal Time Synchronization Status</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">Strict Scientific Verification</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-lab-card/60 p-4 rounded-lg border border-lab-border">
          <div className="space-y-1">
            <div className="text-xs text-slate-400 font-mono">Current Status:</div>
            <div className="text-base font-bold font-mono text-white flex items-center gap-2.5">
              {timeSyncStatus === 'TIME_SYNC_VERIFIED' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300">Time Synchronization Verified</span>
                </>
              ) : timeSyncStatus === 'COMMAND_TESTED' ? (
                <>
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-300">Command Tested — Awaiting Verification</span>
                </>
              ) : timeSyncStatus === 'CANDIDATE_COMMAND_IDENTIFIED' ? (
                <>
                  <FlaskConical className="w-5 h-5 text-cyan-400" />
                  <span className="text-cyan-300">Candidate Command Identified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-300">Investigation In Progress</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Override Status:</span>
            <select
              value={timeSyncStatus}
              onChange={(e) => setTimeSyncStatus(e.target.value as TimeSyncInvestigationStatus)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-white focus:border-cyan-500 outline-none"
            >
              <option value="NOT_INVESTIGATED">Not investigated</option>
              <option value="INVESTIGATION_IN_PROGRESS">Investigation in progress</option>
              <option value="POSSIBLE_CHARACTERISTIC_IDENTIFIED">Possible time characteristic identified</option>
              <option value="CANDIDATE_COMMAND_IDENTIFIED">Candidate command identified</option>
              <option value="COMMAND_TESTED">Command tested</option>
              <option value="TIME_SYNC_VERIFIED">Time synchronization verified</option>
              <option value="UNSUPPORTED_OR_UNRESOLVED">Unsupported or unresolved</option>
            </select>
          </div>
        </div>

        <div className="p-3 bg-slate-900/40 rounded border border-slate-800/80 text-xs text-slate-400 font-mono flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Scientist Rule:</strong> Never claim time synchronization succeeded unless the visual display on the watch
            physically changes to match host time. If the mechanism remains unknown, report the exact missing evidence.
          </span>
        </div>
      </div>

      {/* SECTION B & D: Watch Protocol Investigation & Candidate Sync Execution */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-lab-border/70 pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <span>Section B & D: Candidate Protocol Profiles & Synchronization Control</span>
          </h2>
          <span className="text-xs font-mono text-cyan-400">
            {evaluatedCandidates.filter((c) => c.isAvailable).length} / {evaluatedCandidates.length} Matched in Live GATT
          </span>
        </div>

        <p className="text-xs font-mono text-slate-300 leading-relaxed">
          The table below analyzes candidate time protocols against the <strong>actual discovered GATT tree</strong> of your watch.
          Synchronization buttons remain safely disabled unless the peripheral exposes the required service and characteristic.
        </p>

        {/* Candidate Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {evaluatedCandidates.map(({ protocol, isAvailable, hasWritePermission, matchingChar }) => {
            const samplePayload = protocol.buildPayload(clockDate);

            return (
              <div
                key={protocol.id}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 transition-all ${
                  isAvailable && hasWritePermission
                    ? 'bg-lab-card border-cyan-800/80 shadow-md'
                    : 'bg-lab-card/40 border-lab-border opacity-85'
                }`}
              >
                <div className="space-y-3 font-mono">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-white">{protocol.name}</span>
                    {isAvailable ? (
                      <Badge variant="success">GATT Matched</Badge>
                    ) : (
                      <Badge variant="neutral">Not Found in GATT</Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">{protocol.description}</p>

                  <div className="text-[10px] space-y-1 bg-slate-900/80 p-2.5 rounded border border-slate-800 text-slate-300">
                    <div>
                      <span className="text-slate-500">Target Char:</span>{' '}
                      <code>{protocol.characteristicUuid.substring(0, 8)}...</code>
                    </div>
                    <div>
                      <span className="text-slate-500">Write Mode:</span> <code>{protocol.writeType}</code>
                    </div>
                    <div>
                      <span className="text-slate-500">Live Payload:</span>{' '}
                      <code className="text-cyan-300 font-bold">{samplePayload.hex}</code>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-300">Prerequisites Check:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {protocol.prerequisites.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-lab-border/50">
                  {status !== 'connected' ? (
                    <button
                      disabled
                      className="w-full py-2 rounded bg-slate-800/50 text-slate-500 text-xs font-mono flex items-center justify-center gap-2 cursor-not-allowed border border-slate-700/50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Connect Watch First</span>
                    </button>
                  ) : !isAvailable || !hasWritePermission ? (
                    <button
                      disabled
                      className="w-full py-2 rounded bg-slate-800/50 text-slate-500 text-xs font-mono flex items-center justify-center gap-2 cursor-not-allowed border border-slate-700/50"
                      title="Service or write characteristic not discovered on this watch"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Characteristic Unavailable</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartCandidateTest(protocol)}
                      className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Inspect & Test Protocol</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Structured Experiment Log Section */}
      <div className="bg-lab-surface border border-lab-border rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-lab-border/70 pb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span>Structured Protocol Experiment Log</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">{experiments.length} Experiments Recorded</span>
        </div>

        {experiments.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No experiments recorded yet. When you test a candidate protocol or inspect a characteristic, your hypotheses and observations will appear here.
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="bg-lab-card/80 border border-lab-border rounded-lg p-3.5 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{exp.title}</span>
                    <Badge
                      variant={
                        exp.result === 'SUCCESS'
                          ? 'success'
                          : exp.result === 'FAILURE'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {exp.result}
                    </Badge>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      Confidence: {exp.confidence}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(exp.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="text-slate-300 text-[11px]">
                  <strong>Hypothesis:</strong> {exp.hypothesis}
                </div>

                {exp.inputPayloadHex && (
                  <div className="bg-black/60 p-2 rounded text-[11px] text-cyan-300 font-mono">
                    <span className="text-slate-500">Payload: </span>
                    {exp.inputPayloadHex}
                  </div>
                )}

                <div className="text-[11px] text-slate-400">
                  <strong>Result & Notes:</strong> {exp.notes}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7-Step Controlled Execution Modal */}
      {isSyncModalOpen && selectedProtocol && (
        <Modal
          isOpen={isSyncModalOpen}
          onClose={() => {
            if (!isExecutingProtocol) setIsSyncModalOpen(false);
          }}
          title={`Controlled Protocol Execution: ${selectedProtocol.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-mono text-slate-300">
            {/* 7-step tracker pills */}
            <div className="flex items-center justify-between border-b border-lab-border pb-3 overflow-x-auto text-[10px] text-slate-400 gap-2">
              <span className={activeStep >= 1 ? 'text-cyan-400 font-bold' : ''}>1. Review</span>
              <span>→</span>
              <span className={activeStep >= 2 ? 'text-cyan-400 font-bold' : ''}>2. Dest Char</span>
              <span>→</span>
              <span className={activeStep >= 3 ? 'text-cyan-400 font-bold' : ''}>3. Payload</span>
              <span>→</span>
              <span className={activeStep >= 4 ? 'text-cyan-400 font-bold' : ''}>4. Confirm</span>
              <span>→</span>
              <span className={activeStep >= 5 ? 'text-cyan-400 font-bold' : ''}>5. Execute</span>
              <span>→</span>
              <span className={activeStep >= 6 ? 'text-cyan-400 font-bold' : ''}>6. Response</span>
              <span>→</span>
              <span className={activeStep >= 7 ? 'text-emerald-400 font-bold' : ''}>7. Verify</span>
            </div>

            {/* Step Content */}
            <div className="space-y-3 bg-lab-card p-4 rounded-lg border border-lab-border">
              <div>
                <span className="text-slate-500">Intended Operation:</span>{' '}
                <strong className="text-white">{selectedProtocol.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Destination Characteristic:</span>{' '}
                <code className="text-cyan-300">{selectedProtocol.characteristicUuid}</code>
              </div>
              <div>
                <span className="text-slate-500">Write Mode:</span>{' '}
                <code className="text-white">{selectedProtocol.writeType}</code>
              </div>

              {/* Payload Breakdown */}
              <div className="space-y-1 pt-1">
                <span className="text-slate-500">Payload Preview & Breakdown:</span>
                <div className="bg-black/90 p-3 rounded border border-slate-800 text-emerald-400 text-xs">
                  <div>Hex: {selectedProtocol.buildPayload(clockDate).hex}</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    {selectedProtocol.buildPayload(clockDate).explanation}
                  </div>
                </div>
              </div>

              {executionError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded text-rose-200">
                  Error during execution: {executionError}
                </div>
              )}

              {executionResultPayload && (
                <div className="p-3 bg-slate-900 border border-slate-700 rounded text-cyan-300">
                  {executionResultPayload}
                </div>
              )}

              {/* Step 7: Manual Watch Display Verification Prompt */}
              {activeStep === 7 && (
                <div className="bg-amber-950/60 border border-amber-700 rounded-lg p-4 space-y-3 mt-3">
                  <div className="font-bold text-amber-200 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>Step 7: Manual Watch Display Verification</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Look at the physical display of your DIZO Watch D. Did the displayed clock update to{' '}
                    <strong>{clockDate.toLocaleTimeString()}</strong>?
                  </p>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => handleManualVerificationResponse(true)}
                      className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${
                        verificationFeedback === 'yes'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700'
                      }`}
                    >
                      ✓ YES, Time Was Corrected!
                    </button>
                    <button
                      onClick={() => handleManualVerificationResponse(false)}
                      className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${
                        verificationFeedback === 'no'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700'
                      }`}
                    >
                      ✗ NO, Watch Did Not Change
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                Safety Guard: All steps are audited to IndexedDB
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  disabled={isExecutingProtocol}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {activeStep === 7 ? 'Close' : 'Cancel'}
                </button>
                {activeStep < 5 && (
                  <button
                    type="button"
                    disabled={isExecutingProtocol}
                    onClick={handleExecuteProtocolStep}
                    className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Execute Candidate Sync</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
