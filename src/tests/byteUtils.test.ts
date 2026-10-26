import { describe, it, expect } from 'vitest';
import {
  bytesToHex,
  hexToBytes,
  bytesToAscii,
  bytesToUtf8,
  calculateChecksum8,
  calculateXorChecksum,
  calculateCrc16Ccitt,
  buildBluetoothCtsPayload,
  parseBluetoothCtsPayload,
  formatHexDump,
} from '../utils/byteUtils';

describe('Byte & Hexadecimal Utilities', () => {
  it('converts Uint8Array to formatted uppercase space-separated hex', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x0f, 0x10, 0xff]);
    expect(bytesToHex(bytes)).toBe('00 01 0F 10 FF');
  });

  it('converts hex strings to Uint8Array', () => {
    const result1 = hexToBytes('01 0F FF');
    expect(Array.from(result1.bytes)).toEqual([1, 15, 255]);
    expect(result1.error).toBeUndefined();

    const result2 = hexToBytes('0xAA, 0xBB');
    expect(Array.from(result2.bytes)).toEqual([0xaa, 0xbb]);

    // Odd length hex
    const oddResult = hexToBytes('ABC');
    expect(oddResult.error).toBeDefined();
  });

  it('safely decodes ASCII with printable dots', () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x0a]); // "Hello\0\n"
    expect(bytesToAscii(bytes)).toBe('Hello..');
  });

  it('calculates 8-bit checksum correctly', () => {
    const bytes = new Uint8Array([10, 20, 30]);
    expect(calculateChecksum8(bytes)).toBe(60);

    // Overflow beyond 255 (modulo 256)
    const overflow = new Uint8Array([200, 100]); // 300 -> 300 & 0xFF = 44
    expect(calculateChecksum8(overflow)).toBe(44);
  });

  it('calculates XOR checksum correctly', () => {
    const bytes = new Uint8Array([0xaa, 0x55]);
    expect(calculateXorChecksum(bytes)).toBe(0xff);
  });

  it('calculates CRC-16 CCITT correctly', () => {
    const bytes = new TextEncoder().encode('123456789');
    const crc = calculateCrc16Ccitt(bytes);
    expect(crc).toBe(0x29b1);
  });

  it('formats standard Bluetooth CTS 10-byte payload accurately', () => {
    // 2026-10-26 06:30:00 (Monday)
    const date = new Date(2026, 9, 26, 6, 30, 0); // Month is 0-indexed in JS (9 = Oct)
    const cts = buildBluetoothCtsPayload(date);

    expect(cts.bytes.length).toBe(10);
    // Year 2026 is 0x07EA -> LE: 0xEA, 0x07
    expect(cts.bytes[0]).toBe(0xea);
    expect(cts.bytes[1]).toBe(0x07);
    expect(cts.bytes[2]).toBe(10); // Month (Oct = 10)
    expect(cts.bytes[3]).toBe(26); // Day 26
    expect(cts.bytes[4]).toBe(6);  // Hour 6
    expect(cts.bytes[5]).toBe(30); // Min 30
    expect(cts.bytes[6]).toBe(0);  // Sec 0
    expect(cts.bytes[7]).toBe(1);  // Day of week (1 = Monday)
    expect(cts.bytes[9]).toBe(0x01); // Adjust reason (manual update)

    // Roundtrip parse
    const parsed = parseBluetoothCtsPayload(cts.bytes);
    expect(parsed.error).toBeUndefined();
    expect(parsed.date?.getFullYear()).toBe(2026);
    expect(parsed.date?.getMonth()).toBe(9);
    expect(parsed.date?.getDate()).toBe(26);
  });

  it('formats hex dump correctly', () => {
    const bytes = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
    const dump = formatHexDump(bytes, 16);
    expect(dump).toContain('0000');
    expect(dump).toContain('41 42 43 44');
    expect(dump).toContain('|ABCD|');
  });
});
