import { normalizeUuid, validateUuid } from '../utils/uuidUtils';

export interface KnownUuidEntry {
  uuid: string;
  name: string;
  category: 'standard' | 'vendor' | 'observed_unverified';
  description: string;
  notes?: string;
  statusWarning?: string;
  specUrl?: string;
}

// Bluetooth SIG Standard Services
export const STANDARD_SERVICES: Record<string, KnownUuidEntry> = {
  '00001800-0000-1000-8000-00805f9b34fb': {
    uuid: '00001800-0000-1000-8000-00805f9b34fb',
    name: 'Generic Access',
    category: 'standard',
    description: 'Defines basic parameters of device name, appearance, and peripheral connection parameters.',
    specUrl: 'https://www.bluetooth.com/specifications/gatt/services/',
  },
  '00001801-0000-1000-8000-00805f9b34fb': {
    uuid: '00001801-0000-1000-8000-00805f9b34fb',
    name: 'Generic Attribute',
    category: 'standard',
    description: 'Informs client of service changes on the server.',
    specUrl: 'https://www.bluetooth.com/specifications/gatt/services/',
  },
  '00001805-0000-1000-8000-00805f9b34fb': {
    uuid: '00001805-0000-1000-8000-00805f9b34fb',
    name: 'Current Time Service (CTS)',
    category: 'standard',
    description: 'Bluetooth SIG standard service exposing current time, date, day of week, and fractions of second. Primary candidate for time synchronization if supported by watch firmware.',
    specUrl: 'https://www.bluetooth.com/specifications/specs/current-time-service-1-1/',
  },
  '0000180a-0000-1000-8000-00805f9b34fb': {
    uuid: '0000180a-0000-1000-8000-00805f9b34fb',
    name: 'Device Information',
    category: 'standard',
    description: 'Manufacturer name, model number, serial number, hardware revision, firmware revision, software revision.',
    specUrl: 'https://www.bluetooth.com/specifications/gatt/services/',
  },
  '0000180f-0000-1000-8000-00805f9b34fb': {
    uuid: '0000180f-0000-1000-8000-00805f9b34fb',
    name: 'Battery Service',
    category: 'standard',
    description: 'Exposes battery level percentage.',
  },
  '00001812-0000-1000-8000-00805f9b34fb': {
    uuid: '00001812-0000-1000-8000-00805f9b34fb',
    name: 'Human Interface Device (HID)',
    category: 'standard',
    description: 'Provides HID services for buttons, gestures, and input reports.',
  },
  '0000180d-0000-1000-8000-00805f9b34fb': {
    uuid: '0000180d-0000-1000-8000-00805f9b34fb',
    name: 'Heart Rate',
    category: 'standard',
    description: 'Exposes heart rate measurement data and sensor location.',
  },
  '00001802-0000-1000-8000-00805f9b34fb': {
    uuid: '00001802-0000-1000-8000-00805f9b34fb',
    name: 'Immediate Alert',
    category: 'standard',
    description: 'Used to alert device (e.g. Find My Watch buzzer / vibration).',
  },
  '0000fee0-0000-1000-8000-00805f9b34fb': {
    uuid: '0000fee0-0000-1000-8000-00805f9b34fb',
    name: 'Vendor Wearable Service (Anhui Huami / Zepp / FitCloud)',
    category: 'vendor',
    description: 'Common 16-bit member UUID assigned to wearable manufacturers for custom sensor and sync telemetry.',
  },
  '0000fee7-0000-1000-8000-00805f9b34fb': {
    uuid: '0000fee7-0000-1000-8000-00805f9b34fb',
    name: 'Tencent WeChat / Wearable Sports Service',
    category: 'vendor',
    description: 'Widely used in Chinese smartwatch SoCs for step sync and phone-watch pairing.',
  },
};

