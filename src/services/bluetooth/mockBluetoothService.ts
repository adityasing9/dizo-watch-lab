import {
  BluetoothCapability,
  ConnectionStatus,
  DiscoveredDevice,
  GattServiceInfo,
  NotificationEvent,
} from '../../types/bluetooth';
import { IBluetoothService, DeviceRequestOptions } from './bluetoothInterface';
import { STANDARD_SERVICES, STANDARD_CHARACTERISTICS, OBSERVED_REFERENCE_SERVICES, OBSERVED_REFERENCE_CHARACTERISTICS } from '../../data/knownUuids';
import { bytesToHex, bytesToAscii } from '../../utils/byteUtils';

export class MockBluetoothService implements IBluetoothService {
  private status: ConnectionStatus = 'disconnected';
  private device: DiscoveredDevice | null = null;
  private services: GattServiceInfo[] = [];

  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private deviceListeners: Set<(device: DiscoveredDevice | null) => void> = new Set();
  private servicesListeners: Set<(services: GattServiceInfo[]) => void> = new Set();

  async checkCapability(): Promise<BluetoothCapability> {
    return {
      isSupported: true,
      isSecureContext: true,
      browserInfo: 'Mock Test Environment (Vitest/JSDOM)',
      hasDeviceChooser: true,
      recommendations: [],
    };
  }

  async requestDevice(_options?: DeviceRequestOptions): Promise<DiscoveredDevice> {
    this.device = {
      id: 'mock-dizo-watch-d-uuid',
      name: 'DIZO Watch D (Mock)',
      connected: false,
    };
    this.notifyDevice(this.device);
    return this.device;
  }

  async connect(): Promise<void> {
    if (!this.device) {
      throw new Error('No device selected');
    }
    this.status = 'connecting';
    this.notifyStatus('connecting');

    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 50));

    this.status = 'connected';
    this.device.connected = true;
    this.device.connectedAt = Date.now();
    this.notifyStatus('connected');
    this.notifyDevice({ ...this.device });

    await this.discoverServices();
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    if (this.device) {
      this.device.connected = false;
      this.device.disconnectedAt = Date.now();
    }
    this.notifyStatus('disconnected');
    this.notifyDevice(this.device ? { ...this.device } : null);
  }

  async discoverServices(): Promise<GattServiceInfo[]> {
    // Generate realistic GATT tree based on standard and observed reference data
    this.services = [
      {
        uuid: '00001800-0000-1000-8000-00805f9b34fb',
        normalizedUuid: '00001800-0000-1000-8000-00805f9b34fb',
        name: STANDARD_SERVICES['00001800-0000-1000-8000-00805f9b34fb'].name,
        isStandard: true,
        isPrimary: true,
        characteristics: [
          {
            uuid: '00002a00-0000-1000-8000-00805f9b34fb',
            normalizedUuid: '00002a00-0000-1000-8000-00805f9b34fb',
            name: 'Device Name',
            isStandard: true,
            serviceUuid: '00001800-0000-1000-8000-00805f9b34fb',
            properties: { read: true, write: false, writeWithoutResponse: false, notify: false, indicate: false },
            lastValueHex: '44 49 5A 4F 20 57 61 74 63 68 20 44',
            lastValueAscii: 'DIZO Watch D',
          },
        ],
      },
      {
        uuid: '00001805-0000-1000-8000-00805f9b34fb',
        normalizedUuid: '00001805-0000-1000-8000-00805f9b34fb',
        name: 'Current Time Service (CTS)',
        isStandard: true,
        isPrimary: true,
        characteristics: [
          {
            uuid: '00002a2b-0000-1000-8000-00805f9b34fb',
            normalizedUuid: '00002a2b-0000-1000-8000-00805f9b34fb',
            name: STANDARD_CHARACTERISTICS['00002a2b-0000-1000-8000-00805f9b34fb'].name,
            isStandard: true,
            serviceUuid: '00001805-0000-1000-8000-00805f9b34fb',
            properties: { read: true, write: true, writeWithoutResponse: false, notify: true, indicate: false },
          },
        ],
      },
      {
        uuid: '00006287-3c17-d293-8e48-14fe2e4da212',
        normalizedUuid: '00006287-3c17-d293-8e48-14fe2e4da212',
        name: OBSERVED_REFERENCE_SERVICES[2].name,
        isStandard: false,
        isPrimary: true,
        isObservedReference: true,
        referenceNotes: 'Previously observed — verification required.',
        characteristics: [
          {
            uuid: '00006387-3c17-d293-8e48-14fe2e4da212',
            normalizedUuid: '00006387-3c17-d293-8e48-14fe2e4da212',
            name: OBSERVED_REFERENCE_CHARACTERISTICS[6].name,
            isStandard: false,
            serviceUuid: '00006287-3c17-d293-8e48-14fe2e4da212',
            isObservedReference: true,
            referenceNotes: 'Previously observed — verification required.',
            properties: { read: true, write: true, writeWithoutResponse: true, notify: true, indicate: false },
          },
        ],
      },
    ];

    this.notifyServices(this.services);
    return this.services;
  }

  async readCharacteristic(_serviceUuid: string, characteristicUuid: string): Promise<Uint8Array> {
    if (characteristicUuid.toLowerCase().includes('2a00')) {
      const bytes = new TextEncoder().encode('DIZO Watch D');
      return bytes;
    }
    const dummy = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    return dummy;
  }

  async writeCharacteristic(
    _serviceUuid: string,
    _characteristicUuid: string,
    _payload: Uint8Array,
    _writeType?: 'write' | 'writeWithoutResponse'
  ): Promise<void> {
    // Mock write success
  }

  async startNotifications(
    serviceUuid: string,
    characteristicUuid: string,
    onNotify: (event: NotificationEvent) => void
  ): Promise<void> {
    // Send a mock notification event
    const sampleBytes = new Uint8Array([0xaa, 0x01, 0x55]);
    onNotify({
      id: 'mock-notif-1',
      timestamp: Date.now(),
      serviceUuid,
      characteristicUuid,
      payloadHex: bytesToHex(sampleBytes),
      payloadBytes: Array.from(sampleBytes),
      payloadLength: sampleBytes.length,
      asciiPreview: bytesToAscii(sampleBytes),
    });
  }

  async stopNotifications(_serviceUuid: string, _characteristicUuid: string): Promise<void> {}

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectedDevice(): DiscoveredDevice | null {
    return this.device;
  }

  getDiscoveredServices(): GattServiceInfo[] {
    return this.services;
  }

  private notifyStatus(s: ConnectionStatus) {
    this.statusListeners.forEach((cb) => cb(s));
  }

  private notifyDevice(d: DiscoveredDevice | null) {
    this.deviceListeners.forEach((cb) => cb(d));
  }

  private notifyServices(s: GattServiceInfo[]) {
    this.servicesListeners.forEach((cb) => cb(s));
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  onDeviceChange(callback: (device: DiscoveredDevice | null) => void): () => void {
    this.deviceListeners.add(callback);
    callback(this.device);
    return () => this.deviceListeners.delete(callback);
  }

  onServicesChange(callback: (services: GattServiceInfo[]) => void): () => void {
    this.servicesListeners.add(callback);
    callback(this.services);
    return () => this.servicesListeners.delete(callback);
  }
}
