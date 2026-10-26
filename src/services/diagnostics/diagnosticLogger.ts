import { DiagnosticLog, LogCategory, LogFilter, LogLevel } from '../../types/diagnostics';
import { ProtocolExperiment } from '../../types/bluetooth';
import { clearAllLogsFromDb, getAllLogsFromDb, saveLogToDb } from '../storage/indexedDb';

type LogListener = (log: DiagnosticLog) => void;

class DiagnosticLoggerService {
  private inMemoryLogs: DiagnosticLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxInMemoryLogs = 1000;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const persisted = await getAllLogsFromDb();
      this.inMemoryLogs = persisted.slice(0, this.maxInMemoryLogs);
      this.isInitialized = true;
    } catch (e) {
      console.error('Failed to init diagnostic logger:', e);
    }
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options?: {
      serviceUuid?: string;
      characteristicUuid?: string;
      payloadHex?: string;
      details?: Record<string, unknown>;
    }
  ): DiagnosticLog {
    const entry: DiagnosticLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      serviceUuid: options?.serviceUuid,
      characteristicUuid: options?.characteristicUuid,
      payloadHex: options?.payloadHex,
      details: options?.details,
    };

    // Prepend to in-memory list (newest first)
    this.inMemoryLogs.unshift(entry);
    if (this.inMemoryLogs.length > this.maxInMemoryLogs) {
      this.inMemoryLogs.pop();
    }

    // Persist asynchronously
    saveLogToDb(entry).catch((err) => console.warn('Async log persist failed:', err));

    // Notify active listeners
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Error in log listener:', err);
      }
    });

    // Also mirror to browser developer console with styled badge
    const badgeColors: Record<LogLevel, string> = {
      INFO: 'color: #38bdf8; font-weight: bold;',
      SUCCESS: 'color: #34d399; font-weight: bold;',
      WARNING: 'color: #fbbf24; font-weight: bold;',
      ERROR: 'color: #f87171; font-weight: bold;',
    };
    console.log(
      `%c[${level}] %c[${category}] %c${message}`,
      badgeColors[level],
      'color: #94a3b8;',
      'color: inherit;',
      options?.details || ''
    );

    return entry;
  }

  info(category: LogCategory, message: string, options?: Parameters<DiagnosticLoggerService['log']>[3]): DiagnosticLog {
    return this.log('INFO', category, message, options);
  }

  success(category: LogCategory, message: string, options?: Parameters<DiagnosticLoggerService['log']>[3]): DiagnosticLog {
    return this.log('SUCCESS', category, message, options);
  }

  warn(category: LogCategory, message: string, options?: Parameters<DiagnosticLoggerService['log']>[3]): DiagnosticLog {
    return this.log('WARNING', category, message, options);
  }

  error(category: LogCategory, message: string, options?: Parameters<DiagnosticLoggerService['log']>[3]): DiagnosticLog {
    return this.log('ERROR', category, message, options);
  }

  getLogs(): DiagnosticLog[] {
    return [...this.inMemoryLogs];
  }

  filterLogs(logs: DiagnosticLog[], filter: LogFilter): DiagnosticLog[] {
    return logs.filter((l) => {
      // Level filter
      if (filter.levels.length > 0 && !filter.levels.includes(l.level)) {
        return false;
      }

      // Category filter
      if (filter.category && filter.category !== 'ALL' && l.category !== filter.category) {
        return false;
      }

      // Date range filter
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        if (l.timestamp < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime() + 86400000;
        if (l.timestamp > end) return false;
      }

      // Search query filter
      if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
        const q = filter.searchQuery.toLowerCase();
        const msgMatch = l.message.toLowerCase().includes(q);
        const sMatch = l.serviceUuid ? l.serviceUuid.toLowerCase().includes(q) : false;
        const cMatch = l.characteristicUuid ? l.characteristicUuid.toLowerCase().includes(q) : false;
        const pMatch = l.payloadHex ? l.payloadHex.toLowerCase().includes(q) : false;
        return msgMatch || sMatch || cMatch || pMatch;
      }

      return true;
    });
  }

  async clear(): Promise<void> {
    this.inMemoryLogs = [];
    await clearAllLogsFromDb();
    this.log('INFO', 'SYSTEM', 'Diagnostic logs cleared by user.');
  }

  exportAsJson(logs: DiagnosticLog[]): string {
    return JSON.stringify(logs, null, 2);
  }

  exportAsCsv(logs: DiagnosticLog[]): string {
    const headers = ['ID', 'Timestamp', 'ISO Time', 'Level', 'Category', 'Message', 'Service UUID', 'Characteristic UUID', 'Payload (Hex)'];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp.toString(),
      new Date(l.timestamp).toISOString(),
      l.level,
      l.category,
      `"${l.message.replace(/"/g, '""')}"`,
      l.serviceUuid ? `"${l.serviceUuid}"` : '""',
      l.characteristicUuid ? `"${l.characteristicUuid}"` : '""',
      l.payloadHex ? `"${l.payloadHex}"` : '""',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  exportExperimentsAsJson(experiments: ProtocolExperiment[]): string {
    return JSON.stringify(experiments, null, 2);
  }

  exportExperimentsAsCsv(experiments: ProtocolExperiment[]): string {
    const headers = ['ID', 'Timestamp', 'ISO Time', 'Title', 'Hypothesis', 'Action', 'Service UUID', 'Characteristic UUID', 'Input Payload (Hex)', 'Result', 'Response (Hex)', 'Confidence', 'Watch Time Verified', 'Notes'];
    const rows = experiments.map((e) => [
      e.id,
      e.timestamp.toString(),
      new Date(e.timestamp).toISOString(),
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.hypothesis.replace(/"/g, '""')}"`,
      e.action,
      `"${e.serviceUuid}"`,
      `"${e.characteristicUuid}"`,
      `"${e.inputPayloadHex || ''}"`,
      e.result,
      `"${e.responseHex || ''}"`,
      e.confidence,
      e.watchTimeVerified ? 'YES' : 'NO',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }
}

export const logger = new DiagnosticLoggerService();
