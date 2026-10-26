import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  BluetoothCapability,
  ConnectionStatus,
  DiscoveredDevice,
  GattServiceInfo,
  NotificationEvent,
  ProtocolExperiment,
  TimeSyncInvestigationStatus,
} from '../types/bluetooth';
import { IBluetoothService, DeviceRequestOptions } from '../services/bluetooth/bluetoothInterface';
import { Capacitor } from '@capacitor/core';
import { webBluetoothService } from '../services/bluetooth/webBluetoothService';
import { capacitorBluetoothService } from '../services/bluetooth/capacitorBluetoothService';
import { MockBluetoothService } from '../services/bluetooth/mockBluetoothService';
import { logger } from '../services/diagnostics/diagnosticLogger';
import {
  getAllExperimentsFromDb,
  getAllNotificationsFromDb,
  saveExperimentToDb,
  clearAllNotificationsFromDb,
} from '../services/storage/indexedDb';

interface BluetoothContextType {
  service: IBluetoothService;
  status: ConnectionStatus;
  device: DiscoveredDevice | null;
  services: GattServiceInfo[];
  capability: BluetoothCapability | null;
  isCheckingCapability: boolean;
  refreshCapability: () => Promise<void>;
  notifications: NotificationEvent[];
  experiments: ProtocolExperiment[];
  timeSyncStatus: TimeSyncInvestigationStatus;
  setTimeSyncStatus: (status: TimeSyncInvestigationStatus) => void;
  addExperiment: (exp: Omit<ProtocolExperiment, 'id' | 'timestamp'>) => Promise<ProtocolExperiment>;
  updateExperiment: (id: string, updates: Partial<ProtocolExperiment>) => Promise<void>;
  isMockMode: boolean;
  setMockMode: (enabled: boolean) => void;
  requestDevice: (options?: DeviceRequestOptions) => Promise<DiscoveredDevice>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  discoverServices: () => Promise<GattServiceInfo[]>;
  readCharacteristic: (serviceUuid: string, charUuid: string) => Promise<Uint8Array>;
  writeCharacteristic: (
    serviceUuid: string,
    charUuid: string,
    payload: Uint8Array,
    writeType?: 'write' | 'writeWithoutResponse'
  ) => Promise<void>;
  subscribeCharacteristic: (serviceUuid: string, charUuid: string) => Promise<void>;
  unsubscribeCharacteristic: (serviceUuid: string, charUuid: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const BluetoothContext = createContext<BluetoothContextType | null>(null);

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMockMode, setIsMockMode] = useState<boolean>(() => {
    return localStorage.getItem('dizo_mock_mode') === 'true';
  });

  const mockService = useMemo(() => new MockBluetoothService(), []);
  const activeService: IBluetoothService = isMockMode
    ? mockService
    : Capacitor.isNativePlatform()
    ? capacitorBluetoothService
    : webBluetoothService;

  const [status, setStatus] = useState<ConnectionStatus>(activeService.getConnectionStatus());
  const [device, setDevice] = useState<DiscoveredDevice | null>(activeService.getConnectedDevice());
  const [services, setServices] = useState<GattServiceInfo[]>(activeService.getDiscoveredServices());
  const [capability, setCapability] = useState<BluetoothCapability | null>(null);
  const [isCheckingCapability, setIsCheckingCapability] = useState(true);

  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [experiments, setExperiments] = useState<ProtocolExperiment[]>([]);
  const [timeSyncStatus, setTimeSyncStatus] = useState<TimeSyncInvestigationStatus>(() => {
    const saved = localStorage.getItem('dizo_time_sync_status');
    return (saved as TimeSyncInvestigationStatus) || 'NOT_INVESTIGATED';
  });

  // Save time sync status changes
  const handleSetTimeSyncStatus = useCallback((newStatus: TimeSyncInvestigationStatus) => {
    setTimeSyncStatus(newStatus);
    localStorage.setItem('dizo_time_sync_status', newStatus);
    logger.info('TIME_SYNC', `Time synchronization status updated: ${newStatus}`);
  }, []);

  // Check capability
  const refreshCapability = useCallback(async () => {
    setIsCheckingCapability(true);
    try {
      const cap = await activeService.checkCapability();
      setCapability(cap);
      if (!cap.isSupported) {
        logger.warn('SYSTEM', `Web Bluetooth capability check: Not Supported (${cap.reason || 'Unknown'})`);
      } else {
        logger.info('SYSTEM', 'Web Bluetooth is supported in this browser context.');
      }
    } catch (err: any) {
      console.error('Capability check failed:', err);
    } finally {
      setIsCheckingCapability(false);
    }
  }, [activeService]);

