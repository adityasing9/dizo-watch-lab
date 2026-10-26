import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DiagnosticLog } from '../../types/diagnostics';
import { ProtocolExperiment, NotificationEvent } from '../../types/bluetooth';

const DB_NAME = 'dizo_watch_lab_db';
const DB_VERSION = 1;

interface DizoLabDbSchema extends DBSchema {
  logs: {
    key: string;
    value: DiagnosticLog;
    indexes: {
      'by-timestamp': number;
      'by-level': string;
      'by-category': string;
    };
  };
  experiments: {
    key: string;
    value: ProtocolExperiment;
    indexes: {
      'by-timestamp': number;
      'by-result': string;
    };
  };
  notifications: {
    key: string;
    value: NotificationEvent;
    indexes: {
      'by-timestamp': number;
      'by-characteristic': string;
    };
  };
}

// In-memory fallbacks when indexedDB is unavailable (e.g. headless tests)
const memoryLogs: Map<string, DiagnosticLog> = new Map();
const memoryExperiments: Map<string, ProtocolExperiment> = new Map();
const memoryNotifications: Map<string, NotificationEvent> = new Map();

function isIdbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBPDatabase<DizoLabDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DizoLabDbSchema>> | null {
  if (!isIdbSupported()) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<DizoLabDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-timestamp', 'timestamp');
          logStore.createIndex('by-level', 'level');
          logStore.createIndex('by-category', 'category');
        }

        if (!db.objectStoreNames.contains('experiments')) {
          const expStore = db.createObjectStore('experiments', { keyPath: 'id' });
          expStore.createIndex('by-timestamp', 'timestamp');
          expStore.createIndex('by-result', 'result');
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('by-timestamp', 'timestamp');
          notifStore.createIndex('by-characteristic', 'characteristicUuid');
        }
      },
    });
  }
  return dbPromise;
}

// ----------------- Logs Operations -----------------

export async function saveLogToDb(log: DiagnosticLog): Promise<void> {
  memoryLogs.set(log.id, log);
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.put('logs', log);
    }
  } catch (err) {
    console.warn('Failed to save log to IndexedDB, stored in memory fallback:', err);
  }
}

export async function getAllLogsFromDb(): Promise<DiagnosticLog[]> {
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      const logs = await db.getAllFromIndex('logs', 'by-timestamp');
      return logs.reverse();
    }
  } catch (err) {
    console.warn('Failed to load logs from IndexedDB, returning memory fallback:', err);
  }
  return Array.from(memoryLogs.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function clearAllLogsFromDb(): Promise<void> {
  memoryLogs.clear();
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.clear('logs');
    }
  } catch (err) {
    console.warn('Failed to clear logs in IndexedDB:', err);
  }
}

// ----------------- Experiments Operations -----------------

export async function saveExperimentToDb(exp: ProtocolExperiment): Promise<void> {
  memoryExperiments.set(exp.id, exp);
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.put('experiments', exp);
    }
  } catch (err) {
    console.warn('Failed to save experiment to IndexedDB:', err);
  }
}

export async function getAllExperimentsFromDb(): Promise<ProtocolExperiment[]> {
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      const exps = await db.getAllFromIndex('experiments', 'by-timestamp');
      return exps.reverse();
    }
  } catch (err) {
    console.warn('Failed to load experiments from IndexedDB:', err);
  }
  return Array.from(memoryExperiments.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteExperimentFromDb(id: string): Promise<void> {
  memoryExperiments.delete(id);
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.delete('experiments', id);
    }
  } catch (err) {
    console.warn('Failed to delete experiment from IndexedDB:', err);
  }
}

// ----------------- Notifications Operations -----------------

export async function saveNotificationToDb(event: NotificationEvent): Promise<void> {
  memoryNotifications.set(event.id, event);
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.put('notifications', event);
    }
  } catch (err) {
    console.warn('Failed to save notification event to IndexedDB:', err);
  }
}

export async function getAllNotificationsFromDb(limit = 200): Promise<NotificationEvent[]> {
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      const events = await db.getAllFromIndex('notifications', 'by-timestamp');
      return events.slice(-limit).reverse();
    }
  } catch (err) {
    console.warn('Failed to load notifications from IndexedDB:', err);
  }
  return Array.from(memoryNotifications.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function clearAllNotificationsFromDb(): Promise<void> {
  memoryNotifications.clear();
  try {
    const dbp = getDb();
    if (dbp) {
      const db = await dbp;
      await db.clear('notifications');
    }
  } catch (err) {
    console.warn('Failed to clear notifications in IndexedDB:', err);
  }
}
