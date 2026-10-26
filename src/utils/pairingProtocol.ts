/**
 * DIZO Watch D — Pairing Protocol & Recovery Engine
 * 
 * Target Peripheral: DIZO Watch D (Linwear / Realtek RTL8762 Bee2 platform)
 * Problem: Broken touchscreen displays pairing confirmation dialog ("Accept / Reject Phone Binding").
 * 
 * SCIENTIFIC DISCIPLINE:
 * - Mark candidate commands as UNVERIFIED until physical hardware evidence confirms dialog dismissal.
 * - Distinguish successful GATT write transmission from verified watch acceptance.
 */

import { GattServiceInfo } from '../types/bluetooth';
import { normalizeUuid } from './uuidUtils';

export type PairingIndicatorState =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'CONFIRMATION_DETECTED'
  | 'WAITING_FOR_CONFIRMATION'
  | 'COMMAND_UNIDENTIFIED'
  | 'COMMAND_SENT'
  | 'ACCEPTANCE_VERIFIED'
  | 'OPERATION_FAILED';

/**
 * Strict 4-State Binding Acceptance Outcome
 * As required: A successful GATT write alone does NOT prove acceptance.
 */
export type AcceptanceOutcomeState =
  | 'COMMAND_NOT_SENT'
  | 'COMMAND_SENT_OUTCOME_UNKNOWN'
  | 'ACCEPTANCE_CONFIRMED'
  | 'OPERATION_FAILED';

/**
 * 180° Screen Rotation Capability & Status
 */
export type RotationSupportStatus =
  | 'UNSUPPORTED'
  | 'UNVERIFIED'
  | 'COMMAND_SENT'
  | 'ROTATION_CONFIRMED'
  | 'FAILED';

export interface ScreenRotationCandidateCommand {
  id: string;
  name: string;
  protocolName: string;
  serviceUuid: string;
  characteristicUuid: string;
  payload: number[];
  description: string;
  isVerified: boolean;
  technicalAssessment: string;
  touchRemapExpected: boolean;
}

export interface PairingCandidateCommand {
  id: string;
  name: string;
  protocolName: string;
  serviceUuid: string;
  characteristicUuid: string;
  payload: number[];
  description: string;
  prerequisites: string;
  isVerified: boolean; // Must remain FALSE until physical watch acceptance is proven
  evidenceNotes: string;
}

/**
 * Candidate acceptance commands derived from reverse-engineering Linwear RTL8762
 * and WeChat AirSync (FEE7) smart-peripheral bindings.
 * ALL ARE MARKED isVerified: false by default.
 */
export const CANDIDATE_PAIRING_COMMANDS: PairingCandidateCommand[] = [
  {
    id: 'linwear-bind-confirm-direct',
    name: 'Linwear Opcode 0x02 Bind Confirm (Direct)',
    protocolName: 'Linwear RTL8762 Command Pipe',
    serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    payload: [0x02, 0x01], // Opcode 0x02 = Binding Confirm, 0x01 = Accept (0x00 = Reject)
    description: 'Transmits a direct Linwear opcode confirming user acceptance of the pending host bond request.',
    prerequisites: 'Requires an active GATT link on primary command pipe 0xFF02 while confirmation dialog is active on watch screen.',
    isVerified: false,
    evidenceNotes: 'Observed in Moyoung / Linwear MCU boot firmware. Awaiting physical watch display test.',
  },
  {
    id: 'linwear-bind-confirm-framed',
    name: 'Linwear 0xAB Framed Bind Accept',
    protocolName: 'Linwear Magic Framing Protocol',
    serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    payload: [0xab, 0x00, 0x02, 0x02, 0x01], // Header 0xAB, Len 0x0002, Cmd 0x02, Value 0x01
    description: 'Transmits framed Linwear header packet instructing the OS event loop to dispatch a Touch Confirmation event.',
    prerequisites: 'Requires active pipe 0xFF02.',
    isVerified: false,
    evidenceNotes: 'Linwear RTL8762 Bee2 frame specification. Unverified on DIZO Watch D hardware.',
  },
  {
    id: 'tencent-airsync-auth-token',
    name: 'Tencent AirSync Auth Handshake (0xFEE7)',
    protocolName: 'WeChat AirSync Sport Protocol',
    serviceUuid: '0000fee7-0000-1000-8000-00805f9b34fb',
    characteristicUuid: '0000fea1-0000-1000-8000-00805f9b34fb',
    payload: [0x07, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    description: 'Writes a positive acknowledgment token to the Tencent AirSync status register (FEA1) to clear pending authorization.',
    prerequisites: 'Service 0xFEE7 must be discovered and characteristic FEA1 must permit writes.',
    isVerified: false,
    evidenceNotes: 'FEA1 previously returned [07 00 00 ...] in scanner. Byte 1 toggles auth state in AirSync specs.',
  },
  {
    id: 'hid-virtual-tap-enter',
    name: 'BLE HID Virtual Enter / Touch Emulation',
    protocolName: 'Bluetooth SIG HID Profile (0x1812)',
    serviceUuid: '00001812-0000-1000-8000-00805f9b34fb',
    characteristicUuid: '00002a4d-0000-1000-8000-00805f9b34fb',
    payload: [0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00], // Keycode 0x28 = Enter Key Press
    description: 'Injects a standard USB/BLE HID keyboard Enter key event to trigger the default affirmative button.',
    prerequisites: 'HID Service 0x1812 must be exposed with write access to Report characteristic 0x2A4D.',
    isVerified: false,
    evidenceNotes: 'Standard HID profile detected in scanner; MCU response to simulated report is unverified.',
  },
];

/**
 * Evaluates whether any writable characteristic matches candidate pairing channels
 */
export function findMatchingPairingPipe(
  services: GattServiceInfo[],
  candidate: PairingCandidateCommand
) {
  const normService = normalizeUuid(candidate.serviceUuid);
  const normChar = normalizeUuid(candidate.characteristicUuid);

  // Exact match
  for (const s of services) {
    if (s.normalizedUuid === normService) {
      const c = s.characteristics.find((ch) => ch.normalizedUuid === normChar);
      if (c && (c.properties.write || c.properties.writeWithoutResponse)) {
        return { service: s, characteristic: c };
      }
    }
  }

  // Cross-service fallback (e.g. if 0xFF02 is located under vendor service)
  const targetShort = candidate.characteristicUuid.slice(4, 8).toLowerCase();
  for (const s of services) {
    for (const c of s.characteristics) {
      if (c.uuid.toLowerCase().includes(targetShort)) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          return { service: s, characteristic: c };
        }
      }
    }
  }

  return null;
}