// Bluetooth SIG Standard Characteristics
export const STANDARD_CHARACTERISTICS: Record<string, KnownUuidEntry> = {
  '00002a00-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a00-0000-1000-8000-00805f9b34fb',
    name: 'Device Name',
    category: 'standard',
    description: 'UTF-8 string representing the advertised or configured device name.',
  },
  '00002a01-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a01-0000-1000-8000-00805f9b34fb',
    name: 'Appearance',
    category: 'standard',
    description: '16-bit value indicating external appearance category (e.g., Smartwatch = 0x00C0).',
  },
  '00002a04-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a04-0000-1000-8000-00805f9b34fb',
    name: 'Peripheral Preferred Connection Parameters',
    category: 'standard',
    description: 'Min/max connection interval, slave latency, and connection supervision timeout.',
  },
  '00002a05-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a05-0000-1000-8000-00805f9b34fb',
    name: 'Service Changed',
    category: 'standard',
    description: 'GATT indication indicating affected attribute handle range when services change.',
  },
  '00002a2b-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a2b-0000-1000-8000-00805f9b34fb',
    name: 'Current Time',
    category: 'standard',
    description: '10-byte structure: Year (uint16 LE), Month (1-12), Day (1-31), Hours (0-23), Minutes (0-59), Seconds (0-59), DayOfWeek (1-7), Fractions256 (0-255), AdjustReason (bitmask).',
  },
  '00002a0f-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a0f-0000-1000-8000-00805f9b34fb',
    name: 'Local Time Information',
    category: 'standard',
    description: 'Time Zone (sint8 in 15-minute increments) and DST offset (uint8).',
  },
  '00002a29-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a29-0000-1000-8000-00805f9b34fb',
    name: 'Manufacturer Name String',
    category: 'standard',
    description: 'UTF-8 string of the hardware manufacturer.',
  },
  '00002a24-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a24-0000-1000-8000-00805f9b34fb',
    name: 'Model Number String',
    category: 'standard',
    description: 'UTF-8 string of device model (e.g. DIZO Watch D / DW2121 / DW2111).',
  },
  '00002a25-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a25-0000-1000-8000-00805f9b34fb',
    name: 'Serial Number String',
    category: 'standard',
    description: 'Device hardware serial number.',
  },
  '00002a26-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a26-0000-1000-8000-00805f9b34fb',
    name: 'Firmware Revision String',
    category: 'standard',
    description: 'Firmware revision string on MCU.',
  },
  '00002a27-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a27-0000-1000-8000-00805f9b34fb',
    name: 'Hardware Revision String',
    category: 'standard',
    description: 'Hardware revision string.',
  },
  '00002a28-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a28-0000-1000-8000-00805f9b34fb',
    name: 'Software Revision String',
    category: 'standard',
    description: 'Software revision string.',
  },
  '00002a19-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a19-0000-1000-8000-00805f9b34fb',
    name: 'Battery Level',
    category: 'standard',
    description: 'Single byte (uint8) value 0 to 100 representing battery state of charge.',
  },
  '00002a4d-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a4d-0000-1000-8000-00805f9b34fb',
    name: 'HID Report',
    category: 'standard',
    description: 'HID Input/Output/Feature report.',
  },
  '00002a4e-0000-1000-8000-00805f9b34fb': {
    uuid: '00002a4e-0000-1000-8000-00805f9b34fb',
    name: 'Protocol Mode',
    category: 'standard',
    description: 'Boot Protocol Mode or Report Protocol Mode for HID devices.',
  },
};

// Section 9: Observed reference data from manual inspection
export const OBSERVED_REFERENCE_SERVICES: KnownUuidEntry[] = [
  {
    uuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
    name: 'Observed Service: 01FF (Proprietary Sync)',
    category: 'observed_unverified',
    description: 'Observed during preliminary inspection of DIZO Watch D. Likely proprietary telemetry or command channel.',
    notes: 'Previously observed — verification required. Live GATT discovery takes precedence.',
  },
  {
    // Note: 9 hex chars in chunk 1 (00000d0ff -> 9 chars). Marked with explicit validation warning.
    uuid: '00000d0ff-3c17-d293-8e48-14fe2e4da212',
    name: 'Observed Service: 0D0FF (Potentially Malformed UUID)',
    category: 'observed_unverified',
    description: 'Observed in manual notes with 9 characters in the first segment (00000D0FF).',
    notes: 'Previously observed — verification required. Note: Non-standard 128-bit length (9-4-4-4-12). May be a typo of 0000d0ff or 000000ff.',
    statusWarning: 'Non-standard 128-bit length (33 hex chars). Live scan will determine actual UUID exposed by peripheral.',
  },
  {
    uuid: '00006287-3c17-d293-8e48-14fe2e4da212',
    name: 'Observed Service: 6287 (Proprietary Control/Data)',
    category: 'observed_unverified',
    description: 'Observed custom vendor service on 3C17-D293-8E48-14FE2E4DA212 base UUID.',
    notes: 'Previously observed — verification required.',
  },
];

