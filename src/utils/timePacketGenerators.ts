import { buildBluetoothCtsPayload, bytesToHex } from './byteUtils';

export interface SmartwatchTimePacket {
  id: string;
  name: string;
  category: 'Linwear / Realtek' | 'Realtek Calendar' | 'Framed Packets' | 'Raw Epoch' | 'Bluetooth SIG';
  targetCharHint: string; // e.g. '6387', 'ff02', '2a2b', 'any'
  preferredWriteType: 'write' | 'writeWithoutResponse';
  explanation: string;
  getBytes: (date: Date) => Uint8Array;
}

export const SMARTWATCH_TIME_PACKETS: SmartwatchTimePacket[] = [
  // 1. Primary Linwear / Realtek 6-byte Epoch
  {
    id: 'linwear-realtek-epoch-6byte',
    name: 'Linwear Realtek 6-byte Epoch [0x01, 0x04, Epoch-LE]',
    category: 'Linwear / Realtek',
    targetCharHint: '6387',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Header 0x01, Len 0x04, 32-bit Unix epoch seconds in Little-Endian. Standard for Realtek RTL8762 & Linwear smartbands on characteristic 6387.',
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

  // 2. Realtek / DaFit Calendar 8-byte
  {
    id: 'smartwatch-cal-04-be',
    name: 'Realtek / DaFit Calendar 8-byte [0x04, YearHi, YearLo, M, D, H, M, S]',
    category: 'Realtek Calendar',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x04 followed by 2-byte Big-Endian Year, Month, Day, Hour, Minute, Second. Dominant protocol on Realtek Moyoung & DaFit platforms.',
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

  // 3. Linwear Framed Magic 0xAB Packet
  {
    id: 'linwear-framed-ab-8byte',
    name: 'Linwear Magic Framed [0xAB, 0x00, 0x08, 0x01, YearHi, YearLo, ...]',
    category: 'Framed Packets',
    targetCharHint: '6387',
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

  // 4. Linwear 2-Digit Year Calendar (Offset 2000) + 24H Flag
  {
    id: 'linwear-cal-2digit-year',
    name: 'Linwear 2-Digit Year Calendar [0x04, Year-2000, M, D, H, M, S, 24h]',
    category: 'Realtek Calendar',
    targetCharHint: '6387',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Opcode 0x04 followed by 1-byte year offset (e.g. 26 for 2026), month, day, hour, min, sec, and 0x00 (24-hour format).',
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
        0x00, // 24h format
      ]);
    },
  },

  // 5. Linwear Framed 0xAB with Day of Week
  {
    id: 'linwear-framed-ab-dow',
    name: 'Linwear Framed [0xAB, 0x00, 0x07, 0x01, Year-2000, ..., DayOfWeek]',
    category: 'Framed Packets',
    targetCharHint: '6387',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Framed 0xAB packet with 1-byte year offset from 2000 and 1-7 ISO day-of-week byte.',
    getBytes: (date: Date) => {
      const yearOffset = date.getFullYear() - 2000;
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
      return new Uint8Array([
        0xab,
        0x00,
        0x07,
        0x01,
        yearOffset & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
        dayOfWeek & 0xff,
      ]);
    },
  },

  // 6. Linwear Direct 5-byte Epoch
  {
    id: 'linwear-realtek-epoch-5byte',
    name: 'Linwear Direct Epoch [0x01, Epoch-LE (4B)]',
    category: 'Linwear / Realtek',
    targetCharHint: '6387',
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

  // 7. Realtek Opcode 0x10 System Calendar
  {
    id: 'realtek-opcode-10-cal',
    name: 'Realtek System Control [0x10, YearHi, YearLo, M, D, H, M, S]',
    category: 'Realtek Calendar',
    targetCharHint: '6387',
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

  // 8. Moyoung V2 Chunk Header
  {
    id: 'moyoung-v2-time',
    name: 'Moyoung / Linwear V2 Chunk [0x00, 0x08, 0x04, ...]',
    category: 'Framed Packets',
    targetCharHint: 'ff02',
    preferredWriteType: 'writeWithoutResponse',
    explanation: 'Moyoung V2 MTU chunk header with opcode 0x04 and calendar time.',
    getBytes: (date: Date) => {
      const year = date.getFullYear();
      return new Uint8Array([
        0x00,
        0x08,
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

  // 9. Raw 4-byte Unix Epoch Little-Endian
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

  // 10. Raw 4-byte Unix Epoch Big-Endian
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

  // 11. Bluetooth SIG Current Time Service
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
