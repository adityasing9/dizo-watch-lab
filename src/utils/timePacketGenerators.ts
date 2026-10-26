import { buildBluetoothCtsPayload, bytesToHex } from './byteUtils';

export interface SmartwatchTimePacket {
  id: string;
  name: string;
  category: 'Realtek Calendar' | 'Linwear / Realtek' | 'Framed Packets' | 'Display Refresh' | 'Raw Epoch' | 'Bluetooth SIG';
  targetCharHint: string; // e.g. 'ff02', 'ffd2', '6387', 'any'
  preferredWriteType: 'write' | 'writeWithoutResponse';
  explanation: string;
  getBytes: (date: Date) => Uint8Array;
}

export const SMARTWATCH_TIME_PACKETS: SmartwatchTimePacket[] = [
  // 1. Primary DaFit / Realtek 8-byte Calendar (Standard for FF02)
  {
    id: 'smartwatch-cal-04-be',
    name: 'Realtek / DaFit Calendar 8-byte [0x04, YearHi, YearLo, M, D, H, M, S]',
    category: 'Realtek Calendar',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x04 followed by 2-byte Big-Endian Year, Month, Day, Hour, Minute, Second. Dominant protocol on Realtek Moyoung & DaFit platforms on FF02.',
    getBytes: (date: Date) => {
      const year = date.getFullYear();
      return new Uint8Array([
        0x04,
        (year >> 8) & 0xff,
        year & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
      ]);
    },
  },

  // 2. Linwear 2-Digit Year Calendar (Offset from 2000)
  {
    id: 'linwear-cal-2digit-year',
    name: 'Linwear 2-Digit Year Calendar [0x04, Year-2000, M, D, H, M, S, 24h]',
    category: 'Realtek Calendar',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x04 with 1-byte year offset (e.g. 26 for 2026), month, day, hour, min, sec, and 0x00 (24-hour format). Used by Linwear/OnWear devices.',
    getBytes: (date: Date) => {
      const yearOffset = date.getFullYear() - 2000;
      return new Uint8Array([
        0x04,
        yearOffset & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
        0x00,
      ]);
    },
  },

  // 3. Linwear Framed Magic 0xAB Packet
  {
    id: 'linwear-framed-ab-8byte',
    name: 'Linwear Magic Framed [0xAB, 0x00, 0x08, 0x01, YearHi, YearLo, ...]',
    category: 'Framed Packets',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Magic 0xAB frame with sequence 0x00, length 0x08, opcode 0x01, and 7-byte calendar time. Used by Linwear/OnWear smartwatch engines.',
    getBytes: (date: Date) => {
      const year = date.getFullYear();
      return new Uint8Array([
        0xab, // Magic byte
        0x00, // Sequence
        0x08, // Length
        0x01, // Set time opcode
        (year >> 8) & 0xff,
        year & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
      ]);
    },
  },

  // 4. Linwear / Realtek 6-byte Epoch
  {
    id: 'linwear-realtek-epoch-6byte',
    name: 'Linwear Realtek 6-byte Epoch [0x01, 0x04, Epoch-LE]',
    category: 'Linwear / Realtek',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Header 0x01, Len 0x04, 32-bit Unix epoch seconds in Little-Endian. Primary format for Realtek RTL8762 & Linwear smartbands.',
    getBytes: (date: Date) => {
      const epochSec = Math.floor(date.getTime() / 1000);
      const buf = new Uint8Array(6);
      buf[0] = 0x01; // CMD_SET_TIME
      buf[1] = 0x04; // Length
      buf[2] = epochSec & 0xff;
      buf[3] = (epochSec >> 8) & 0xff;
      buf[4] = (epochSec >> 16) & 0xff;
      buf[5] = (epochSec >> 24) & 0xff;
      return buf;
    },
  },

  // 5. Linwear Direct 5-byte Epoch
  {
    id: 'linwear-realtek-epoch-5byte',
    name: 'Linwear Direct Epoch [0x01, Epoch-LE (4B)]',
    category: 'Linwear / Realtek',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Single opcode byte 0x01 followed directly by 4-byte little-endian Unix epoch timestamp.',
    getBytes: (date: Date) => {
      const epochSec = Math.floor(date.getTime() / 1000);
      const buf = new Uint8Array(5);
      buf[0] = 0x01;
      buf[1] = epochSec & 0xff;
      buf[2] = (epochSec >> 8) & 0xff;
      buf[3] = (epochSec >> 16) & 0xff;
      buf[4] = (epochSec >> 24) & 0xff;
      return buf;
    },
  },

  // 6. Realtek Opcode 0x10 System Calendar
  {
    id: 'realtek-opcode-10-cal',
    name: 'Realtek System Control [0x10, YearHi, YearLo, M, D, H, M, S]',
    category: 'Realtek Calendar',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Realtek DTS (Data Transfer Service) system configuration opcode 0x10 followed by calendar date-time array.',
    getBytes: (date: Date) => {
      const year = date.getFullYear();
      return new Uint8Array([
        0x10,
        (year >> 8) & 0xff,
        year & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
      ]);
    },
  },

  // 7. Time Format Command 0x05 (Forces LCD Screen Redraw)
  {
    id: 'realtek-time-format-24h',
    name: 'Time Format 24h & LCD Redraw [0x05, 0x00]',
    category: 'Display Refresh',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x05 (Set 24H Format). In DaFit & Moyoung firmwares, this opcode forces the LCD controller to re-render the clock digits on the screen.',
    getBytes: () => new Uint8Array([0x05, 0x00]),
  },

  // 8. Time Format Command 0x05 (12h format)
  {
    id: 'realtek-time-format-12h',
    name: 'Time Format 12h & LCD Redraw [0x05, 0x01]',
    category: 'Display Refresh',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x05 (Set 12H Format). Triggers an immediate display redraw.',
    getBytes: () => new Uint8Array([0x05, 0x01]),
  },

  // 9. Linwear / Realtek Handshake & Bind
  {
    id: 'linwear-bind-init',
    name: 'Handshake & Bind Init [0x01, 0x01, 0x00]',
    category: 'Linwear / Realtek',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Connection authorization packet telling the watch MCU that an authorized companion session has begun.',
    getBytes: () => new Uint8Array([0x01, 0x01, 0x00]),
  },

  // 10. Linwear Framed Ping & Connect ACK
  {
    id: 'linwear-framed-ping',
    name: 'Linwear Framed Ping [0xAB, 0x00, 0x01, 0x01]',
    category: 'Framed Packets',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Framed connection acknowledgment packet to unlock watch command processing.',
    getBytes: () => new Uint8Array([0xab, 0x00, 0x01, 0x01]),
  },

  // 11. Raw 4-byte Unix Epoch Little-Endian
  {
    id: 'raw-epoch-4byte-le',
    name: 'Raw 32-bit Unix Epoch (Little Endian, 4 Bytes)',
    category: 'Raw Epoch',
    targetCharHint: 'any',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Direct 32-bit unsigned integer representing seconds since Jan 1 1970 UTC (Little-Endian).',
    getBytes: (date: Date) => {
      const epochSec = Math.floor(date.getTime() / 1000);
      return new Uint8Array([
        epochSec & 0xff,
        (epochSec >> 8) & 0xff,
        (epochSec >> 16) & 0xff,
        (epochSec >> 24) & 0xff,
      ]);
    },
  },

  // 12. Raw 4-byte Unix Epoch Big-Endian
  {
    id: 'raw-epoch-4byte-be',
    name: 'Raw 32-bit Unix Epoch (Big Endian, 4 Bytes)',
    category: 'Raw Epoch',
    targetCharHint: 'any',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Direct 32-bit unsigned integer representing seconds since Jan 1 1970 UTC (Big-Endian network order).',
    getBytes: (date: Date) => {
      const epochSec = Math.floor(date.getTime() / 1000);
      return new Uint8Array([
        (epochSec >> 24) & 0xff,
        (epochSec >> 16) & 0xff,
        (epochSec >> 8) & 0xff,
        epochSec & 0xff,
      ]);
    },
  },

  // 13. Bluetooth SIG Current Time Service
  {
    id: 'standard-bluetooth-cts',
    name: 'Bluetooth SIG Current Time Service (CTS 10-byte)',
    category: 'Bluetooth SIG',
    targetCharHint: '2a2b',
    preferredWriteType: 'write',
    explanation: 'Official Bluetooth SIG CTS 10-byte structure. Succeeded if 0x1805/0x2A2B is present on peripheral.',
    getBytes: (date: Date) => {
      const cts = buildBluetoothCtsPayload(date);
      return cts.bytes;
    },
  },
];