  // Initial load
  useEffect(() => {
    logger.init();
    refreshCapability();

    // Load persisted experiments & notifications
    getAllExperimentsFromDb().then(setExperiments).catch(console.warn);
    getAllNotificationsFromDb(100).then(setNotifications).catch(console.warn);
  }, [refreshCapability]);

  // Subscribe to service status, device, and service tree changes
  useEffect(() => {
    const unsubStatus = activeService.onStatusChange(setStatus);
    const unsubDevice = activeService.onDeviceChange(setDevice);
    const unsubServices = activeService.onServicesChange(setServices);

    return () => {
      unsubStatus();
      unsubDevice();
      unsubServices();
    };
  }, [activeService]);

  const setMockMode = useCallback((enabled: boolean) => {
    setIsMockMode(enabled);
    localStorage.setItem('dizo_mock_mode', enabled ? 'true' : 'false');
    logger.info('SYSTEM', enabled ? 'Switched to Mock Bluetooth mode for UI / automated testing.' : 'Switched to live Web Bluetooth mode.');
  }, []);

  const requestDevice = useCallback(
    async (options?: DeviceRequestOptions) => {
      return await activeService.requestDevice(options);
    },
    [activeService]
  );

  const connect = useCallback(async () => {
    await activeService.connect();
  }, [activeService]);

  const disconnect = useCallback(async () => {
    await activeService.disconnect();
  }, [activeService]);

  const discoverServices = useCallback(async () => {
    return await activeService.discoverServices();
  }, [activeService]);

  const readCharacteristic = useCallback(
    async (serviceUuid: string, charUuid: string) => {
      return await activeService.readCharacteristic(serviceUuid, charUuid);
    },
    [activeService]
  );

  const writeCharacteristic = useCallback(
    async (
      serviceUuid: string,
      charUuid: string,
      payload: Uint8Array,
      writeType: 'write' | 'writeWithoutResponse' = 'write'
    ) => {
      return await activeService.writeCharacteristic(serviceUuid, charUuid, payload, writeType);
    },
    [activeService]
  );

  const subscribeCharacteristic = useCallback(
    async (serviceUuid: string, charUuid: string) => {
      await activeService.startNotifications(serviceUuid, charUuid, (event) => {
        setNotifications((prev) => [event, ...prev.slice(0, 199)]);
      });
    },
    [activeService]
  );

  const unsubscribeCharacteristic = useCallback(
    async (serviceUuid: string, charUuid: string) => {
      await activeService.stopNotifications(serviceUuid, charUuid);
    },
    [activeService]
  );

  const clearNotifications = useCallback(async () => {
    await clearAllNotificationsFromDb();
    setNotifications([]);
    logger.info('NOTIFY', 'Cleared captured notifications from database and view.');
  }, []);

  const addExperiment = useCallback(
    async (expData: Omit<ProtocolExperiment, 'id' | 'timestamp'>): Promise<ProtocolExperiment> => {
      const exp: ProtocolExperiment = {
        ...expData,
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
      };
      await saveExperimentToDb(exp);
      setExperiments((prev) => [exp, ...prev]);
      logger.info('TIME_SYNC', `Recorded protocol experiment: "${exp.title}" (${exp.action} - ${exp.result})`);
      return exp;
    },
    []
  );

  const updateExperiment = useCallback(
    async (id: string, updates: Partial<ProtocolExperiment>) => {
      setExperiments((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const updated = { ...item, ...updates };
            saveExperimentToDb(updated);
            return updated;
          }
          return item;
        })
      );
    },
    []
  );

  const value = {
    service: activeService,
    status,
    device,
    services,
    capability,
    isCheckingCapability,
    refreshCapability,
    notifications,
    experiments,
    timeSyncStatus,
    setTimeSyncStatus: handleSetTimeSyncStatus,
    addExperiment,
    updateExperiment,
    isMockMode,
    setMockMode,
    requestDevice,
    connect,
    disconnect,
    discoverServices,
    readCharacteristic,
    writeCharacteristic,
    subscribeCharacteristic,
    unsubscribeCharacteristic,
    clearNotifications,
  };

  return <BluetoothContext.Provider value={value}>{children}</BluetoothContext.Provider>;
};

export function useBluetooth(): BluetoothContextType {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return ctx;
}