export const OBSERVED_REFERENCE_CHARACTERISTICS: KnownUuidEntry[] = [
  {
    uuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FF02 (Vendor Command/Tx)',
    category: 'observed_unverified',
    description: 'Common vendor command pipe characteristic on base Bluetooth SIG UUID space. Frequently used in Realtek/Moyoung/HunterSun smartwatches for phone-to-watch commands.',
    notes: 'Previously observed — verification required. Do not automatically write without user inspection and confirmation.',
  },
  {
    uuid: '0000ff03-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FF03 (Vendor Notify/Rx)',
    category: 'observed_unverified',
    description: 'Vendor notification/indication characteristic often paired with FF02 to receive responses from watch MCU.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '0000ff04-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FF04 (Vendor Stream/Config)',
    category: 'observed_unverified',
    description: 'Vendor stream or configuration characteristic.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '0000ffd2-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FFD2 (OTA / Command In)',
    category: 'observed_unverified',
    description: 'Observed secondary command channel or Over-The-Air firmware pipe characteristic.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '0000ffd3-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FFD3 (OTA / Notify Out)',
    category: 'observed_unverified',
    description: 'Observed secondary notify channel.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '0000ffd4-0000-1000-8000-00805f9b34fb',
    name: 'Observed Char: FFD4 (OTA / Status)',
    category: 'observed_unverified',
    description: 'Observed secondary status characteristic.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '00006387-3c17-d293-8e48-14fe2e4da212',
    name: 'Observed Char: 6387 (Proprietary Pipe A)',
    category: 'observed_unverified',
    description: 'Characteristic paired under custom vendor service 6287.',
    notes: 'Previously observed — verification required.',
  },
  {
    uuid: '00006487-3c17-d293-8e48-14fe2e4da212',
    name: 'Observed Char: 6487 (Proprietary Pipe B)',
    category: 'observed_unverified',
    description: 'Characteristic paired under custom vendor service 6287.',
    notes: 'Previously observed — verification required.',
  },
];

/**
 * Returns optional services list needed for navigator.bluetooth.requestDevice().
 * Web Bluetooth strictly requires any services that will be accessed via getPrimaryServices()
 * to be declared in `optionalServices` when using `acceptAllDevices: true`.
 */
export function getStandardAndObservedServiceUuids(): string[] {
  const serviceUuids = new Set<string>();

  // Add all standard 128-bit services (always strings)
  Object.keys(STANDARD_SERVICES).forEach((u) => {
    if (typeof u === 'string' && u.trim().length > 0) {
      serviceUuids.add(u.toLowerCase());
    }
  });

  // Add observed reference services (only valid 128-bit UUID strings)
  OBSERVED_REFERENCE_SERVICES.forEach((s) => {
    const val = validateUuid(s.uuid);
    if (val.isValid && typeof val.normalized === 'string') {
      serviceUuids.add(val.normalized.toLowerCase());
    }
  });

  return Array.from(serviceUuids).filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * Looks up human-readable metadata for a service UUID.
 */
export function lookupServiceInfo(rawUuid: string): KnownUuidEntry {
  const norm = normalizeUuid(rawUuid);

  if (STANDARD_SERVICES[norm]) {
    return STANDARD_SERVICES[norm];
  }

  const observed = OBSERVED_REFERENCE_SERVICES.find((s) => s.uuid.toLowerCase() === norm);
  if (observed) {
    return observed;
  }

  // Check 16-bit prefix if on standard base
  if (norm.endsWith('-0000-1000-8000-00805f9b34fb')) {
    const hex16 = norm.substring(4, 8);
    return {
      uuid: norm,
      name: `Unknown Standard Service (0x${hex16.toUpperCase()})`,
      category: 'standard',
      description: `Unrecognized 16-bit Bluetooth SIG assigned service 0x${hex16.toUpperCase()}.`,
    };
  }

  return {
    uuid: rawUuid,
    name: 'Custom / Unknown Service',
    category: 'vendor',
    description: 'Vendor-defined or proprietary service UUID.',
  };
}

/**
 * Looks up human-readable metadata for a characteristic UUID.
 */
export function lookupCharacteristicInfo(rawUuid: string): KnownUuidEntry {
  const norm = normalizeUuid(rawUuid);

  if (STANDARD_CHARACTERISTICS[norm]) {
    return STANDARD_CHARACTERISTICS[norm];
  }

  const observed = OBSERVED_REFERENCE_CHARACTERISTICS.find((c) => c.uuid.toLowerCase() === norm);
  if (observed) {
    return observed;
  }

  if (norm.endsWith('-0000-1000-8000-00805f9b34fb')) {
    const hex16 = norm.substring(4, 8);
    return {
      uuid: norm,
      name: `Unknown Standard Characteristic (0x${hex16.toUpperCase()})`,
      category: 'standard',
      description: `Unrecognized 16-bit Bluetooth SIG assigned characteristic 0x${hex16.toUpperCase()}.`,
    };
  }

  return {
    uuid: rawUuid,
    name: 'Custom / Unknown Characteristic',
    category: 'vendor',
    description: 'Vendor-defined or proprietary characteristic UUID.',
  };
}
