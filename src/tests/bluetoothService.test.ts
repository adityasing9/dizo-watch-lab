import { describe, it, expect } from 'vitest';
import { MockBluetoothService } from '../services/bluetooth/mockBluetoothService';
import { bytesToHex } from '../utils/byteUtils';

describe('Bluetooth Service Abstraction & Mock Provider', () => {
  it('detects capability accurately in test environment', async () => {
    const service = new MockBluetoothService();
    const cap = await service.checkCapability();

    expect(cap.isSupported).toBe(true);
    expect(cap.isSecureContext).toBe(true);
    expect(cap.hasDeviceChooser).toBe(true);
  });

  it('manages connection lifecycle state transitions', async () => {
    const service = new MockBluetoothService();
    expect(service.getConnectionStatus()).toBe('disconnected');

    const dev = await service.requestDevice();
    expect(dev.name).toBe('DIZO Watch D (Mock)');
    expect(dev.connected).toBe(false);

    await service.connect();
    expect(service.getConnectionStatus()).toBe('connected');
    expect(service.getConnectedDevice()?.connected).toBe(true);

    const services = service.getDiscoveredServices();
    expect(services.length).toBeGreaterThan(0);

    await service.disconnect();
    expect(service.getConnectionStatus()).toBe('disconnected');
    expect(service.getConnectedDevice()?.connected).toBe(false);
  });

  it('reads characteristic and returns raw bytes', async () => {
    const service = new MockBluetoothService();
    await service.requestDevice();
    await service.connect();

    const bytes = await service.readCharacteristic('00001800-0000-1000-8000-00805f9b34fb', '00002a00-0000-1000-8000-00805f9b34fb');
    expect(ArrayBuffer.isView(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('DIZO Watch D');
  });

  it('handles notification subscriptions', async () => {
    const service = new MockBluetoothService();
    await service.requestDevice();
    await service.connect();

    let notificationFired = false;
    await service.startNotifications(
      '00006287-3c17-d293-8e48-14fe2e4da212',
      '00006387-3c17-d293-8e48-14fe2e4da212',
      (event) => {
        notificationFired = true;
        expect(event.payloadHex).toBeDefined();
      }
    );

    expect(notificationFired).toBe(true);
  });
});