export interface SuperSyncStep {
  name: string;
  bytes: Uint8Array;
  role: 'init' | 'time' | 'refresh';
}

/**
 * Builds the comprehensive multi-step Super-Sync sequence
 * Combining initialization handshake, top time setting candidate frames, and LCD redraw triggers
 */
export function buildSuperSyncSequence(date: Date): SuperSyncStep[] {
  const year = date.getFullYear();
  const yearOffset = year - 2000;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();
  const epochSec = Math.floor(date.getTime() / 1000);

  return [
    // 1. Session Authorization Handshake
    {
      name: 'Session Handshake [0x01, 0x01, 0x00]',
      bytes: new Uint8Array([0x01, 0x01, 0x00]),
      role: 'init',
    },
    {
      name: 'Linwear Ping Frame [0xAB, 0x00, 0x01, 0x01]',
      bytes: new Uint8Array([0xab, 0x00, 0x01, 0x01]),
      role: 'init',
    },

    // 2. Realtek / DaFit Calendar 8-byte (dominant on FF02)
    {
      name: 'Realtek / DaFit Calendar 8-byte [0x04, YearHi, YearLo, ...]',
      bytes: new Uint8Array([
        0x04,
        (year >> 8) & 0xff,
        year & 0xff,
        month & 0xff,
        day & 0xff,
        hour & 0xff,
        min & 0xff,
        sec & 0xff,
      ]),
      role: 'time',
    },

    // 3. Linwear 2-Digit Year Calendar
    {
      name: 'Linwear 2-Digit Calendar [0x04, Year-2000, M, D, H, M, S, 24h]',
      bytes: new Uint8Array([
        0x04,
        yearOffset & 0xff,
        month & 0xff,
        day & 0xff,
        hour & 0xff,
        min & 0xff,
        sec & 0xff,
        0x00,
      ]),
      role: 'time',
    },

    // 4. Linwear Magic Framed 0xAB Calendar
    {
      name: 'Linwear Magic Framed 0xAB Calendar',
      bytes: new Uint8Array([
        0xab,
        0x00,
        0x08,
        0x01,
        (year >> 8) & 0xff,
        year & 0xff,
        month & 0xff,
        day & 0xff,
        hour & 0xff,
        min & 0xff,
        sec & 0xff,
      ]),
      role: 'time',
    },

    // 5. Linwear Realtek 6-byte Epoch
    {
      name: 'Realtek 6-byte Epoch [0x01, 0x04, EpochLE]',
      bytes: new Uint8Array([
        0x01,
        0x04,
        epochSec & 0xff,
        (epochSec >> 8) & 0xff,
        (epochSec >> 16) & 0xff,
        (epochSec >> 24) & 0xff,
      ]),
      role: 'time',
    },

    // 6. Linwear Direct 5-byte Epoch
    {
      name: 'Linwear Direct 5-byte Epoch [0x01, EpochLE]',
      bytes: new Uint8Array([
        0x01,
        epochSec & 0xff,
        (epochSec >> 8) & 0xff,
        (epochSec >> 16) & 0xff,
        (epochSec >> 24) & 0xff,
      ]),
      role: 'time',
    },

    // 7. Realtek Opcode 0x10 System Time
    {
      name: 'Realtek System Opcode 0x10 [0x10, YearHi, YearLo, ...]',
      bytes: new Uint8Array([
        0x10,
        (year >> 8) & 0xff,
        year & 0xff,
        month & 0xff,
        day & 0xff,
        hour & 0xff,
        min & 0xff,
        sec & 0xff,
      ]),
      role: 'time',
    },

    // 8. Raw Unix Epoch (LE)
    {
      name: 'Raw 4-byte Unix Epoch (LE)',
      bytes: new Uint8Array([
        epochSec & 0xff,
        (epochSec >> 8) & 0xff,
        (epochSec >> 16) & 0xff,
        (epochSec >> 24) & 0xff,
      ]),
      role: 'time',
    },

    // 9. Force LCD Screen Redraw (Time format 24h & 12h)
    {
      name: 'LCD Redraw Trigger (Set 24h) [0x05, 0x00]',
      bytes: new Uint8Array([0x05, 0x00]),
      role: 'refresh',
    },
    {
      name: 'LCD Redraw Trigger (Set 12h) [0x05, 0x01]',
      bytes: new Uint8Array([0x05, 0x01]),
      role: 'refresh',
    },
  ];
}
