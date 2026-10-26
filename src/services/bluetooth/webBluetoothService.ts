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

export class WebBluetoothService implements IBluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private status: ConnectionStatus = 'disconnected';
  private services: GattServiceInfo[] = [];

  // Cached GATT references for live operations
  private gattServicesMap: Map<string, BluetoothRemoteGATTService> = new Map();
  private gattCharacteristicsMap: Map<string, BluetoothRemoteGATTCharacteristic> = new Map();
  private notificationListeners: Map<string, (event: Event) => void> = new Map();

  // Subscriptions
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private deviceListeners: Set<(device: DiscoveredDevice | null) => void> = new Set();
  private servicesListeners: Set<(services: GattServiceInfo[]) => void> = new Set();

  async checkCapability(): Promise<BluetoothCapability> {
    const isSecureContext = typeof window !== 'undefined' && Boolean(window.isSecureContext);
    const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator && Boolean(navigator.bluetooth);
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    const recommendations: string[] = [];

    if (!isSecureContext) {
      recommendations.push(
        'Web Bluetooth strictly requires a Secure Context (HTTPS or localhost). If accessing over LAN IP (e.g. 192.168.x.x) on Android, open chrome://flags/#unsafely-treat-insecure-origin-as-secure or use "adb reverse tcp:5173 tcp:5173" to view on localhost:5173.'
      );
    }

    if (!hasBluetooth) {
      if (userAgent.includes('Firefox')) {
        recommendations.push('Mozilla Firefox does not implement the Web Bluetooth API. Please use Google Chrome, Microsoft Edge, or Chromium-based browsers.');
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        recommendations.push('Apple Safari on iOS/macOS does not support Web Bluetooth by default. On iOS, third-party browsers like Bluefy provide Web Bluetooth.');
      } else {
        recommendations.push('Ensure Bluetooth is enabled in your operating system settings and browser flags (chrome://flags/#enable-web-bluetooth).');
      }
    }

    const isSupported = isSecureContext && hasBluetooth;

    return {
      isSupported,
      isSecureContext,
      browserInfo: userAgent,
      hasDeviceChooser: hasBluetooth && typeof navigator.bluetooth.requestDevice === 'function',
      reason: !isSecureContext
        ? 'Insecure context: Web Bluetooth is disabled on non-HTTPS / non-localhost origins.'
        : !hasBluetooth
        ? 'Web Bluetooth API (navigator.bluetooth) not detected in this browser.'
        : undefined,
      recommendations,
    };
  }

  async requestDevice(options?: DeviceRequestOptions): Promise<DiscoveredDevice> {
    const capability = await this.checkCapability();
    if (!capability.isSupported) {
      const err = new Error(capability.reason || 'Web Bluetooth is not supported on this browser/context.');
      logger.error('BLUETOOTH', err.message, { details: { recommendations: capability.recommendations } });
      throw err;
    }

    // Prepare default optional services so Web Bluetooth does not block GATT access
    const defaultOptionalServices = getStandardAndObservedServiceUuids();
    const customOptional = options?.optionalServices || [];
    const combinedOptional = Array.from(new Set([...defaultOptionalServices, ...customOptional]));

    logger.info('BLUETOOTH', 'Opening Bluetooth device chooser dialog...', {
      details: {
        acceptAllDevices: options?.acceptAllDevices ?? true,
        optionalServicesCount: combinedOptional.length,
      },
    });

    try {
      const requestOptions: RequestDeviceOptions = options?.filters
        ? {
            filters: options.filters,
            optionalServices: combinedOptional,
          }
        : {
            acceptAllDevices: true,
            optionalServices: combinedOptional,
          };

      const selectedDevice = await navigator.bluetooth.requestDevice(requestOptions);
      this.device = selectedDevice;

      // Register disconnect listener
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      logger.success('BLUETOOTH', `Device selected: ${this.device.name || 'Unnamed Peripheral'} (ID: ${this.device.id})`, {
        details: { id: this.device.id, name: this.device.name },
      });

      const discovered: DiscoveredDevice = {
        id: this.device.id,
        name: this.device.name || null,
        connected: false,
      };

      this.notifyDevice(discovered);
      return discovered;
    } catch (err: any) {
      if (err.name === 'NotFoundError' && err.message?.toLowerCase().includes('globally disabled')) {
        const errorMsg = 'Web Bluetooth API is globally disabled by your browser or operating system. Check that you are NOT in an Incognito/Private window, that Windows Bluetooth is switched ON, and that Bluetooth permissions are allowed in browser settings.';
        logger.error('BLUETOOTH', errorMsg, { details: { rawError: err.message } });
        throw new Error(errorMsg);
      } else if (err.name === 'NotFoundError') {
        logger.warn('BLUETOOTH', 'Device chooser was cancelled or timed out by user.');
      } else {
        logger.error('BLUETOOTH', `Failed to request Bluetooth device: ${err.message}`, { details: { error: err.name } });
      }
      throw err;
    }
  }

  async connect(): Promise<void> {
    if (!this.device) {
      throw new Error('No Bluetooth device selected. Please select a device first.');
    }

    if (!this.device.gatt) {
      throw new Error('GATT client is not available on this device.');
    }

    this.setStatus('connecting');
    logger.info('BLUETOOTH', `Attempting GATT connection to ${this.device.name || 'Unnamed Device'}...`);

    try {
      const server = await this.device.gatt.connect();
      this.server = server;
      this.setStatus('connected');

      logger.success('BLUETOOTH', `GATT connection established with ${this.device.name || 'Device'}!`);

      this.notifyDevice({
        id: this.device.id,
        name: this.device.name || null,
        connected: true,
        connectedAt: Date.now(),
      });

      // Automatically discover services after connection
      await this.discoverServices();
    } catch (err: any) {
      this.setStatus('error');
      let friendlyMsg = err.message || 'Unknown connection error';

      if (err.name === 'NetworkError' || friendlyMsg.toLowerCase().includes('connection failed')) {
        friendlyMsg =
          'Connection failed. The watch may already be connected to the official DIZO app, Realme Link, or another phone. BLE peripherals typically allow only ONE active connection. Please unpair or turn off Bluetooth on other devices and retry.';
      }

      logger.error('BLUETOOTH', `GATT Connection Failed: ${friendlyMsg}`, {
        details: { rawError: err.name, message: err.message },
      });
      throw new Error(friendlyMsg);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device || !this.server) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('disconnecting');
    logger.info('BLUETOOTH', 'Disconnecting GATT client...');

    // Clean up notifications
    for (const [key, listener] of this.notificationListeners.entries()) {
      const char = this.gattCharacteristicsMap.get(key);
      if (char) {
        try {
          char.removeEventListener('characteristicvaluechanged', listener);
          await char.stopNotifications();
        } catch {
          // Ignore cleanup errors on disconnect
        }
      }
    }
    this.notificationListeners.clear();
    this.gattCharacteristicsMap.clear();
    this.gattServicesMap.clear();

    if (this.server.connected) {
      this.server.disconnect();
    }

    this.handleDisconnection();
  }

  private handleDisconnection(): void {
    logger.warn('BLUETOOTH', 'Bluetooth device disconnected.');
    this.setStatus('disconnected');
    if (this.device) {
      this.notifyDevice({
        id: this.device.id,
        name: this.device.name || null,
        connected: false,
        disconnectedAt: Date.now(),
      });
    }
  }

  async discoverServices(): Promise<GattServiceInfo[]> {
    if (!this.server || !this.server.connected) {
      throw new Error('GATT server is not connected.');
    }

    logger.info('GATT', 'Discovering primary GATT services...');
    this.gattServicesMap.clear();
    this.gattCharacteristicsMap.clear();

    try {
      const primaryServices = await this.server.getPrimaryServices();
      const discoveredServiceInfos: GattServiceInfo[] = [];

      logger.info('GATT', `Discovered ${primaryServices.length} primary service(s). Discovering characteristics...`);

      for (const service of primaryServices) {
        const serviceUuidNorm = normalizeUuid(service.uuid);
        this.gattServicesMap.set(serviceUuidNorm, service);

        const serviceMeta = lookupServiceInfo(service.uuid);
        const isObserved = OBSERVED_REFERENCE_SERVICES.some((s) => s.uuid.toLowerCase() === serviceUuidNorm);

        let characteristics: BluetoothRemoteGATTCharacteristic[] = [];
        try {
          characteristics = await service.getCharacteristics();
        } catch (charErr: any) {
          logger.warn('GATT', `Could not enumerate characteristics for service ${service.uuid}: ${charErr.message}`);
        }

        const characteristicInfos: GattCharacteristicInfo[] = [];

        for (const char of characteristics) {
          const charUuidNorm = normalizeUuid(char.uuid);
          const charMapKey = `${serviceUuidNorm}/${charUuidNorm}`;
          this.gattCharacteristicsMap.set(charMapKey, char);

          const charMeta = lookupCharacteristicInfo(char.uuid);
          const isCharObserved = OBSERVED_REFERENCE_CHARACTERISTICS.some((c) => c.uuid.toLowerCase() === charUuidNorm);

          const charInfo: GattCharacteristicInfo = {
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
              authenticatedSignedWrites: Boolean(char.properties.authenticatedSignedWrites),
              broadcast: Boolean(char.properties.broadcast),
              reliableWrite: Boolean(char.properties.reliableWrite),
              writableAuxiliaries: Boolean(char.properties.writableAuxiliaries),
            },
            isObservedReference: isCharObserved,
            referenceNotes: charMeta.notes,
          };

          characteristicInfos.push(charInfo);
        }

        discoveredServiceInfos.push({
          uuid: service.uuid,
          normalizedUuid: serviceUuidNorm,
          name: serviceMeta.name,
          isStandard: serviceMeta.category === 'standard',
          isPrimary: service.isPrimary,
          characteristics: characteristicInfos,
          isObservedReference: isObserved,
          referenceNotes: serviceMeta.notes,
        });
      }

      this.services = discoveredServiceInfos;
      this.notifyServices(this.services);

      const totalChars = discoveredServiceInfos.reduce((acc, s) => acc + s.characteristics.length, 0);
      logger.success('GATT', `GATT Service Discovery complete: found ${discoveredServiceInfos.length} services and ${totalChars} characteristics.`);

      return discoveredServiceInfos;
    } catch (err: any) {
      logger.error('GATT', `Service discovery failed: ${err.message}`);
      throw err;
    }
  }

  async readCharacteristic(serviceUuid: string, characteristicUuid: string): Promise<Uint8Array> {
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);
    const key = `${sNorm}/${cNorm}`;

    let char = this.gattCharacteristicsMap.get(key);
    if (!char && this.server && this.server.connected) {
      // Lazy lookup if not yet indexed
      const service = await this.server.getPrimaryService(serviceUuid);
      char = await service.getCharacteristic(characteristicUuid);
      this.gattCharacteristicsMap.set(key, char);
    }

    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found or GATT disconnected.`);
    }

    if (!char.properties.read) {
      const err = new Error(`Characteristic ${characteristicUuid} does not support read operations.`);
      logger.warn('READ', err.message);
      throw err;
    }

    logger.info('READ', `Reading characteristic ${characteristicUuid}...`, {
      serviceUuid,
      characteristicUuid,
    });

    try {
      const dataView = await char.readValue();
      const bytes = uint8ArrayFromSource(dataView);
      const hex = bytesToHex(bytes);
      const ascii = bytesToAscii(bytes);
      const utf8 = bytesToUtf8(bytes);

      logger.success('READ', `Read from ${characteristicUuid}: [${hex}] (${bytes.length} bytes)`, {
        serviceUuid,
        characteristicUuid,
        payloadHex: hex,
        details: { ascii, utf8: utf8.length > 0 ? utf8 : undefined, byteLength: bytes.length },
      });

      // Update in-memory service representation
      this.updateCharacteristicValue(sNorm, cNorm, hex, Array.from(bytes), ascii);

      return bytes;
    } catch (err: any) {
      logger.error('READ', `Failed to read ${characteristicUuid}: ${err.message}`, {
        serviceUuid,
        characteristicUuid,
      });
      throw err;
    }
  }

  async writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    payload: Uint8Array,
    writeType: 'write' | 'writeWithoutResponse' = 'write'
  ): Promise<void> {
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);
    const key = `${sNorm}/${cNorm}`;

    let char = this.gattCharacteristicsMap.get(key);
    if (!char && this.server && this.server.connected) {
      const service = await this.server.getPrimaryService(serviceUuid);
      char = await service.getCharacteristic(characteristicUuid);
      this.gattCharacteristicsMap.set(key, char);
    }

    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found or GATT disconnected.`);
    }

    const hex = bytesToHex(payload);

    // Verify properties
    const hasWrite = char.properties.write;
    const hasWriteNoResp = char.properties.writeWithoutResponse;

    if (!hasWrite && !hasWriteNoResp) {
      throw new Error(`Characteristic ${characteristicUuid} does not permit write operations.`);
    }

    logger.info('WRITE', `Writing ${payload.length} bytes to ${characteristicUuid} (${writeType})...`, {
      serviceUuid,
      characteristicUuid,
      payloadHex: hex,
    });

    try {
      if (writeType === 'writeWithoutResponse' && 'writeValueWithoutResponse' in char && hasWriteNoResp) {
        await char.writeValueWithoutResponse(payload);
      } else if ('writeValueWithResponse' in char && hasWrite) {
        await char.writeValueWithResponse(payload);
      } else {
        // Fallback to standard writeValue
        await char.writeValue(payload);
      }

      logger.success('WRITE', `Successfully wrote [${hex}] to ${characteristicUuid}`, {
        serviceUuid,
        characteristicUuid,
        payloadHex: hex,
      });
    } catch (err: any) {
      logger.error('WRITE', `Write to ${characteristicUuid} failed: ${err.message}`, {
        serviceUuid,
        characteristicUuid,
        payloadHex: hex,
      });
      throw err;
    }
  }

  async startNotifications(
    serviceUuid: string,
    characteristicUuid: string,
    onNotify: (event: NotificationEvent) => void
  ): Promise<void> {
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);
    const key = `${sNorm}/${cNorm}`;

    let char = this.gattCharacteristicsMap.get(key);
    if (!char && this.server && this.server.connected) {
      const service = await this.server.getPrimaryService(serviceUuid);
      char = await service.getCharacteristic(characteristicUuid);
      this.gattCharacteristicsMap.set(key, char);
    }

    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found or GATT disconnected.`);
    }

    if (!char.properties.notify && !char.properties.indicate) {
      throw new Error(`Characteristic ${characteristicUuid} does not support notify or indicate.`);
    }

    if (this.notificationListeners.has(key)) {
      logger.warn('NOTIFY', `Already subscribed to notifications on ${characteristicUuid}.`);
      return;
    }

    logger.info('NOTIFY', `Subscribing to notifications on ${characteristicUuid}...`);

    try {
      await char.startNotifications();

      const listener = (event: Event) => {
        const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
        if (!target || !target.value) return;

        const bytes = uint8ArrayFromSource(target.value);
        const hex = bytesToHex(bytes);
        const ascii = bytesToAscii(bytes);
        const utf8 = bytesToUtf8(bytes);

        const notifEvent: NotificationEvent = {
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

        // Persist to DB and notify logger & subscriber
        saveNotificationToDb(notifEvent);
        logger.info('NOTIFY', `Notification from ${characteristicUuid}: [${hex}]`, {
          serviceUuid,
          characteristicUuid,
          payloadHex: hex,
          details: { ascii, length: bytes.length },
        });

        // Update in-memory characteristic state
        this.updateCharacteristicValue(sNorm, cNorm, hex, Array.from(bytes), ascii, true);

        onNotify(notifEvent);
      };

      char.addEventListener('characteristicvaluechanged', listener);
      this.notificationListeners.set(key, listener);

      this.setCharacteristicNotifying(sNorm, cNorm, true);
      logger.success('NOTIFY', `Active subscription on ${characteristicUuid}`);
    } catch (err: any) {
      logger.error('NOTIFY', `Failed to start notifications on ${characteristicUuid}: ${err.message}`);
      throw err;
    }
  }

  async stopNotifications(serviceUuid: string, characteristicUuid: string): Promise<void> {
    const sNorm = normalizeUuid(serviceUuid);
    const cNorm = normalizeUuid(characteristicUuid);
    const key = `${sNorm}/${cNorm}`;

    const char = this.gattCharacteristicsMap.get(key);
    const listener = this.notificationListeners.get(key);

    if (char && listener) {
      try {
        char.removeEventListener('characteristicvaluechanged', listener);
        await char.stopNotifications();
        this.notificationListeners.delete(key);
        this.setCharacteristicNotifying(sNorm, cNorm, false);
        logger.info('NOTIFY', `Stopped notifications on ${characteristicUuid}`);
      } catch (err: any) {
        logger.warn('NOTIFY', `Error while stopping notifications on ${characteristicUuid}: ${err.message}`);
      }
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
    if (isNotifying !== undefined) {
      c.isNotifying = isNotifying;
    }
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
    if (!this.device) return null;
    return {
      id: this.device.id,
      name: this.device.name || null,
      connected: this.status === 'connected',
    };
  }

  getDiscoveredServices(): GattServiceInfo[] {
    return [...this.services];
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('Status listener error:', err);
      }
    });
  }

  private notifyDevice(device: DiscoveredDevice | null): void {
    this.deviceListeners.forEach((cb) => {
      try {
        cb(device);
      } catch (err) {
        console.error('Device listener error:', err);
      }
    });
  }

  private notifyServices(services: GattServiceInfo[]): void {
    this.servicesListeners.forEach((cb) => {
      try {
        cb(services);
      } catch (err) {
        console.error('Services listener error:', err);
      }
    });
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  onDeviceChange(callback: (device: DiscoveredDevice | null) => void): () => void {
    this.deviceListeners.add(callback);
    callback(this.getConnectedDevice());
    return () => this.deviceListeners.delete(callback);
  }

  onServicesChange(callback: (services: GattServiceInfo[]) => void): () => void {
    this.servicesListeners.add(callback);
    callback([...this.services]);
    return () => this.servicesListeners.delete(callback);
  }
}

export const webBluetoothService = new WebBluetoothService();
