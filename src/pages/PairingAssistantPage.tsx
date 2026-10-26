import React, { useState, useEffect, useMemo } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  CANDIDATE_PAIRING_COMMANDS,
  PairingCandidateCommand,
  PairingIndicatorState,
  findMatchingPairingPipe,
} from '../utils/pairingProtocol';
import { bytesToHex } from '../utils/byteUtils';
import { logger } from '../services/diagnostics/diagnosticLogger';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Watch,
  Bluetooth,
  RefreshCw,
  Send,
  Power,
  RotateCcw,
  ScrollText,
  FileCode,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

interface PairingAssistantPageProps {
  onNavigate: (tabId: string) => void;
}

export const PairingAssistantPage: React.FC<PairingAssistantPageProps> = ({ onNavigate }) => {
  const {
    status,
    device,
    services,
    notifications,
    requestDevice,
    connect,
    disconnect,
    writeCharacteristic,
    readCharacteristic,
    addExperiment,
  } = useBluetooth();

  // Primary indicator state
  const [indicatorState, setIndicatorState] = useState<PairingIndicatorState>(() => {
    return status === 'connected' ? 'CONNECTED' : 'DISCONNECTED';
  });

  // Keep state synchronized with connection status
  useEffect(() => {
    if (status === 'disconnected') {
      setIndicatorState('DISCONNECTED');
    } else if (status === 'connected' && indicatorState === 'DISCONNECTED') {
      setIndicatorState('CONNECTED');
    } else if (status === 'error') {
      setIndicatorState('OPERATION_FAILED');
    }
  }, [status, indicatorState]);

  // Selected candidate command for investigation
  const [selectedCandidate, setSelectedCandidate] = useState<PairingCandidateCommand>(
    CANDIDATE_PAIRING_COMMANDS[0]
  );

  // Safety gating & confirmation modal
  const [isExperimentalModeUnlocked, setIsExperimentalModeUnlocked] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Manual physical verification modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Status check response
  const [pairingStatusInfo, setPairingStatusInfo] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Evaluate candidate compatibility against discovered services
  const evaluatedCandidates = useMemo(() => {
    return CANDIDATE_PAIRING_COMMANDS.map((cmd) => {
      const match = findMatchingPairingPipe(services, cmd);
      return {
        cmd,
        isSupported: Boolean(match),
        matchedPipe: match,
      };
    });
  }, [services]);

  // Status Indicator Visual Resolver
  const renderStatusBadge = () => {
    switch (indicatorState) {
      case 'DISCONNECTED':
        return <Badge variant="neutral" dot>Watch Disconnected</Badge>;
      case 'CONNECTED':
        return <Badge variant="success" dot>Watch Connected</Badge>;
      case 'CONFIRMATION_DETECTED':
        return <Badge variant="yellow" dot>Pairing Confirmation Detected</Badge>;
      case 'WAITING_FOR_CONFIRMATION':
        return <Badge variant="warning" dot>Waiting for Confirmation</Badge>;
      case 'COMMAND_UNIDENTIFIED':
        return <Badge variant="yellow" dot>Acceptance Command Not Yet Identified</Badge>;
      case 'COMMAND_SENT':
        return <Badge variant="accent" dot>Command Sent (Unverified)</Badge>;
      case 'ACCEPTANCE_VERIFIED':
        return <Badge variant="success" dot>Acceptance Verified on Watch</Badge>;
      case 'OPERATION_FAILED':
      default:
        return <Badge variant="danger" dot>Operation Failed</Badge>;
    }
  };

  // Button 1: Connect to Watch
  const handleConnect = async () => {
    try {
      if (status === 'connected') {
        await disconnect();
        setIndicatorState('DISCONNECTED');
      } else {
        await requestDevice();
        await connect();
        setIndicatorState('CONNECTED');
      }
    } catch (err: any) {
      logger.error('BLUETOOTH', `Connection failed: ${err.message}`);
      setIndicatorState('OPERATION_FAILED');
    }
  };

  // Button 2: Check Pairing Status
  const handleCheckPairingStatus = async () => {
    if (status !== 'connected') {
      setPairingStatusInfo('Please connect to the watch first.');
      return;
    }

    setIsCheckingStatus(true);
    setPairingStatusInfo(null);
    logger.info('PAIRING', 'Querying DIZO Watch D pairing and authorization status registers...');

    try {
      const results: string[] = [];

      // Check Tencent AirSync FEA1 status if available
      const fee7Service = services.find((s) => s.normalizedUuid.includes('fee7'));
      if (fee7Service) {
        const fea1Char = fee7Service.characteristics.find((c) => c.normalizedUuid.includes('fea1'));
        if (fea1Char && fea1Char.properties.read) {
          try {
            const val = await readCharacteristic(fee7Service.uuid, fea1Char.uuid);
            const hex = bytesToHex(Array.from(val));
            results.push(`AirSync FEA1 Status: [${hex}]`);
            if (val[0] === 0x07) {
              setIndicatorState('WAITING_FOR_CONFIRMATION');
              results.push('Register confirms authorization pending state.');
            }
          } catch (rErr: any) {
            results.push(`AirSync FEA1 Read note: ${rErr.message}`);
          }
        }
      }

      // Check recent incoming notifications for Linwear framing
      if (notifications.length > 0) {
        const latest = notifications[0];
        results.push(`Latest GATT packet: ${latest.payloadHex} (from ${latest.characteristicUuid.slice(0, 8)}...)`);
      }

      if (results.length === 0) {
        results.push('GATT link is active. No pending AirSync status reported. Screen state is undetermined over BLE.');
        setIndicatorState('CONNECTED');
      }

      setPairingStatusInfo(results.join('\n'));
      logger.success('PAIRING', 'Pairing status query completed', { details: { results } });
    } catch (err: any) {
      setPairingStatusInfo(`Status query error: ${err.message}`);
      logger.error('PAIRING', `Status query failed: ${err.message}`);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Button 3: Accept on Watch (Gated & Experimental)
  const handleInitiateAccept = () => {
    if (status !== 'connected') {
      setExecutionError('Cannot execute: Watch is disconnected. Connect to watch first.');
      return;
    }

    // Check if the command is marked verified
    if (!selectedCandidate.isVerified) {
      setIndicatorState('COMMAND_UNIDENTIFIED');
    }

    setIsConfirmationModalOpen(true);
  };

  const handleExecuteCandidateAcceptance = async () => {
    setIsConfirmationModalOpen(false);
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionMessage(null);

    const match = findMatchingPairingPipe(services, selectedCandidate);
    if (!match) {
      setExecutionError(
        `Target characteristic ${selectedCandidate.characteristicUuid.slice(0, 8)}... not discovered with write permissions.`
      );
      setIndicatorState('OPERATION_FAILED');
      setIsExecuting(false);
      return;
    }

    const payloadBytes = new Uint8Array(selectedCandidate.payload);
    logger.info('PAIRING', `Transmitting experimental acceptance packet to ${match.characteristic.uuid}`, {
      details: {
        candidateId: selectedCandidate.id,
        payloadHex: bytesToHex(selectedCandidate.payload),
      },
    });

    try {
      // Send command using appropriate BLE write method
      const writeType = match.characteristic.properties.write ? 'write' : 'writeWithoutResponse';
      await writeCharacteristic(match.service.uuid, match.characteristic.uuid, payloadBytes, writeType);

      // Record experiment log
      await addExperiment({
        title: `Experimental Acceptance: ${selectedCandidate.name}`,
        hypothesis: `Testing whether ${bytesToHex(selectedCandidate.payload)} dismisses the phone-binding confirmation dialog on watch screen.`,
        serviceUuid: match.service.uuid,
        characteristicUuid: match.characteristic.uuid,
        action: 'WRITE_TEST',
        inputPayloadHex: bytesToHex(selectedCandidate.payload),
        result: 'PENDING',
        confidence: 'SPECULATIVE',
        watchTimeVerified: false,
        notes: `Transmitted via ${writeType}. Required physical display inspection.`,
      });

      // Strict requirement: Successful GATT write is NOT proof of watch acceptance!
      setIndicatorState('COMMAND_SENT');
      setExecutionMessage(
        'Command sent, acceptance not verified. Please inspect the watch display now.'
      );
      setShowVerificationModal(true);
    } catch (err: any) {
      logger.error('PAIRING', `Failed to transmit acceptance packet: ${err.message}`);
      setExecutionError(`Write error: ${err.message}`);
      setIndicatorState('OPERATION_FAILED');
    } finally {
      setIsExecuting(false);
    }
  };

  // Button 4: Cancel Operation
  const handleCancelOperation = () => {
    setIsExecuting(false);
    setIsConfirmationModalOpen(false);
    setShowVerificationModal(false);
    setExecutionMessage('Operation cancelled by user.');
    setExecutionError(null);
    if (status === 'connected') {
      setIndicatorState('CONNECTED');
    } else {
      setIndicatorState('DISCONNECTED');
    }
    logger.info('PAIRING', 'Pairing assistant operation cancelled by user.');
  };

  // Button 5: View Diagnostic Log
  const handleViewLogs = () => {
    onNavigate('logs');
  };

  // Physical display verification feedback handler
  const handleVerificationFeedback = (dismissed: boolean) => {
    setShowVerificationModal(false);
    if (dismissed) {
      setIndicatorState('ACCEPTANCE_VERIFIED');
      setExecutionMessage('🎉 Acceptance verified! The confirmation dialog dismissed on the physical watch display.');
      logger.success('PAIRING', `Physical verification confirmed! Watch accepted command ${selectedCandidate.name}.`);
    } else {
      setIndicatorState('COMMAND_SENT');
      setExecutionMessage(
        'Observed: Command payload was transmitted over BLE, but the confirmation dialog remains visible on the watch display. Acceptance is unverified.'
      );
      logger.warn('PAIRING', `Physical verification negative: Dialog remained on screen for ${selectedCandidate.name}.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-950/80 border border-yellow-800/80 px-2 py-0.5 rounded">
                Core Feature C • Recovery Assistant
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Watch className="w-6 h-6 text-yellow-400" />
              <span>DIZO Watch D — Pairing Assistant</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-2xl leading-relaxed">
              Investigate and experimentally accept the on-screen phone-binding confirmation dialog over Bluetooth Low Energy when the physical touchscreen is unresponsive.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Pairing State</span>
            {renderStatusBadge()}
          </div>
        </div>
      </div>

      {/* Primary Action Buttons Bar */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Assistant Controls
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Button 1: Connect to Watch */}
          <button
            onClick={handleConnect}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold transition-all shadow-sm ${
              status === 'connected'
                ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700'
                : 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold'
            }`}
          >
            <Bluetooth className="w-4 h-4 shrink-0" />
            <span>{status === 'connected' ? 'Disconnect Watch' : 'Connect to Watch'}</span>
          </button>

          {/* Button 2: Check Pairing Status */}
          <button
            onClick={handleCheckPairingStatus}
            disabled={status !== 'connected' || isCheckingStatus}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isCheckingStatus ? 'animate-spin text-yellow-400' : ''}`} />
            <span>{isCheckingStatus ? 'Checking...' : 'Check Pairing Status'}</span>
          </button>

          {/* Button 3: Accept on Watch (Gated / Experimental) */}
          <button
            onClick={handleInitiateAccept}
            disabled={status !== 'connected' || isExecuting}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-bold transition-all shadow-md ${
              isExperimentalModeUnlocked && status === 'connected'
                ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 ring-2 ring-yellow-400/50'
                : 'bg-slate-800 text-yellow-400/90 hover:bg-slate-750 border border-yellow-700/60 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>Accept on Watch</span>
          </button>

          {/* Button 4: Cancel Operation */}
          <button
            onClick={handleCancelOperation}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Cancel Operation</span>
          </button>

          {/* Button 5: View Diagnostic Log */}
          <button
            onClick={handleViewLogs}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <ScrollText className="w-4 h-4 shrink-0" />
            <span>View Diagnostic Log</span>
          </button>
        </div>
      </div>

      {/* Required Gating Explanation Banner */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 sm:p-5 text-amber-200 text-xs font-mono space-y-2.5">
        <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Scientific Discipline & Safety Disclosure</span>
        </div>
        <p className="leading-relaxed">
          &quot;<strong>The Bluetooth command for accepting this watch's phone-binding confirmation has not yet been verified.</strong>&quot;
        </p>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          Do not assume that the watch supports remote confirmation. The application strictly distinguishes between verified capabilities, experimental findings, and unsupported operations. Successful GATT transmission will never be presented as proof of watch acceptance.
        </p>
        <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-yellow-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isExperimentalModeUnlocked}
              onChange={(e) => setIsExperimentalModeUnlocked(e.target.checked)}
              className="rounded border-slate-700 text-yellow-400 focus:ring-yellow-400/30 bg-slate-900 w-4 h-4"
            />
            <span>Enable Experimental Acceptance Testing (Manual Safety Override)</span>
          </label>
        </div>
      </div>

      {/* Execution Feedback / Status Output */}
      {executionMessage && (
        <div className="p-4 rounded-xl bg-slate-900 border border-yellow-700/60 text-yellow-200 text-xs font-mono space-y-1">
          <div className="font-bold text-yellow-300 flex items-center gap-1.5">
            <Info className="w-4 h-4" />
            <span>Operation Notice</span>
          </div>
          <p className="leading-relaxed whitespace-pre-wrap">{executionMessage}</p>
        </div>
      )}

      {executionError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-mono space-y-1">
          <div className="font-bold text-rose-300 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            <span>Operation Error</span>
          </div>
          <p className="leading-relaxed">{executionError}</p>
        </div>
      )}

      {/* Status Register Readout */}
      {pairingStatusInfo && (
        <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-5 font-mono text-xs space-y-2">
          <div className="text-slate-300 font-bold flex items-center justify-between">
            <span>Pairing Status Register Query Result</span>
            <button onClick={() => setPairingStatusInfo(null)} className="text-slate-500 hover:text-white">✕</button>
          </div>
          <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed">
            {pairingStatusInfo}
          </pre>
        </div>
      )}

      {/* Candidate Commands Selection Table */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-yellow-400" />
            <span>Candidate Acceptance Protocols Under Investigation</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Select a reverse-engineered candidate command to inspect its packet structure, prerequisites, and experimental evidence.
          </p>
        </div>

        <div className="space-y-3">
          {evaluatedCandidates.map(({ cmd, isSupported, matchedPipe }) => {
            const isSelected = selectedCandidate.id === cmd.id;

            return (
              <div
                key={cmd.id}
                onClick={() => setSelectedCandidate(cmd)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-yellow-400 shadow-md ring-1 ring-yellow-400/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? 'bg-yellow-400' : 'bg-slate-700'}`} />
                    <span className="font-mono text-xs font-bold text-white">{cmd.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {cmd.protocolName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {cmd.isVerified ? (
                      <Badge variant="success">VERIFIED</Badge>
                    ) : (
                      <Badge variant="neutral">UNVERIFIED CANDIDATE</Badge>
                    )}
                    {isSupported ? (
                      <Badge variant="yellow">PIPE DETECTED</Badge>
                    ) : (
                      <Badge variant="neutral">PIPE NOT FOUND</Badge>
                    )}
                  </div>
                </div>

                <p className="text-xs font-mono text-slate-300 mt-2 leading-relaxed">
                  {cmd.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500">Payload: </span>
                    <code className="text-yellow-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {bytesToHex(cmd.payload)}
                    </code>
                    <span className="text-slate-500 ml-1.5">({cmd.payload.length} bytes)</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Target Pipe: </span>
                    <span className="text-slate-300">{cmd.characteristicUuid.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 mt-2 italic">
                  Note: {cmd.evidenceNotes}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal before Sending Experimental Write */}
      <Modal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        title="Confirm Experimental Acceptance Write"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <ShieldAlert className="w-4 h-4" />
              <span>Experimental Operation Confirmation</span>
            </div>
            <p className="leading-relaxed">
              You are about to transmit an unverified candidate packet to your DIZO Watch D:
            </p>
            <div className="bg-slate-950 p-2.5 rounded border border-amber-900/60 text-slate-200">
              <div>Protocol: <strong>{selectedCandidate.name}</strong></div>
              <div>Destination: <code>{selectedCandidate.characteristicUuid}</code></div>
              <div>Payload Hex: <code className="text-yellow-400">{bytesToHex(selectedCandidate.payload)}</code></div>
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Ensure your watch is powered on and currently displaying the confirmation dialog. After sending, inspect the watch screen to observe whether the dialog dismisses.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsConfirmationModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteCandidateAcceptance}
              className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold font-mono shadow"
            >
              Confirm & Transmit Packet
            </button>
          </div>
        </div>
      </Modal>

      {/* Physical Display Inspection Modal */}
      <Modal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        title="Physical Hardware Display Inspection"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 space-y-2">
            <div className="font-bold text-yellow-400 flex items-center gap-1.5">
              <Watch className="w-4 h-4" />
              <span>Inspect Watch Display</span>
            </div>
            <p className="leading-relaxed">
              The candidate acceptance packet was successfully transmitted over Bluetooth Low Energy.
            </p>
            <p className="text-amber-300 font-semibold leading-relaxed">
              Look at the physical DIZO Watch D screen right now. If the screen is sleeping, press the side button once to turn the display on.
            </p>
            <p className="text-slate-300">
              Did the phone-binding confirmation prompt dismiss and allow you into the watch face?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleVerificationFeedback(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>YES, Dialog Dismissed</span>
            </button>
            <button
              onClick={() => handleVerificationFeedback(false)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700"
            >
              <XCircle className="w-4 h-4" />
              <span>NO, Prompt Remains</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
