import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from '../services/diagnostics/diagnosticLogger';
import { DiagnosticLog } from '../types/diagnostics';

describe('Diagnostic Logger Service', () => {
  beforeEach(async () => {
    await logger.clear();
  });

  it('records logs with appropriate severity levels', () => {
    const infoLog = logger.info('SYSTEM', 'Unit test startup');
    expect(infoLog.level).toBe('INFO');
    expect(infoLog.category).toBe('SYSTEM');

    const errLog = logger.error('BLUETOOTH', 'Device connection lost', {
      serviceUuid: '00001800-0000-1000-8000-00805f9b34fb',
    });
    expect(errLog.level).toBe('ERROR');
    expect(errLog.serviceUuid).toBe('00001800-0000-1000-8000-00805f9b34fb');

    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it('filters logs by severity level and category', () => {
    logger.info('BLUETOOTH', 'Adapter initialized');
    logger.warn('GATT', 'Service discovery partial');
    logger.error('READ', 'Timeout waiting for response');

    const all = logger.getLogs();

    const errorsOnly = logger.filterLogs(all, {
      searchQuery: '',
      levels: ['ERROR'],
      category: 'ALL',
    });
    expect(errorsOnly.length).toBe(1);
    expect(errorsOnly[0].level).toBe('ERROR');

    const bluetoothOnly = logger.filterLogs(all, {
      searchQuery: '',
      levels: [],
      category: 'BLUETOOTH',
    });
    expect(bluetoothOnly.length).toBe(1);
    expect(bluetoothOnly[0].category).toBe('BLUETOOTH');
  });

  it('exports logs to valid CSV and JSON', () => {
    logger.info('TIME_SYNC', 'Initiated CTS sync test', { payloadHex: '04 07 E7' });

    const logs = logger.getLogs();
    const json = logger.exportAsJson(logs);
    expect(() => JSON.parse(json)).not.toThrow();

    const csv = logger.exportAsCsv(logs);
    expect(csv).toContain('ID,Timestamp,ISO Time,Level,Category,Message');
    expect(csv).toContain('TIME_SYNC');
    expect(csv).toContain('04 07 E7');
  });
});
