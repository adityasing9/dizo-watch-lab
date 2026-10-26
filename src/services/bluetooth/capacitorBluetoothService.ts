import { BleClient, BleService } from '@capacitor-community/bluetooth-le';
import {
  BluetoothCapability,
  ConnectionStatus,
  DiscoveredDevice,
  GattCharacteristicInfo,
  GattServiceInfo,
  NotificationEvent,
} from '../../types/bluetooth';
import { IBluetoothService, DeviceRequestOptions } from './bluetoothInterface';
import {
  getStandardAndObservedServiceUuids,
  lookupCharacteristicInfo,
  lookupServiceInfo,
  OBSERVED_REFERENCE_CHARACTERISTICS,
  OBSERVED_REFERENCE_SERVICES,
} from '../../data/knownUuids';
import { bytesToAscii, bytesToHex, bytesToUtf8, uint8ArrayFromSource } from '../../utils/byteUtils';
import { normalizeUuid } from '../../utils/uuidUtils';
import { logger } from '../diagnostics/diagnosticLogger';
import { saveNotificationToDb } from '../storage/indexedDb';

export class CapacitorBluetoothService implements IBluetoothService {
  private device: DiscoveredDevice | null = null;
  private status: ConnectionStatus = 'disconnected';
  private services: GattServiceInfo[] = [];
  private isInitialized = false;

  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private deviceListeners: Set<(device: DiscoveredDevice | null) => void> = new Set();
  private servicesListeners: Set<(services: GattServiceInfo[]) => void> = new Set();

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await BleClient.initialize({ androidNeverForLocation: true });
      this.isInitialized = true;
      logger.info('BLUETOOTH', 'Native Android BleClient initialized with androidNeverForLocation=true.');
    }
  }

  async checkCapability(): Promise<BluetoothCapability> {
    return {
      isSupported: true,
      isSecureContext: true,
      browserInfo: 'Native Android Capacitor Environment',
      hasDeviceChooser: true,
      recommendations: [],
    };
  }

  async requestDevice(options?: DeviceRequestOptions): Promise<DiscoveredDevice> {
    await this.ensureInitialized();
    logger.info('BLUETOOTH', 'Opening Native Android BLE device chooser...');

    const defaultOptional = getStandardAndObservedServiceUuids();
    const customOptional = (options?.optionalServices || []).filter((u): u is string => typeof u === 'string');
    // Ensure all UUIDs passed to native BleClient strictly match 128-bit canonical format
    const uuid128Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const combinedOptional = Array.from(new Set([...defaultOptional, ...customOptional]))
      .map((u) => normalizeUuid(u.trim()))
      .filter((u): u is string => typeof u === 'string' && uuid128Regex.test(u));

    try {
      // In native Android, requestDevice displays a native system dialog showing advertising BLE devices
      let selected;
      try {
        selected = await BleClient.requestDevice(
          combinedOptional.length > 0 ? { optionalServices: combinedOptional } : {}
        );
      } catch (scanErr: any) {
        // Fallback to open scan if native parser rejects any filter
        if (scanErr.message?.includes('UUID') || scanErr.message?.includes('Expected string')) {
          logger.warn('BLUETOOTH', `UUID filter rejected by native engine (${scanErr.message}). Retrying open scan without filters...`);
          selected = await BleClient.requestDevice({});
        } else {
          throw scanErr;
        }
      }

      this.device = {
        id: selected.deviceId,
        name: selected.name || 'DIZO Watch D (Native)',
        connected: false,
      };

      logger.success('BLUETOOTH', `Native device selected: ${this.device.name} (${this.device.id})`);
      this.notifyDevice(this.device);
      return this.device;
    } catch (err: any) {
      logger.error('BLUETOOTH', `Native device selection failed: ${err.message}`);
      throw err;
    }
  }

  async connect(): Promise<void> {
    if (!this.device) {
      throw new Error('No device selected. Please select a device first.');
    }

    await this.ensureInitialized();
    this.setStatus('connecting');
    logger.info('BLUETOOTH', `Connecting to native BLE peripheral ${this.device.name}...`);

    try {
      await BleClient.connect(this.device.id, (disconnectedDeviceId) => {
        logger.warn('BLUETOOTH', `Native BLE peripheral ${disconnectedDeviceId} disconnected.`);
        this.setStatus('disconnected');
        if (this.device) {
          this.device.connected = false;
          this.device.disconnectedAt = Date.now();
          this.notifyDevice({ ...this.device });
        }
      });

      this.setStatus('connected');
      this.device.connected = true;
      this.device.connectedAt = Date.now();
      this.notifyDevice({ ...this.device });
      logger.success('BLUETOOTH', `GATT connection established with ${this.device.name}!`);

      await this.discoverServices();
    } catch (err: any) {
      this.setStatus('error');
      logger.error('BLUETOOTH', `Native connection error: ${err.message}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await BleClient.disconnect(this.device.id);
      } catch (err: any) {
        logger.warn('BLUETOOTH', `Error during disconnect: ${err.message}`);
      }
      this.device.connected = false;
      this.device.disconnectedAt = Date.now();
      this.notifyDevice({ ...this.device });
    }
    this.setStatus('disconnected');
  }

  async discoverServices(): Promise<GattServiceInfo[]> {
    if (!this.device || this.status !== 'connected') {
      throw new Error('Device is not connected.');
    }

    logger.info('GATT', 'Enumerating native Android GATT services...');
    try {
      const nativeServices: BleService[] = await BleClient.getServices(this.device.id);
      const discoveredServiceInfos: GattServiceInfo[] = [];

      for (const service of nativeServices) {
        const serviceUuidNorm = normalizeUuid(service.uuid);
        const serviceMeta = lookupServiceInfo(service.uuid);
        const isObserved = OBSERVED_REFERENCE_SERVICES.some((s) => s.uuid.toLowerCase() === serviceUuidNorm);

        const characteristicInfos: GattCharacteristicInfo[] = [];

        for (const char of service.characteristics) {
          const charUuidNorm = normalizeUuid(char.uuid);
          const charMeta = lookupCharacteristicInfo(char.uuid);
          const isCharObserved = OBSERVED_REFERENCE_CHARACTERISTICS.some((c) => c.uuid.toLowerCase() === charUuidNorm);

          characteristicInfos.push({
            uuid: char.uuid,
            normalizedUuid: charUuidNorm,
            name: charMeta.name,
            isStandard: charMeta.category === 'standard',
            serviceUuid: service.uuid,
            properties: {
              read: Boolean(char.properties.read),
              write: Boolean(char.properties.write),
              writeWithoutResponse: Boolean(char.properties.writeWithoutResponse),
              notify: Boolean(char.properties.notify),
              indicate: Boolean(char.properties.indicate),
            },
            isObservedReference: isCharObserved,
            referenceNotes: charMeta.notes,
          });
        }

        discoveredServiceInfos.push({
          uuid: service.uuid,
          normalizedUuid: serviceUuidNorm,
          name: serviceMeta.name,
          isStandard: serviceMeta.category === 'standard',
          isPrimary: true,
          characteristics: characteristicInfos,
          isObservedReference: isObserved,
          referenceNotes: serviceMeta.notes,
        });
      }

      this.services = discoveredServiceInfos;
      this.notifyServices(this.services);
      const totalChars = discoveredServiceInfos.reduce((acc, s) => acc + s.characteristics.length, 0);
      logger.success('GATT', `Discovered ${discoveredServiceInfos.length} services and ${totalChars} characteristics via native BLE.`);
      return discoveredServiceInfos;
    } catch (err: any) {
      logger.error('GATT', `Native service discovery failed: ${err.message}`);
      throw err;
    }
  }

  async readCharacteristic(serviceUuid: string, characteristicUuid: string): Promise<Uint8Array> {
    if (!this.device || this.status !== 'connected') {
      throw new Error('Device is not connected.');
    }

    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);

    try {
      const dataView = await BleClient.read(this.device.id, sNorm, cNorm);
      const bytes = uint8ArrayFromSource(dataView);
      const hex = bytesToHex(bytes);
      const ascii = bytesToAscii(bytes);
      const utf8 = bytesToUtf8(bytes);

      logger.success('READ', `Read from ${characteristicUuid}: [${hex}] (${bytes.length} bytes)`, {
        serviceUuid,
        characteristicUuid,
        payloadHex: hex,
      });

      this.updateCharacteristicValue(
        sNorm,
        cNorm,
        hex,
        Array.from(bytes),
        ascii
      );

      return bytes;
    } catch (err: any) {
      logger.error('READ', `Native read failed on ${characteristicUuid}: ${err.message}`);
      throw err;
    }
  }

  async writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    payload: Uint8Array,
    writeType: 'write' | 'writeWithoutResponse' = 'write'
  ): Promise<void> {
    if (!this.device || this.status !== 'connected') {
      throw new Error('Device is not connected.');
    }

    const hex = bytesToHex(payload);
    const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);

    try {
      if (writeType === 'writeWithoutResponse') {
        await BleClient.writeWithoutResponse(this.device.id, sNorm, cNorm, dataView);
      } else {
        await BleClient.write(this.device.id, sNorm, cNorm, dataView);
      }

      logger.success('WRITE', `Native write [${hex}] sent to ${characteristicUuid}`);
    } catch (err: any) {
      logger.error('WRITE', `Native write failed on ${characteristicUuid}: ${err.message}`);
      throw err;
    }
  }

  async startNotifications(
    serviceUuid: string,
    characteristicUuid: string,
    onNotify: (event: NotificationEvent) => void
  ): Promise<void> {
    if (!this.device || this.status !== 'connected') {
      throw new Error('Device is not connected.');
    }

    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);

    try {
      await BleClient.startNotifications(
        this.device.id,
        sNorm,
        cNorm,
        (dataView: DataView) => {
          const bytes = uint8ArrayFromSource(dataView);
          const hex = bytesToHex(bytes);
          const ascii = bytesToAscii(bytes);
          const utf8 = bytesToUtf8(bytes);

          const event: NotificationEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            serviceUuid,
            characteristicUuid,
            payloadHex: hex,
            payloadBytes: Array.from(bytes),
            payloadLength: bytes.length,
            asciiPreview: ascii,
            utf8Preview: utf8.length > 0 ? utf8 : undefined,
          };

          saveNotificationToDb(event);
          onNotify(event);
        }
      );

      this.setCharacteristicNotifying(sNorm, cNorm, true);
      logger.success('NOTIFY', `Subscribed to native notifications on ${characteristicUuid}`);
    } catch (err: any) {
      logger.error('NOTIFY', `Native notification subscription failed on ${characteristicUuid}: ${err.message}`);
      throw err;
    }
  }

  async stopNotifications(serviceUuid: string, characteristicUuid: string): Promise<void> {
    if (!this.device) return;
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);
    try {
      await BleClient.stopNotifications(this.device.id, sNorm, cNorm);
      this.setCharacteristicNotifying(sNorm, cNorm, false);
      logger.info('NOTIFY', `Stopped native notifications on ${characteristicUuid}`);
    } catch (err: any) {
      logger.warn('NOTIFY', `Error stopping native notifications: ${err.message}`);
    }
  }

  private updateCharacteristicValue(
    sNorm: string,
    cNorm: string,
    hex: string,
    bytes: number[],
    ascii: string,
    isNotifying?: boolean
  ): void {
    const s = this.services.find((serv) => serv.normalizedUuid === sNorm);
    if (!s) return;
    const c = s.characteristics.find((char) => char.normalizedUuid === cNorm);
    if (!c) return;

    c.lastValueHex = hex;
    c.lastValueBytes = bytes;
    c.lastValueAscii = ascii;
    c.lastReadTimestamp = Date.now();
    if (isNotifying !== undefined) c.isNotifying = isNotifying;
    this.notifyServices([...this.services]);
  }

  private setCharacteristicNotifying(sNorm: string, cNorm: string, isNotifying: boolean): void {
    const s = this.services.find((serv) => serv.normalizedUuid === sNorm);
    if (!s) return;
    const c = s.characteristics.find((char) => char.normalizedUuid === cNorm);
    if (!c) return;

    c.isNotifying = isNotifying;
    this.notifyServices([...this.services]);
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectedDevice(): DiscoveredDevice | null {
    return this.device;
  }

  getDiscoveredServices(): GattServiceInfo[] {
    return [...this.services];
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  private notifyDevice(device: DiscoveredDevice | null): void {
    this.deviceListeners.forEach((cb) => cb(device));
  }

  private notifyServices(services: GattServiceInfo[]): void {
    this.servicesListeners.forEach((cb) => cb(services));
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
    callback([...this.services]);
    return () => this.servicesListeners.delete(callback);
  }
}

export const capacitorBluetoothService = new CapacitorBluetoothService();
