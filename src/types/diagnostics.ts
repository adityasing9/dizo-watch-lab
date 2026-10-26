export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type LogCategory = 
  | 'SYSTEM' 
  | 'BLUETOOTH' 
  | 'GATT' 
  | 'READ' 
  | 'WRITE' 
  | 'NOTIFY' 
  | 'TIME_SYNC' 
  | 'PAIRING'
  | 'ROTATION'
  | 'RESEARCH'
  | 'SECURITY';

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  serviceUuid?: string;
  characteristicUuid?: string;
  payloadHex?: string;
  details?: Record<string, unknown>;
}

export interface LogFilter {
  searchQuery: string;
  levels: LogLevel[];
  category: string;
  startDate?: string;
  endDate?: string;
}
