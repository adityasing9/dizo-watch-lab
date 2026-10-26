import {
  BluetoothCapability,
  ConnectionStatus,
  DiscoveredDevice,
  GattServiceInfo,
  NotificationEvent,
} from '../../types/bluetooth';

export interface DeviceRequestOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: string[];
  acceptAllDevices?: boolean;
}

export interface IBluetoothService {
  checkCapability(): Promise<BluetoothCapability>;
  requestDevice(options?: DeviceRequestOptions): Promise<DiscoveredDevice>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  discoverServices(): Promise<GattServiceInfo[]>;
  readCharacteristic(serviceUuid: string, characteristicUuid: string): Promise<Uint8Array>;
  writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    payload: Uint8Array,
    writeType?: 'write' | 'writeWithoutResponse'
  ): Promise<void>;
  startNotifications(
    serviceUuid: string,
    characteristicUuid: string,
    onNotify: (event: NotificationEvent) => void
  ): Promise<void>;
  stopNotifications(serviceUuid: string, characteristicUuid: string): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  getConnectedDevice(): DiscoveredDevice | null;
  getDiscoveredServices(): GattServiceInfo[];
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
  onDeviceChange(callback: (device: DiscoveredDevice | null) => void): () => void;
  onServicesChange(callback: (services: GattServiceInfo[]) => void): () => void;
}
