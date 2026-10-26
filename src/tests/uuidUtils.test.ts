import { describe, it, expect } from 'vitest';
import {
  validateUuid,
  normalizeUuid,
  areUuidsEqual,
  formatUuidDisplay,
} from '../utils/uuidUtils';
import { lookupServiceInfo, lookupCharacteristicInfo } from '../data/knownUuids';

describe('UUID Utilities & Lookup', () => {
  it('validates 16-bit hex alias correctly', () => {
    const res = validateUuid('0x1800');
    expect(res.isValid).toBe(true);
    expect(res.type).toBe('16-bit');
    expect(res.normalized).toBe('00001800-0000-1000-8000-00805f9b34fb');
  });

  it('validates standard 128-bit UUID', () => {
    const res = validateUuid('00001805-0000-1000-8000-00805f9b34fb');
    expect(res.isValid).toBe(true);
    expect(res.type).toBe('128-bit');
  });

  it('flags malformed 128-bit UUID with 9 characters in first segment', () => {
    // 00000D0FF-3C17-D293-8E48-14FE2E4DA212 has 9 characters in chunk 1 (33 hex chars total)
    const res = validateUuid('00000D0FF-3C17-D293-8E48-14FE2E4DA212');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Malformed 128-bit UUID');
    expect(res.warning).toContain('33 hex characters');
  });

  it('matches 16-bit and 128-bit representation equality', () => {
    expect(areUuidsEqual('1800', '00001800-0000-1000-8000-00805f9b34fb')).toBe(true);
    expect(areUuidsEqual('0x2A2B', '00002a2b-0000-1000-8000-00805f9b34fb')).toBe(true);
    expect(areUuidsEqual('1800', '1801')).toBe(false);
  });

  it('formats display with 16-bit short alias for SIG UUIDs', () => {
    const display = formatUuidDisplay('00001805-0000-1000-8000-00805f9b34fb');
    expect(display.isStandard).toBe(true);
    expect(display.short).toBe('0x1805');
  });

  it('looks up recognized standard services and characteristics', () => {
    const cts = lookupServiceInfo('0x1805');
    expect(cts.name).toContain('Current Time Service');

    const devName = lookupCharacteristicInfo('0x2A00');
    expect(devName.name).toBe('Device Name');

    const ctsChar = lookupCharacteristicInfo('0x2A2B');
    expect(ctsChar.name).toBe('Current Time');
  });

  it('identifies observed reference UUIDs', () => {
    const observedService = lookupServiceInfo('00006287-3c17-d293-8e48-14fe2e4da212');
    expect(observedService.category).toBe('observed_unverified');
    expect(observedService.notes).toContain('Previously observed — verification required');

    const observedChar = lookupCharacteristicInfo('0000ff02-0000-1000-8000-00805f9b34fb');
    expect(observedChar.category).toBe('observed_unverified');
  });
});