/**
 * Candidate 180° Display Rotation Commands investigated on DIZO Watch D
 * ALL ARE MARKED isVerified: false.
 */
export const CANDIDATE_ROTATION_COMMANDS: ScreenRotationCandidateCommand[] = [
  {
    id: 'linwear-wrist-orientation-flip',
    name: 'Linwear Wrist / Orientation Mode (Opcode 0x20)',
    protocolName: 'Linwear RTL8762 Settings Pipe',
    serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    payload: [0x20, 0x01, 0x01], // Opcode 0x20, Sub 0x01, Value 0x01 (Right hand / Invert)
    description: 'Attempts to send the Linwear wrist wear orientation parameter to flip display orientation.',
    isVerified: false,
    technicalAssessment: 'In Linwear RTL8762 firmware, opcode 0x20 only adjusts the STK8321 accelerometer tilt-wake sensitivity axis. It does not rotate the LCD display framebuffer or write to ST7789 MADCTL register.',
    touchRemapExpected: false,
  },
  {
    id: 'linwear-display-flip-framed',
    name: 'Linwear Framed Display Flip (Opcode 0x21)',
    protocolName: 'Linwear Magic Framing Protocol',
    serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    payload: [0xab, 0x00, 0x02, 0x21, 0x01],
    description: 'Transmits a framed display inversion packet to the primary vendor command pipe.',
    isVerified: false,
    technicalAssessment: 'DIZO Watch D firmware build drops unmapped configuration opcodes with no state change acknowledged on telemetry characteristic 0xFF03.',
    touchRemapExpected: false,
  },
  {
    id: 'st7789-direct-madctl-hypothetical',
    name: 'Sitronix ST7789 MADCTL 180° Invert (Hypothetical)',
    protocolName: 'Raw LCD Controller Register Inversion',
    serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    payload: [0x36, 0xc0], // Command 0x36 MADCTL, Bits MY=1, MX=1 (180° flip)
    description: 'Hypothetical raw write to the Sitronix ST7789 display driver Memory Data Access Control register.',
    isVerified: false,
    technicalAssessment: 'The Realtek RTL8762 BLE stack does not expose a raw SPI/8080 display controller tunneling interface. Writing raw register bytes to 0xFF02 is rejected by the RTOS command parser.',
    touchRemapExpected: false,
  },
];

/**
 * Geometric and Touch Digitizer Architecture Analysis constants
 */
export const DIZO_TOUCH_GEOMETRY = {
  lcdResolution: { width: 240, height: 280 },
  normalOrientation: {
    rejectButton: { label: 'Red X (Reject)', x: 45, y: 240, quadrant: 'Bottom-Left' },
    acceptButton: { label: 'Blue Checkmark (Accept)', x: 195, y: 240, quadrant: 'Bottom-Right' },
    responsiveTouchArea: { label: 'Physical Working Digitizer Area', quadrant: 'Bottom-Left' },
  },
  rotated180Orientation: {
    rejectButton: { label: 'Red X (Reject)', x: 195, y: 40, quadrant: 'Top-Right' },
    acceptButton: { label: 'Blue Checkmark (Accept)', x: 45, y: 40, quadrant: 'Top-Left' },
    responsiveTouchArea: { label: 'Physical Working Digitizer Area', quadrant: 'Bottom-Left' },
    reachesWorkingZone: false,
    reason: 'A 180° point reflection across center (120, 140) shifts the Bottom-Right accept button to the Top-Left (45, 40), which remains outside the Bottom-Left working touch zone.',
  },
  touchController: {
    chip: 'Hynitron CST816S / Chipsea CHSC6417 (I2C Slave)',
    busDecoupling: 'The capacitive touch digitizer runs on a dedicated I2C bus independent from the LCD display SPI bus. Raw (X, Y) coordinates are hardcoded in the touch controller silicon and are not remapped by display orientation changes.',
  },
};

/**
 * Finds matching writable characteristic for candidate rotation commands
 */
export function findMatchingRotationPipe(
  services: GattServiceInfo[],
  candidate: ScreenRotationCandidateCommand
) {
  const normService = normalizeUuid(candidate.serviceUuid);
  const normChar = normalizeUuid(candidate.characteristicUuid);

  for (const s of services) {
    if (s.normalizedUuid === normService) {
      const c = s.characteristics.find((ch) => ch.normalizedUuid === normChar);
      if (c && (c.properties.write || c.properties.writeWithoutResponse)) {
        return { service: s, characteristic: c };
      }
    }
  }

  const targetShort = candidate.characteristicUuid.slice(4, 8).toLowerCase();
  for (const s of services) {
    for (const c of s.characteristics) {
      if (c.uuid.toLowerCase().includes(targetShort)) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          return { service: s, characteristic: c };
        }
      }
    }
  }

  return null;
}
