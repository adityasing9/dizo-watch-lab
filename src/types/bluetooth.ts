export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface BluetoothCapability {
  isSupported: boolean;
  isSecureContext: boolean;
  browserInfo: string;
  hasDeviceChooser: boolean;
  reason?: string;
  recommendations: string[];
}

export interface GattCharacteristicProperties {
  read: boolean;
  write: boolean;
  writeWithoutResponse: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites?: boolean;
  broadcast?: boolean;
  reliableWrite?: boolean;
  writableAuxiliaries?: boolean;
}

export interface GattCharacteristicInfo {
  uuid: string;
  normalizedUuid: string;
  name: string;
  isStandard: boolean;
  serviceUuid: string;
  properties: GattCharacteristicProperties;
  lastValueHex?: string;
  lastValueBytes?: number[];
  lastValueAscii?: string;
  lastReadTimestamp?: number;
  isNotifying?: boolean;
  lastError?: string;
  isObservedReference?: boolean;
  referenceNotes?: string;
}

export interface GattServiceInfo {
  uuid: string;
  normalizedUuid: string;
  name: string;
  isStandard: boolean;
  isPrimary: boolean;
  characteristics: GattCharacteristicInfo[];
  isObservedReference?: boolean;
  referenceNotes?: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string | null;
  connected: boolean;
  connectedAt?: number;
  disconnectedAt?: number;
}

export interface NotificationEvent {
  id: string;
  timestamp: number;
  serviceUuid: string;
  characteristicUuid: string;
  payloadHex: string;
  payloadBytes: number[];
  payloadLength: number;
  asciiPreview: string;
  utf8Preview?: string;
}

export type TimeSyncInvestigationStatus =
  | 'NOT_INVESTIGATED'
  | 'INVESTIGATION_IN_PROGRESS'
  | 'POSSIBLE_CHARACTERISTIC_IDENTIFIED'
  | 'CANDIDATE_COMMAND_IDENTIFIED'
  | 'COMMAND_TESTED'
  | 'TIME_SYNC_VERIFIED'
  | 'UNSUPPORTED_OR_UNRESOLVED';

export interface ProtocolExperiment {
  id: string;
  timestamp: number;
  title: string;
  hypothesis: string;
  serviceUuid: string;
  characteristicUuid: string;
  action: 'READ' | 'SUBSCRIBE' | 'WRITE_TEST' | 'TIME_SYNC_ATTEMPT';
  inputPayloadHex?: string;
  result: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'INCONCLUSIVE';
  responseHex?: string;
  confidence: 'NONE' | 'SPECULATIVE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
  watchTimeVerified: boolean;
  notes: string;
}

export interface TimeCandidateProtocol {
  id: string;
  name: string;
  description: string;
  serviceUuid: string;
  characteristicUuid: string;
  writeType: 'write' | 'writeWithoutResponse';
  confidence: 'SPECULATIVE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
  buildPayload: (date: Date) => { hex: string; bytes: number[]; explanation: string };
  prerequisites: string[];
  referenceNotes: string;
}
