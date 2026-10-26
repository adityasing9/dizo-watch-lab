/**
 * UUID Utilities for Bluetooth LE
 * Handles 16-bit, 32-bit, and 128-bit UUIDs, formatting, and RFC 4122 compliance validation.
 */

// Bluetooth Base UUID: 00000000-0000-1000-8000-00805F9B34FB
export const BLUETOOTH_BASE_UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';

export interface UuidValidationResult {
  isValid: boolean;
  type: '16-bit' | '32-bit' | '128-bit' | 'invalid';
  normalized: string;
  error?: string;
  warning?: string;
}

/**
 * Validates a UUID string and checks standard format compliance.
 */
export function validateUuid(rawUuid: string): UuidValidationResult {
  if (!rawUuid || typeof rawUuid !== 'string') {
    return {
      isValid: false,
      type: 'invalid',
      normalized: '',
      error: 'UUID is empty or not a string',
    };
  }

  const trimmed = rawUuid.trim().toLowerCase();

  // Handle 16-bit hex alias: e.g. "0x180d", "180d"
  const cleanHex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;

  if (/^[0-9a-f]{4}$/.test(cleanHex)) {
    const full128 = `0000${cleanHex}${BLUETOOTH_BASE_UUID_SUFFIX}`;
    return {
      isValid: true,
      type: '16-bit',
      normalized: full128,
    };
  }

  // Handle 32-bit hex alias: e.g. "0000180d"
  if (/^[0-9a-f]{8}$/.test(cleanHex)) {
    const full128 = `${cleanHex}${BLUETOOTH_BASE_UUID_SUFFIX}`;
    return {
      isValid: true,
      type: '32-bit',
      normalized: full128,
    };
  }

  // Handle 128-bit formatted UUID: standard 8-4-4-4-12 hex format
  const parts = trimmed.split('-');
  if (parts.length === 5) {
    const [p1, p2, p3, p4, p5] = parts;
    const isStandardLength =
      p1.length === 8 &&
      p2.length === 4 &&
      p3.length === 4 &&
      p4.length === 4 &&
      p5.length === 12;

    const allHex = parts.every((p) => /^[0-9a-f]+$/.test(p));

    if (!allHex) {
      return {
        isValid: false,
        type: 'invalid',
        normalized: trimmed,
        error: 'UUID contains non-hexadecimal characters',
      };
    }

    if (!isStandardLength) {
      const totalChars = parts.join('').length;
      return {
        isValid: false,
        type: 'invalid',
        normalized: trimmed,
        error: `Malformed 128-bit UUID segment lengths (${p1.length}-${p2.length}-${p3.length}-${p4.length}-${p5.length}). Standard requires 8-4-4-4-12 (${totalChars} hex digits total, standard is 32).`,
        warning: totalChars !== 32 ? `Has ${totalChars} hex characters instead of standard 32.` : undefined,
      };
    }

    return {
      isValid: true,
      type: '128-bit',
      normalized: trimmed,
    };
  }

  // Non-hyphenated 32 hex chars
  if (/^[0-9a-f]{32}$/.test(cleanHex)) {
    const formatted = `${cleanHex.slice(0, 8)}-${cleanHex.slice(8, 12)}-${cleanHex.slice(12, 16)}-${cleanHex.slice(16, 20)}-${cleanHex.slice(20)}`;
    return {
      isValid: true,
      type: '128-bit',
      normalized: formatted,
    };
  }

  return {
    isValid: false,
    type: 'invalid',
    normalized: trimmed,
    error: 'Unrecognized UUID format. Expected 16-bit hex (0x1800), 32-bit hex, or 128-bit hyphenated (8-4-4-4-12).',
  };
}

/**
 * Normalizes UUID to standard lowercase 128-bit format if valid, or lowercase string if non-standard.
 */
export function normalizeUuid(rawUuid: string): string {
  const result = validateUuid(rawUuid);
  return result.normalized || rawUuid.trim().toLowerCase();
}

/**
 * Compares two UUIDs for equality, matching standard 16-bit and 128-bit representations.
 */
export function areUuidsEqual(uuidA: string, uuidB: string): boolean {
  if (!uuidA || !uuidB) return false;
  const normA = normalizeUuid(uuidA);
  const normB = normalizeUuid(uuidB);
  return normA === normB;
}

/**
 * Formats a UUID for clean display: converts standard Bluetooth SIG UUIDs to short 16-bit alias with full in tooltip.
 */
export function formatUuidDisplay(uuid: string): { short: string; full: string; isStandard: boolean } {
  const normalized = normalizeUuid(uuid);
  if (normalized.endsWith(BLUETOOTH_BASE_UUID_SUFFIX)) {
    const prefix = normalized.substring(4, 8);
    return {
      short: `0x${prefix.toUpperCase()}`,
      full: normalized,
      isStandard: true,
    };
  }
  return {
    short: normalized,
    full: normalized,
    isStandard: false,
  };
}
