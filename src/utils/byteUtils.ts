/**
 * Byte and Hexadecimal formatting utilities for BLE diagnostics
 */

export function uint8ArrayFromSource(source: DataView | Uint8Array | number[] | ArrayBuffer): Uint8Array {
  if (source instanceof Uint8Array) {
    return source;
  }
  if (source instanceof DataView) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  if (Array.isArray(source)) {
    return new Uint8Array(source);
  }
  return new Uint8Array();
}

/**
 * Converts bytes to space-separated uppercase hexadecimal string.
 * Example: Uint8Array([1, 15, 255]) -> "01 0F FF"
 */
export function bytesToHex(source: DataView | Uint8Array | number[] | ArrayBuffer): string {
  const bytes = uint8ArrayFromSource(source);
  if (bytes.length === 0) return '';
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Converts a hex string into a Uint8Array.
 * Accepts "01 02 03", "010203", "0x01, 0x02", etc.
 */
export function hexToBytes(hex: string): { bytes: Uint8Array; error?: string } {
  if (!hex || typeof hex !== 'string') {
    return { bytes: new Uint8Array(0) };
  }

  // Remove common separators and prefixes
  const cleaned = hex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');

  if (cleaned.length % 2 !== 0) {
    return {
      bytes: new Uint8Array(0),
      error: 'Hex string must contain an even number of hexadecimal digits.',
    };
  }

  const result = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    result[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }

  return { bytes: result };
}

/**
 * Decodes bytes to UTF-8 text. Returns null if invalid or mostly unprintable binary.
 */
export function bytesToUtf8(source: DataView | Uint8Array | number[] | ArrayBuffer): string {
  const bytes = uint8ArrayFromSource(source);
  if (bytes.length === 0) return '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Decodes bytes to safe ASCII representation, replacing control / non-ASCII characters with '.'
 */
export function bytesToAscii(source: DataView | Uint8Array | number[] | ArrayBuffer): string {
  const bytes = uint8ArrayFromSource(source);
  if (bytes.length === 0) return '';
  return Array.from(bytes)
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
    .join('');
}

/**
 * Formats a classic hex-editor dump (offset | hex bytes | ascii)
 */
export function formatHexDump(source: DataView | Uint8Array | number[] | ArrayBuffer, bytesPerLine = 16): string {
  const bytes = uint8ArrayFromSource(source);
  if (bytes.length === 0) return '(empty buffer)';

  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const chunk = bytes.slice(i, i + bytesPerLine);
    const offset = i.toString(16).padStart(4, '0').toUpperCase();

    const hexParts: string[] = [];
    for (let j = 0; j < bytesPerLine; j++) {
      if (j < chunk.length) {
        hexParts.push(chunk[j].toString(16).padStart(2, '0').toUpperCase());
      } else {
        hexParts.push('  ');
      }
    }

    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');

    lines.push(`${offset}  ${hexParts.join(' ')}  |${ascii}|`);
  }

  return lines.join('\n');
}

/**
 * Calculate simple 8-bit checksum (sum modulo 256)
 */
export function calculateChecksum8(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  return sum;
}

/**
 * Calculate 8-bit XOR checksum
 */
export function calculateXorChecksum(bytes: Uint8Array): number {
  let xor = 0;
  for (let i = 0; i < bytes.length; i++) {
    xor ^= bytes[i];
  }
  return xor;
}

/**
 * Calculate CRC16-CCITT (polynomial 0x1021, init 0xFFFF)
 */
export function calculateCrc16Ccitt(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

/**
 * Bluetooth SIG Standard Current Time Service (CTS, UUID 0x2A2B)
 * Encodes a JavaScript Date into the 10-byte standard CTS packet:
 * Byte 0-1: Year (uint16 LE)
 * Byte 2: Month (1-12)
 * Byte 3: Day of month (1-31)
 * Byte 4: Hours (0-23)
 * Byte 5: Minutes (0-59)
 * Byte 6: Seconds (0-59)
 * Byte 7: Day of week (1=Monday .. 7=Sunday)
 * Byte 8: Fractions256 (1/256th of second)
 * Byte 9: Adjust Reason (0x01 = Manual time update)
 */
export function buildBluetoothCtsPayload(date: Date): { bytes: Uint8Array; hex: string; breakdown: Record<string, string> } {
  const buffer = new ArrayBuffer(10);
  const view = new DataView(buffer);

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate(); // 1-31
  const hours = date.getHours(); // 0-23
  const minutes = date.getMinutes(); // 0-59
  const seconds = date.getSeconds(); // 0-59

  // JS day is 0=Sunday, 1=Monday... Bluetooth CTS is 1=Monday... 7=Sunday
  const jsDay = date.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  const milliseconds = date.getMilliseconds();
  const fractions256 = Math.floor((milliseconds * 256) / 1000);
  const adjustReason = 0x01; // Manual time update bit

  view.setUint16(0, year, true); // Little endian
  view.setUint8(2, month);
  view.setUint8(3, day);
  view.setUint8(4, hours);
  view.setUint8(5, minutes);
  view.setUint8(6, seconds);
  view.setUint8(7, dayOfWeek);
  view.setUint8(8, fractions256);
  view.setUint8(9, adjustReason);

  const bytes = new Uint8Array(buffer);
  return {
    bytes,
    hex: bytesToHex(bytes),
    breakdown: {
      'Year (uint16 LE)': `${year} (0x${bytes[0].toString(16).padStart(2, '0').toUpperCase()} 0x${bytes[1].toString(16).padStart(2, '0').toUpperCase()})`,
      'Month (1-12)': `${month} (0x${bytes[2].toString(16).padStart(2, '0').toUpperCase()})`,
      'Day of Month (1-31)': `${day} (0x${bytes[3].toString(16).padStart(2, '0').toUpperCase()})`,
      'Hours (0-23)': `${hours} (0x${bytes[4].toString(16).padStart(2, '0').toUpperCase()})`,
      'Minutes (0-59)': `${minutes} (0x${bytes[5].toString(16).padStart(2, '0').toUpperCase()})`,
      'Seconds (0-59)': `${seconds} (0x${bytes[6].toString(16).padStart(2, '0').toUpperCase()})`,
      'Day of Week (1-7)': `${dayOfWeek} (${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOfWeek - 1]})`,
      'Fractions256': `${fractions256}/256 (${milliseconds}ms)`,
      'Adjust Reason': '0x01 (Manual Time Update)',
    },
  };
}

/**
 * Parses a 10-byte CTS characteristic response if read from peripheral
 */
export function parseBluetoothCtsPayload(bytes: Uint8Array): { date?: Date; formatted?: string; error?: string } {
  if (bytes.length < 7) {
    return { error: `Payload too short for CTS (${bytes.length} bytes, minimum 7 required)` };
  }
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const year = view.getUint16(0, true);
    const month = view.getUint8(2) - 1; // 0-indexed in JS
    const day = view.getUint8(3);
    const hours = view.getUint8(4);
    const minutes = view.getUint8(5);
    const seconds = view.getUint8(6);

    const date = new Date(year, month, day, hours, minutes, seconds);
    return {
      date,
      formatted: date.toLocaleString(),
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to parse CTS payload' };
  }
}
