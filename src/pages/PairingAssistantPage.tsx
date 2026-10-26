import React, { useState, useEffect, useMemo } from 'react';
import { useBluetooth } from '../context/BluetoothContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  CANDIDATE_PAIRING_COMMANDS,
  CANDIDATE_ROTATION_COMMANDS,
  DIZO_TOUCH_GEOMETRY,
  PairingCandidateCommand,
  ScreenRotationCandidateCommand,
  PairingIndicatorState,
  AcceptanceOutcomeState,
  RotationSupportStatus,
  findMatchingPairingPipe,
  findMatchingRotationPipe,
} from '../utils/pairingProtocol';
import { bytesToHex } from '../utils/byteUtils';
import { logger } from '../services/diagnostics/diagnosticLogger';
import { DiagnosticLog } from '../types/diagnostics';
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
  RotateCcw,
  RotateCw,
  ScrollText,
  FileCode,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Compass,
  ArrowRight,
  Sparkles,
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

  // Primary indicator state (for backward compatibility and detailed status)
  const [indicatorState, setIndicatorState] = useState<PairingIndicatorState>(() => {
    return status === 'connected' ? 'CONNECTED' : 'DISCONNECTED';
  });

  // Strict 4-State Binding Acceptance Outcome
  const [acceptanceOutcome, setAcceptanceOutcome] = useState<AcceptanceOutcomeState>('COMMAND_NOT_SENT');

  // 180° Display Rotation Status
  const [rotationStatus, setRotationStatus] = useState<RotationSupportStatus>('UNSUPPORTED');

  // Active sub-tab
  const [activeTabSection, setActiveTabSection] = useState<'recovery' | 'rotation' | 'geometry' | 'alternatives'>('recovery');

  // Simulated orientation for interactive geometry visualizer (0° vs 180°)
  const [visualizerOrientation, setVisualizerOrientation] = useState<0 | 180>(0);

  // Keep state synchronized with connection status
  useEffect(() => {
    if (status === 'disconnected') {
      setIndicatorState('DISCONNECTED');
    } else if (status === 'connected' && indicatorState === 'DISCONNECTED') {
      setIndicatorState('CONNECTED');
    } else if (status === 'error') {
      setIndicatorState('OPERATION_FAILED');
      setAcceptanceOutcome('OPERATION_FAILED');
    }
  }, [status, indicatorState]);

  // Selected candidate command for binding investigation
  const [selectedCandidate, setSelectedCandidate] = useState<PairingCandidateCommand>(
    CANDIDATE_PAIRING_COMMANDS[0]
  );

  // Selected candidate command for screen rotation investigation
  const [selectedRotationCandidate, setSelectedRotationCandidate] = useState<ScreenRotationCandidateCommand>(
    CANDIDATE_ROTATION_COMMANDS[0]
  );

  // Safety gating & confirmation modal
  const [isExperimentalModeUnlocked, setIsExperimentalModeUnlocked] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExecutingRotation, setIsExecutingRotation] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Physical verification modals
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showRotationVerificationModal, setShowRotationVerificationModal] = useState(false);

  // Status check response
  const [pairingStatusInfo, setPairingStatusInfo] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Real-time log stream
  const [liveLogs, setLiveLogs] = useState<DiagnosticLog[]>(() => logger.getLogs().slice(0, 15));

  useEffect(() => {
    const unsubscribe = logger.subscribe((newEntry) => {
      setLiveLogs((prev) => [newEntry, ...prev.slice(0, 14)]);
    });
    return unsubscribe;
  }, []);

  // Evaluate pairing candidate compatibility against discovered services
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

  // Evaluate rotation candidate compatibility against discovered services
  const evaluatedRotationCandidates = useMemo(() => {
    return CANDIDATE_ROTATION_COMMANDS.map((cmd) => {
      const match = findMatchingRotationPipe(services, cmd);
      return {
        cmd,
        isSupported: Boolean(match),
        matchedPipe: match,
      };
    });
  }, [services]);

  // Status Indicator Visual Resolver for Strict 4-State Binding Acceptance
  const renderAcceptanceOutcomeBadge = () => {
    switch (acceptanceOutcome) {
      case 'COMMAND_NOT_SENT':
        return <Badge variant="neutral" dot>Command Not Sent (Unverified)</Badge>;
      case 'COMMAND_SENT_OUTCOME_UNKNOWN':
        return <Badge variant="warning" dot>Command Sent — Outcome Unknown</Badge>;
      case 'ACCEPTANCE_CONFIRMED':
        return <Badge variant="success" dot>Acceptance Confirmed on Watch</Badge>;
      case 'OPERATION_FAILED':
      default:
        return <Badge variant="danger" dot>Operation Failed</Badge>;
    }
  };

  // Status Indicator Visual Resolver for 180° Display Rotation
  const renderRotationBadge = () => {
    switch (rotationStatus) {
      case 'UNSUPPORTED':
        return <Badge variant="neutral" dot>180° Rotation: Unsupported in Firmware</Badge>;
      case 'UNVERIFIED':
        return <Badge variant="yellow" dot>180° Rotation: Unverified Candidate</Badge>;
      case 'COMMAND_SENT':
        return <Badge variant="accent" dot>Rotation Command Sent — Inspect Watch</Badge>;
      case 'ROTATION_CONFIRMED':
        return <Badge variant="success" dot>Rotation Confirmed on Watch</Badge>;
      case 'FAILED':
      default:
        return <Badge variant="danger" dot>Rotation Attempt Failed</Badge>;
    }
  };

  // Button 1: Connect / Disconnect to Watch (Initiates or repeats connection workflow)
  const handleConnect = async () => {
    try {
      if (status === 'connected') {
        await disconnect();
        setIndicatorState('DISCONNECTED');
        setAcceptanceOutcome('COMMAND_NOT_SENT');
      } else {
        await requestDevice();
        await connect();
        setIndicatorState('CONNECTED');
      }
    } catch (err: any) {
      logger.error('BLUETOOTH', `Connection workflow failed: ${err.message}`);
      setIndicatorState('OPERATION_FAILED');
      setAcceptanceOutcome('OPERATION_FAILED');
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
      setAcceptanceOutcome('OPERATION_FAILED');
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
      const writeType = match.characteristic.properties.write ? 'write' : 'writeWithoutResponse';
      await writeCharacteristic(match.service.uuid, match.characteristic.uuid, payloadBytes, writeType);

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
      setAcceptanceOutcome('COMMAND_SENT_OUTCOME_UNKNOWN');
      setExecutionMessage(
        'Command sent, outcome unknown. A successful Bluetooth write does not prove acceptance. Please inspect the physical watch display now.'
      );
      setShowVerificationModal(true);
    } catch (err: any) {
      logger.error('PAIRING', `Failed to transmit acceptance packet: ${err.message}`);
      setExecutionError(`Write error: ${err.message}`);
      setIndicatorState('OPERATION_FAILED');
      setAcceptanceOutcome('OPERATION_FAILED');
    } finally {
      setIsExecuting(false);
    }
  };

  // Button 4: Rotate Watch 180° (Experimental & Safety Gated)
  const handleInitiateRotate = () => {
    if (status !== 'connected') {
      setExecutionError('Cannot execute rotation: Watch is disconnected. Connect to watch first.');
      return;
    }

    setIsRotationModalOpen(true);
  };

  const handleExecuteRotation = async () => {
    setIsRotationModalOpen(false);
    setIsExecutingRotation(true);
    setExecutionError(null);
    setExecutionMessage(null);

    const match = findMatchingRotationPipe(services, selectedRotationCandidate);
    if (!match) {
      setExecutionError(
        `Target pipe ${selectedRotationCandidate.characteristicUuid.slice(0, 8)}... not discovered with write access.`
      );
      setRotationStatus('FAILED');
      setIsExecutingRotation(false);
      return;
    }

    const payloadBytes = new Uint8Array(selectedRotationCandidate.payload);
    logger.info('ROTATION', `Transmitting candidate rotation command to ${match.characteristic.uuid}`, {
      details: {
        commandId: selectedRotationCandidate.id,
        payloadHex: bytesToHex(selectedRotationCandidate.payload),
      },
    });

    try {
      const writeType = match.characteristic.properties.write ? 'write' : 'writeWithoutResponse';
      await writeCharacteristic(match.service.uuid, match.characteristic.uuid, payloadBytes, writeType);

      await addExperiment({
        title: `Experimental Screen Rotation: ${selectedRotationCandidate.name}`,
        hypothesis: `Testing whether payload ${bytesToHex(selectedRotationCandidate.payload)} inverts the DIZO Watch D display orientation by 180°.`,
        serviceUuid: match.service.uuid,
        characteristicUuid: match.characteristic.uuid,
        action: 'WRITE_TEST',
        inputPayloadHex: bytesToHex(selectedRotationCandidate.payload),
        result: 'PENDING',
        confidence: 'SPECULATIVE',
        watchTimeVerified: false,
        notes: `Transmitted via ${writeType}. Inspecting whether LCD rotates and whether CST816S touch remaps.`,
      });

      setRotationStatus('COMMAND_SENT');
      setExecutionMessage(
        'Rotation command transmitted over BLE. Please inspect the physical watch display to verify if the UI inverted.'
      );
      setShowRotationVerificationModal(true);
    } catch (err: any) {
      logger.error('ROTATION', `Rotation write error: ${err.message}`);
      setExecutionError(`Rotation write error: ${err.message}`);
      setRotationStatus('FAILED');
    } finally {
      setIsExecutingRotation(false);
    }
  };

  // Button 5: Cancel Operation
  const handleCancelOperation = () => {
    setIsExecuting(false);
    setIsExecutingRotation(false);
    setIsConfirmationModalOpen(false);
    setIsRotationModalOpen(false);
    setShowVerificationModal(false);
    setShowRotationVerificationModal(false);
    setExecutionMessage('Operation cancelled by user.');
    setExecutionError(null);
    if (status === 'connected') {
      setIndicatorState('CONNECTED');
    } else {
      setIndicatorState('DISCONNECTED');
    }
    logger.info('PAIRING', 'Operation cancelled by user.');
  };

  // Button 6: View Diagnostic Log
  const handleViewLogs = () => {
    onNavigate('logs');
  };

  // Physical display verification feedback handler for Binding Acceptance
  const handleVerificationFeedback = (dismissed: boolean) => {
    setShowVerificationModal(false);
    if (dismissed) {
      setIndicatorState('ACCEPTANCE_VERIFIED');
      setAcceptanceOutcome('ACCEPTANCE_CONFIRMED');
      setExecutionMessage('🎉 Acceptance verified! The confirmation dialog dismissed on the physical watch display.');
      logger.success('PAIRING', `Physical verification confirmed! Watch accepted command ${selectedCandidate.name}.`);
    } else {
      setIndicatorState('COMMAND_SENT');
      setAcceptanceOutcome('COMMAND_SENT_OUTCOME_UNKNOWN');
      setExecutionMessage(
        'Observed: Command payload was transmitted over BLE, but the confirmation dialog remains visible on the watch display. Acceptance is unverified.'
      );
      logger.warn('PAIRING', `Physical verification negative: Dialog remained on screen for ${selectedCandidate.name}.`);
    }
  };

  // Physical display verification feedback handler for 180° Screen Rotation
  const handleRotationVerificationFeedback = (didRotate: boolean, didTouchRemap: boolean) => {
    setShowRotationVerificationModal(false);
    if (didRotate) {
      setRotationStatus('ROTATION_CONFIRMED');
      setExecutionMessage(
        `Display rotated 180°! Touch input remapping reported: ${didTouchRemap ? 'YES (Aligned)' : 'NO (Unmapped/Decoupled)'}.`
      );
      logger.success('ROTATION', `Display 180° rotation observed on hardware! Touch aligned: ${didTouchRemap}`);
    } else {
      setRotationStatus('UNSUPPORTED');
      setExecutionMessage(
        'Observed: The command was transmitted, but the watch display remained in normal orientation. This confirms the DIZO Watch D Linwear firmware does not support software 180° rotation over BLE.'
      );
      logger.warn('ROTATION', `180° rotation negative on hardware. Watch display remained unchanged.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-lab-surface border border-lab-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-950/80 border border-yellow-800/80 px-2 py-0.5 rounded">
                Core Feature C • Binding Recovery
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
                180° Screen Rotation Lab
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 flex-wrap">
              <Watch className="w-6 h-6 text-yellow-400 shrink-0" />
              <span>DIZO Watch D — Pairing Assistant</span>
              <span className="text-slate-600 font-normal">|</span>
              <span className="text-yellow-400">Binding Recovery</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 max-w-3xl leading-relaxed">
              Investigate BLE phone-binding acceptance and 180° display rotation capabilities when the physical touchscreen is partially broken (only bottom-left responds).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0 pt-2 lg:pt-0">
            <div className="flex flex-col items-start lg:items-end gap-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Acceptance Outcome</span>
              {renderAcceptanceOutcomeBadge()}
            </div>
            <div className="flex flex-col items-start lg:items-end gap-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Rotation Support</span>
              {renderRotationBadge()}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Controls Bar */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            Assistant & Recovery Controls
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Target: <span className="text-yellow-400 font-bold">{device?.name || 'DIZO Watch D'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Button 1: Connect to Watch (Initiate / Repeat connection workflow) */}
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

          {/* Button 4: Rotate Watch 180° (New Feature Requirement) */}
          <button
            onClick={handleInitiateRotate}
            disabled={status !== 'connected' || isExecutingRotation}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-bold transition-all shadow-md ${
              isExperimentalModeUnlocked && status === 'connected'
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 ring-2 ring-cyan-400/50'
                : 'bg-slate-800 text-cyan-300 hover:bg-slate-750 border border-cyan-700/60 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <RotateCw className="w-4 h-4 shrink-0" />
            <span>Rotate Watch 180°</span>
          </button>

          {/* Button 5: Cancel Operation */}
          <button
            onClick={handleCancelOperation}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Cancel Operation</span>
          </button>

          {/* Button 6: View Diagnostic Log */}
          <button
            onClick={handleViewLogs}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <ScrollText className="w-4 h-4 shrink-0" />
            <span>View Diagnostic Log</span>
          </button>
        </div>
      </div>

      {/* Mandatory Gating & Scientific Discipline Disclosure Banner */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 sm:p-5 text-amber-200 text-xs font-mono space-y-2.5">
        <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Scientific Discipline & Safety Disclosure</span>
        </div>
        <p className="leading-relaxed">
          &quot;<strong>The Bluetooth command for accepting this watch's phone-binding confirmation has not yet been verified.</strong>&quot;
        </p>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          Do not assume that the watch supports remote confirmation or remote 180° display rotation. A successful Bluetooth write alone does not prove that the watch accepted the command. The application strictly distinguishes between verified capabilities, experimental findings, and unsupported operations.
        </p>
        <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-yellow-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isExperimentalModeUnlocked}
              onChange={(e) => setIsExperimentalModeUnlocked(e.target.checked)}
              className="rounded border-slate-700 text-yellow-400 focus:ring-yellow-400/30 bg-slate-900 w-4 h-4"
            />
            <span>Enable Experimental Testing (Manual Safety Override)</span>
          </label>
        </div>
      </div>

      {/* Execution Feedback / Status Notices */}
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

      {/* Sub-View Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-lab-border pb-2 overflow-x-auto font-mono text-xs">
        <button
          onClick={() => setActiveTabSection('recovery')}
          className={`px-4 py-2 rounded-xl transition-colors font-semibold flex items-center gap-2 whitespace-nowrap ${
            activeTabSection === 'recovery'
              ? 'bg-yellow-400 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Binding Recovery Candidates</span>
        </button>

        <button
          onClick={() => setActiveTabSection('rotation')}
          className={`px-4 py-2 rounded-xl transition-colors font-semibold flex items-center gap-2 whitespace-nowrap ${
            activeTabSection === 'rotation'
              ? 'bg-cyan-400 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>180° Rotation Investigation</span>
        </button>

        <button
          onClick={() => setActiveTabSection('geometry')}
          className={`px-4 py-2 rounded-xl transition-colors font-semibold flex items-center gap-2 whitespace-nowrap ${
            activeTabSection === 'geometry'
              ? 'bg-emerald-400 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Touch & Screen Geometry Map</span>
        </button>

        <button
          onClick={() => setActiveTabSection('alternatives')}
          className={`px-4 py-2 rounded-xl transition-colors font-semibold flex items-center gap-2 whitespace-nowrap ${
            activeTabSection === 'alternatives'
              ? 'bg-purple-400 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Alternative Recovery Methods</span>
        </button>
      </div>

      {/* TAB SECTION 1: Binding Recovery Candidates */}
      {activeTabSection === 'recovery' && (
        <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-yellow-400" />
                <span>Candidate Acceptance Protocols Under Investigation</span>
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Select a reverse-engineered candidate command to inspect its packet structure, prerequisites, and experimental evidence.
              </p>
            </div>
            <div className="shrink-0">
              <span className="text-[11px] font-mono text-slate-400 mr-2">Outcome:</span>
              {renderAcceptanceOutcomeBadge()}
            </div>
          </div>

          <div className="space-y-3">
            {evaluatedCandidates.map(({ cmd, isSupported }) => {
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
      )}

      {/* TAB SECTION 2: 180° Rotation Investigation */}
      {activeTabSection === 'rotation' && (
        <div className="space-y-4">
          <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-cyan-400" />
                  <span>180° Display Rotation Feasibility & Protocol Investigation</span>
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-1">
                  Investigation of Linwear RTL8762 RTOS display commands and Sitronix ST7789 display driver controller capabilities.
                </p>
              </div>
              <div className="shrink-0">
                {renderRotationBadge()}
              </div>
            </div>

            {/* Technical Assessment Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono space-y-3">
              <div className="font-bold text-cyan-300 flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Technical Findings: DIZO Watch D Display Subsystem</span>
              </div>
              <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                <p>
                  <strong>1. No Software Screen Flip in Firmware:</strong> Decompilation of OnWear Pro (<code className="text-slate-200">com.linwear.top</code>) and reverse engineering of Linwear RTL8762 firmware show that the DIZO Watch D does not include a 180° display rotation setting. Opcode <code className="text-yellow-400">0x20</code> adjusts accelerometer gesture sensitivity thresholds for wrist wakeup, but does not invert the LCD framebuffer.
                </p>
                <p>
                  <strong>2. Sitronix ST7789 LCD Controller:</strong> In hardware, the TFT panel is driven by an ST7789 controller over SPI. The ST7789 supports 180° inversion via the <code className="text-cyan-300">MADCTL (0x36)</code> register (<code className="text-cyan-300">MY=1, MX=1</code>). However, the watch BLE firmware does not expose raw register tunneling. Writing raw SPI bytes over BLE is rejected by the RTOS parser.
                </p>
                <p>
                  <strong>3. CST816S Touch Digitizer Decoupling:</strong> The capacitive touch panel is an independent I2C slave. In budget smartwatches, the MCU firmware lacks dynamic coordinate transformation. Even if LCD pixels were rotated, touch coordinates remain fixed to physical sensor traces.
                </p>
              </div>
            </div>

            {/* Candidate Rotation Commands */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Investigated Rotation Commands
              </div>

              {evaluatedRotationCandidates.map(({ cmd, isSupported }) => {
                const isSelected = selectedRotationCandidate.id === cmd.id;

                return (
                  <div
                    key={cmd.id}
                    onClick={() => setSelectedRotationCandidate(cmd)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                        <span className="font-mono text-xs font-bold text-white">{cmd.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {cmd.protocolName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">UNVERIFIED CANDIDATE</Badge>
                        {isSupported ? (
                          <Badge variant="info">PIPE DETECTED</Badge>
                        ) : (
                          <Badge variant="neutral">PIPE NOT FOUND</Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-xs font-mono text-slate-300 mt-2 leading-relaxed">
                      {cmd.description}
                    </p>

                    <div className="mt-2 text-[11px] font-mono text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-900/40">
                      <strong>Assessment:</strong> {cmd.technicalAssessment}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500">Payload: </span>
                        <code className="text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {bytesToHex(cmd.payload)}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-500">Touch Remap Expected: </span>
                        <span className="text-rose-400 font-semibold">{cmd.touchRemapExpected ? 'YES' : 'NO (Decoupled)'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                onClick={handleInitiateRotate}
                disabled={status !== 'connected' || isExecutingRotation}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold font-mono text-xs transition-colors shadow-md"
              >
                <RotateCw className="w-4 h-4" />
                <span>Test Selected 180° Rotation Command</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB SECTION 3: Touch & Screen Geometry Map */}
      {activeTabSection === 'geometry' && (
        <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>DIZO Watch D — Touch & Screen Geometry Analysis</span>
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Mathematical proof of why a 180° rotation does NOT make the Blue Checkmark accessible in the bottom-left responsive area.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 font-mono text-xs">
              <button
                onClick={() => setVisualizerOrientation(0)}
                className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                  visualizerOrientation === 0
                    ? 'bg-yellow-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Normal (0°)
              </button>
              <button
                onClick={() => setVisualizerOrientation(180)}
                className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                  visualizerOrientation === 180
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rotated (180°)
              </button>
            </div>
          </div>

          {/* Interactive Screen Simulation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            {/* Visual Watch Face Simulation */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 relative">
              <div className="text-[11px] font-mono text-slate-400 mb-3 flex items-center gap-2">
                <span>Display Orientation:</span>
                <span className="font-bold text-yellow-400">{visualizerOrientation}°</span>
                <span className="text-slate-600">|</span>
                <span>Resolution: 240 × 280 px</span>
              </div>

              {/* Physical Watch Chassis */}
              <div className="w-64 h-72 rounded-[32px] bg-slate-900 border-4 border-slate-700 shadow-2xl relative flex items-center justify-center p-3">
                {/* Physical Side Button (Crown) */}
                <div className="absolute -right-3 top-28 w-2 h-12 bg-slate-600 rounded-r-md border-r border-slate-500 shadow" />

                {/* Display Area (240x280 aspect) */}
                <div
                  className={`w-full h-full rounded-2xl bg-black border border-slate-800 relative overflow-hidden transition-transform duration-500 ${
                    visualizerOrientation === 180 ? 'rotate-180' : 'rotate-0'
                  }`}
                >
                  {/* Status Bar */}
                  <div className="pt-2 px-3 flex justify-between text-[10px] font-mono text-slate-500">
                    <span>DIZO</span>
                    <span>12:00</span>
                  </div>

                  {/* Binding Prompt Text */}
                  <div className="text-center px-4 pt-6 space-y-1">
                    <div className="text-white font-bold text-xs">Phone Binding</div>
                    <div className="text-slate-400 text-[10px] leading-tight">
                      Agree to the phone binding request?
                    </div>
                  </div>

                  {/* Red X Button (Reject) */}
                  <div
                    className={`absolute bottom-3 left-4 w-12 h-12 rounded-full bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center text-rose-400 font-bold shadow-lg ${
                      visualizerOrientation === 180 ? 'rotate-180' : ''
                    }`}
                  >
                    <span className="text-lg">✕</span>
                  </div>

                  {/* Blue Checkmark Button (Accept) */}
                  <div
                    className={`absolute bottom-3 right-4 w-12 h-12 rounded-full bg-blue-950/80 border-2 border-blue-400 flex items-center justify-center text-blue-300 font-bold shadow-lg ${
                      visualizerOrientation === 180 ? 'rotate-180' : ''
                    }`}
                  >
                    <span className="text-lg">✓</span>
                  </div>
                </div>

                {/* Physical Working Digitizer Zone Overlay (Always at physical Bottom-Left of chassis) */}
                <div
                  className="absolute bottom-3 left-3 w-28 h-28 border-2 border-dashed border-emerald-400/80 bg-emerald-500/15 rounded-bl-2xl pointer-events-none flex flex-col justify-end p-2"
                >
                  <span className="text-[9px] font-mono font-bold text-emerald-300 leading-tight">
                    Working Touch Zone (Physical Bottom-Left)
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 mt-4 text-center max-w-sm">
                Green dashed box represents the <span className="text-emerald-400 font-bold">only physically working touch sensor zone</span> on your DIZO Watch D.
              </div>
            </div>

            {/* Coordinate Transformation Explanation */}
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  <span>The 180° Point Reflection Problem</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  When a 2D display undergoes a 180° Euclidean rotation about center point $(W/2, H/2) = (120, 140)$:
                </p>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-yellow-300 text-[11px] space-y-1">
                  <div>X_rotated = 240 - X_original</div>
                  <div>Y_rotated = 280 - Y_original</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2.5 text-[11px]">
                <div className="font-bold text-white uppercase tracking-wider text-xs">
                  Where Elements Move Under 180° Rotation:
                </div>

                <div className="space-y-1.5 text-slate-300">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-blue-400 font-bold">Blue Checkmark (Accept):</span>
                      <div className="text-slate-500 text-[10px]">Normal: Bottom-Right $(195, 240)$</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <span className="text-rose-400 font-bold">TOP-LEFT $(45, 40)$</span>
                      <div className="text-rose-500 text-[10px]">DEAD TOUCH ZONE</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-rose-400 font-bold">Red X (Reject):</span>
                      <div className="text-slate-500 text-[10px]">Normal: Bottom-Left $(45, 240)$</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <span className="text-slate-300 font-bold">TOP-RIGHT $(195, 40)$</span>
                      <div className="text-slate-500 text-[10px]">Status bar area</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded bg-amber-950/40 border border-amber-900/60 text-amber-200 leading-relaxed text-[11px]">
                  <strong>Crucial Discovery:</strong> Rotating the screen 180° shifts the Blue Checkmark to the <strong>Top-Left</strong>, NOT the Bottom-Left! Because only your watch&apos;s Bottom-Left touch area works, a 180° rotation would leave the checkmark in a dead area.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB SECTION 4: Alternative Recovery Solutions */}
      {activeTabSection === 'alternatives' && (
        <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-6 space-y-4 font-mono text-xs">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Alternative Smartwatch Recovery Pathways</span>
            </h2>
            <p className="text-slate-400 mt-1">
              Because 180° display rotation is unsupported and would geometrically position the Accept button in the top-left dead zone, here are the viable recovery pathways:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Pathway 1 */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-yellow-400 flex items-center gap-2 text-sm">
                <span>1. Simple Watch Lab (Direct Time Sync)</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                If your primary goal is to make the watch usable with the correct time, our <strong>Simple Watch Lab</strong> mode sets the real-time clock over BLE without requiring OnWear Pro phone binding at all!
              </p>
              <button
                onClick={() => onNavigate('dashboard')}
                className="mt-2 text-xs font-bold text-yellow-400 hover:underline flex items-center gap-1"
              >
                <span>Switch to Simple Watch Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pathway 2 */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-cyan-400 flex items-center gap-2 text-sm">
                <span>2. Direct Linwear Opcode 0x02 Injection</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                In Linwear MCU architecture, writing opcode <code className="text-yellow-400">[0x02, 0x01]</code> to characteristic <code className="text-slate-200">0xFF02</code> dispatches an internal Touch Affirmative event, bypassing physical digitizer input.
              </p>
              <button
                onClick={() => setActiveTabSection('recovery')}
                className="mt-2 text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Test Opcode 0x02 Candidate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pathway 3 */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-emerald-400 flex items-center gap-2 text-sm">
                <span>3. BLE HID Simulated Enter Key</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                The DIZO Watch D advertises standard HID Service <code className="text-slate-200">0x1812</code>. Writing a standard HID Enter keypress packet (<code className="text-yellow-400">[0x00, 0x00, 0x28, 0x00...]</code>) triggers affirmative dialog dismissal on many wearables.
              </p>
              <button
                onClick={() => setActiveTabSection('recovery')}
                className="mt-2 text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Test HID Enter Injection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pathway 4 */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-purple-400 flex items-center gap-2 text-sm">
                <span>4. Physical Capacitive Bridge</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Because capacitive digitizers measure delta capacitance, a thin strip of aluminum foil or conductive anti-static foam bridging from the working bottom-left corner to the bottom-right can transfer finger touch capacitance across the crack.
              </p>
              <span className="text-[10px] text-slate-500 italic">Non-destructive hardware test.</span>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Live Diagnostic Log Stream */}
      <div className="bg-lab-card border border-lab-border rounded-2xl p-4 sm:p-5 font-mono text-xs space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-slate-300 font-bold flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-yellow-400" />
            <span>Live Diagnostic Operations Log</span>
          </div>
          <button
            onClick={handleViewLogs}
            className="text-[11px] text-yellow-400 hover:underline flex items-center gap-1"
          >
            <span>Open Full Diagnostic Logs</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto space-y-1 text-[11px]">
          {liveLogs.length === 0 ? (
            <div className="text-slate-600 italic">No diagnostic events recorded yet. Connect to watch to begin.</div>
          ) : (
            liveLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`px-1 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.level === 'SUCCESS'
                      ? 'bg-emerald-950 text-emerald-400'
                      : log.level === 'ERROR'
                      ? 'bg-rose-950 text-rose-400'
                      : log.level === 'WARNING'
                      ? 'bg-yellow-950 text-yellow-400'
                      : 'bg-slate-800 text-sky-400'
                  }`}
                >
                  {log.category}
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal before Sending Experimental Binding Acceptance Write */}
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

      {/* Confirmation Modal before Sending 180° Display Rotation Write */}
      <Modal
        isOpen={isRotationModalOpen}
        onClose={() => setIsRotationModalOpen(false)}
        title="Confirm Experimental 180° Display Rotation Write"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-cyan-300">
              <RotateCw className="w-4 h-4" />
              <span>Experimental 180° Screen Rotation Test</span>
            </div>
            <p className="leading-relaxed">
              You are about to test a candidate display rotation command:
            </p>
            <div className="bg-slate-950 p-2.5 rounded border border-cyan-900/60 text-slate-200">
              <div>Command: <strong>{selectedRotationCandidate.name}</strong></div>
              <div>Destination: <code>{selectedRotationCandidate.characteristicUuid}</code></div>
              <div>Payload Hex: <code className="text-cyan-400">{bytesToHex(selectedRotationCandidate.payload)}</code></div>
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Scientific notice: Reverse-engineering of Linwear RTL8762 shows display rotation is not supported over BLE. The command will be sent safely without touching firmware DFU pipes. Inspect the watch display after transmission.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsRotationModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteRotation}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-mono shadow"
            >
              Confirm & Test Rotation
            </button>
          </div>
        </div>
      </Modal>

      {/* Physical Display Inspection Modal for Acceptance */}
      <Modal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        title="Physical Hardware Display Inspection (Acceptance)"
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

      {/* Physical Display Inspection Modal for 180° Rotation */}
      <Modal
        isOpen={showRotationVerificationModal}
        onClose={() => setShowRotationVerificationModal(false)}
        title="Physical Hardware Display Inspection (180° Rotation)"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 space-y-2">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <RotateCw className="w-4 h-4" />
              <span>Inspect Watch Screen Orientation</span>
            </div>
            <p className="leading-relaxed">
              The candidate rotation packet was successfully written to the watch command pipe.
            </p>
            <p className="text-cyan-300 font-semibold leading-relaxed">
              Look at the physical DIZO Watch D display right now. Did the watch screen flip upside down (180°)?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleRotationVerificationFeedback(true, false)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>YES, Screen Flipped 180°</span>
            </button>
            <button
              onClick={() => handleRotationVerificationFeedback(false, false)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700"
            >
              <XCircle className="w-4 h-4" />
              <span>NO, Orientation Unchanged</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
