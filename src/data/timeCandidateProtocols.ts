import { TimeCandidateProtocol } from '../types/bluetooth';
import { buildBluetoothCtsPayload, bytesToHex } from '../utils/byteUtils';

export const CANDIDATE_TIME_PROTOCOLS: TimeCandidateProtocol[] = [
  {
    id: 'standard-cts',
    name: 'Bluetooth SIG Current Time Service (CTS)',
    description: 'Official Bluetooth SIG standard specification (Service 0x1805 / Characteristic 0x2A2B). Sends a 10-byte structured packet with year (uint16 LE), month, day, hour, minute, second, day-of-week, and fractions.',
    serviceUuid: '00001805-0000-1000-8000-00805f9b34fb',
    characteristicUuid: '00002a2b-0000-1000-8000-00805f9b34fb',
    writeType: 'write',
    confidence: 'SPECULATIVE',
    prerequisites: [
      'Current Time Service (0x1805) must be present in GATT discovery table',
      'Current Time characteristic (0x2A2B) must have write permission',
    ],
    referenceNotes: 'Standard Bluetooth SIG profile. Safest candidate because the payload structure is an open standard and won\'t trigger vendor firmware crash routines.',
    buildPayload: (date: Date) => {
      const cts = buildBluetoothCtsPayload(date);
      return {
        hex: cts.hex,
        bytes: Array.from(cts.bytes),
        explanation: `10 bytes: Year=${date.getFullYear()} (LE), Month=${date.getMonth() + 1}, Day=${date.getDate()}, Hour=${date.getHours()}, Min=${date.getMinutes()}, Sec=${date.getSeconds()}, DayOfWeek=${date.getDay() || 7}, Frac=0, Reason=0x01 (Manual)`,
      };
    },
  },
  {
    id: 'vendor-ff02-dafit',
    name: 'Realtek / DaFit Style Time Command (Char 0xFF02)',
    description: 'Common 8-byte command packet used by Realtek RTL8762/Moyoung based smartwatches on characteristic FF02. Format: [0x04 (CMD_SET_TIME), YearHi, YearLo, Month, Day, Hour, Min, Sec].',
    serviceUuid: '0000fee7-0000-1000-8000-00805f9b34fb',
    characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    writeType: 'writeWithoutResponse',
    confidence: 'SPECULATIVE',
    prerequisites: [
      'Characteristic 0000FF02 must be discovered with write or writeWithoutResponse permission',
      'Preferably subscribe to 0000FF03 first to capture any MCU ACK or error packet',
    ],
    referenceNotes: 'Observed in manual notes for DIZO Watch D. DaFit/Moyoung watches use 0x04 as the time sync opcode.',
    buildPayload: (date: Date) => {
      const year = date.getFullYear();
      const bytes = new Uint8Array([
        0x04, // Command ID: Set Time
        (year >> 8) & 0xff,
        year & 0xff,
        (date.getMonth() + 1) & 0xff,
        date.getDate() & 0xff,
        date.getHours() & 0xff,
        date.getMinutes() & 0xff,
        date.getSeconds() & 0xff,
      ]);
      return {
        hex: bytesToHex(bytes),
        bytes: Array.from(bytes),
        explanation: `8 bytes: [0x04 (Set Time), YearHi=${bytes[1]}, YearLo=${bytes[2]}, Month=${bytes[3]}, Day=${bytes[4]}, Hour=${bytes[5]}, Min=${bytes[6]}, Sec=${bytes[7]}]`,
      };
    },
  },
  {
    id: 'vendor-6387-epoch',
    name: 'Proprietary 6287 / 6387 32-bit Epoch Time',
    description: 'Unix timestamp payload sent to custom characteristic 6387 under observed service 6287. Many vendor MCUs accept a 4-byte or 6-byte packet containing uint32 seconds since Unix epoch.',
    serviceUuid: '00006287-3c17-d293-8e48-14fe2e4da212',
    characteristicUuid: '00006387-3c17-d293-8e48-14fe2e4da212',
    writeType: 'write',
    confidence: 'SPECULATIVE',
    prerequisites: [
      'Observed Service 00006287-3c17-d293-8e48-14fe2e4da212 must be discovered on device',
      'Characteristic 6387 must have write permission verified',
      'Watch battery must be adequately charged to avoid unrecoverable state',
    ],
    referenceNotes: 'Unverified custom protocol observed on DIZO Watch D. Testing requires extreme caution.',
    buildPayload: (date: Date) => {
      const epochSec = Math.floor(date.getTime() / 1000);
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      view.setUint8(0, 0x01); // Header / command
      view.setUint8(1, 0x04); // Length
      view.setUint32(2, epochSec, true); // Little endian 32-bit timestamp
      const bytes = new Uint8Array(buffer);
      return {
        hex: bytesToHex(bytes),
        bytes: Array.from(bytes),
        explanation: `6 bytes: [0x01, 0x04 (Len), EpochSec=${epochSec} (LE)] (${date.toISOString()})`,
      };
    },
  },
];
