import { GattServiceInfo, GattCharacteristicProperties } from '../types/bluetooth';
import { normalizeUuid } from './uuidUtils';

export interface SmartwatchPipe {
  id: string;
  name: string;
  serviceUuid: string;
  characteristicUuid: string;
  serviceName: string;
  properties: GattCharacteristicProperties;
  preferredWriteType: 'write' | 'writeWithoutResponse';
  score: number;
  isObservedTarget: boolean;
  notes?: string;
}

export interface SmartwatchNotifyPipe {
  id: string;
  name: string;
  serviceUuid: string;
  characteristicUuid: string;
  serviceName: string;
  isNotifying?: boolean;
}

/**
 * Scan the live discovered GATT tree and extract prioritized writable pipes
 */
export function detectWritablePipes(services: GattServiceInfo[]): SmartwatchPipe[] {
  const pipes: SmartwatchPipe[] = [];

  for (const service of services) {
    const sNorm = service.normalizedUuid.toLowerCase();

    for (const char of service.characteristics) {
      const cNorm = char.normalizedUuid.toLowerCase();
      const hasWrite = Boolean(char.properties.write);
      const hasWriteNoResp = Boolean(char.properties.writeWithoutResponse);

      if (!hasWrite && !hasWriteNoResp) {
        continue;
      }

      let score = 10;
      let name = char.name || 'Writable Characteristic';
      let isObservedTarget = false;
      let notes = '';

      // Check specific Linwear / Realtek UUID patterns
      if (cNorm.includes('6387')) {
        score = 100;
        name = 'Linwear / Realtek Primary Command (6387)';
        isObservedTarget = true;
        notes = 'Primary writable endpoint for Linwear / RTL8762 smartwatches';
      } else if (cNorm.includes('ff02')) {
        score = 90;
        name = 'Realtek / Moyoung Command Tx (FF02)';
        isObservedTarget = true;
        notes = 'DaFit & Moyoung protocol command pipe';
      } else if (cNorm.includes('ffd2')) {
        score = 85;
        name = 'Realtek D0F Auxiliary Tx (FFD2)';
        isObservedTarget = true;
        notes = 'Observed on DIZO Watch D D0F vendor service';
      } else if (cNorm.includes('2a2b')) {
        score = 80;
        name = 'Bluetooth SIG Current Time (2A2B)';
        isObservedTarget = true;
        notes = 'Standard Bluetooth SIG Current Time Characteristic';
      } else if (cNorm.includes('ff04') || cNorm.includes('ffd4')) {
        score = 70;
        name = `Vendor Auxiliary Writable (${cNorm.slice(4, 8)})`;
        isObservedTarget = true;
      } else if (
        sNorm.includes('6287') ||
        sNorm.includes('01ff') ||
        sNorm.includes('0d0f') ||
        !char.isStandard
      ) {
        score = 50;
        name = `Custom Vendor Pipe (${cNorm.slice(4, 8)})`;
      }

      // Determine preferred write mode:
      // Most smartwatches mandate writeWithoutResponse for fast commands
      let preferredWriteType: 'write' | 'writeWithoutResponse' = 'writeWithoutResponse';
      if (hasWriteNoResp && !hasWrite) {
        preferredWriteType = 'writeWithoutResponse';
      } else if (hasWrite && !hasWriteNoResp) {
        preferredWriteType = 'write';
      } else if (cNorm.includes('2a2b')) {
        // Standard CTS expects write with response
        preferredWriteType = 'write';
      }

      pipes.push({
        id: `${service.uuid}:${char.uuid}`,
        name,
        serviceUuid: service.uuid,
        characteristicUuid: char.uuid,
        serviceName: service.name || 'Vendor Service',
        properties: char.properties,
        preferredWriteType,
        score,
        isObservedTarget,
        notes,
      });
    }
  }

  // Sort by score descending (best candidate pipes first)
  pipes.sort((a, b) => b.score - a.score);

  // If no pipes discovered yet (e.g. discovery in flight), supply known DIZO fallback candidates
  if (pipes.length === 0) {
    pipes.push({
      id: 'fallback-6387',
      name: 'Linwear Realtek Pipe (6387 Reference)',
      serviceUuid: '00006287-3c17-d293-8e48-14fe2e4da212',
      characteristicUuid: '00006387-3c17-d293-8e48-14fe2e4da212',
      serviceName: 'Linwear Primary Service (0x6287)',
      properties: { read: false, write: true, writeWithoutResponse: true, notify: false, indicate: false },
      preferredWriteType: 'writeWithoutResponse',
      score: 100,
      isObservedTarget: true,
      notes: 'Fallback entry based on observed DIZO Watch D hardware',
    });
    pipes.push({
      id: 'fallback-ff02',
      name: 'Realtek Moyoung Pipe (FF02 Reference)',
      serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
      characteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
      serviceName: 'Vendor Service (0x01FF)',
      properties: { read: false, write: true, writeWithoutResponse: true, notify: false, indicate: false },
      preferredWriteType: 'writeWithoutResponse',
      score: 90,
      isObservedTarget: true,
      notes: 'Fallback entry based on observed DIZO Watch D hardware',
    });
  }

  return pipes;
}

/**
 * Scan live services for notification / indication characteristics
 */
export function detectNotifyPipes(services: GattServiceInfo[]): SmartwatchNotifyPipe[] {
  const notifyPipes: SmartwatchNotifyPipe[] = [];

  for (const service of services) {
    for (const char of service.characteristics) {
      if (char.properties.notify || char.properties.indicate) {
        const cNorm = char.normalizedUuid.toLowerCase();
        let name = char.name || 'Notify Characteristic';

        if (cNorm.includes('6487')) {
          name = 'Linwear Response Rx (6487)';
        } else if (cNorm.includes('ff03')) {
          name = 'Realtek Moyoung Response Rx (FF03)';
        } else if (cNorm.includes('ffd3')) {
          name = 'Realtek D0F Response Rx (FFD3)';
        }

        notifyPipes.push({
          id: `${service.uuid}:${char.uuid}`,
          name,
          serviceUuid: service.uuid,
          characteristicUuid: char.uuid,
          serviceName: service.name || 'Vendor Service',
          isNotifying: char.isNotifying,
        });
      }
    }
  }

  return notifyPipes;
}

/**
 * Resilient GATT write: attempts preferred write type, and falls back to alternate write type if supported and rejected
 */
export async function writePipeResilient(
  writeFn: (
    serviceUuid: string,
    characteristicUuid: string,
    payload: Uint8Array,
    writeType: 'write' | 'writeWithoutResponse'
  ) => Promise<void>,
  pipe: SmartwatchPipe,
  payload: Uint8Array
): Promise<{ success: boolean; usedWriteType: 'write' | 'writeWithoutResponse'; error?: string }> {
  const tryFirst = pipe.preferredWriteType;
  const trySecond = tryFirst === 'writeWithoutResponse' ? 'write' : 'writeWithoutResponse';

  try {
    await writeFn(pipe.serviceUuid, pipe.characteristicUuid, payload, tryFirst);
    return { success: true, usedWriteType: tryFirst };
  } catch (err: any) {
    const errMsg = err.message || '';
    // If characteristic supports both or error indicates write permission mismatch, try alternate
    const canTrySecond =
      (trySecond === 'write' && pipe.properties.write) ||
      (trySecond === 'writeWithoutResponse' && pipe.properties.writeWithoutResponse) ||
      errMsg.includes('not permitted') ||
      errMsg.includes('Status 3') ||
      errMsg.includes('response');

    if (canTrySecond) {
      try {
        await writeFn(pipe.serviceUuid, pipe.characteristicUuid, payload, trySecond);
        return { success: true, usedWriteType: trySecond };
      } catch (secondErr: any) {
        return {
          success: false,
          usedWriteType: trySecond,
          error: secondErr.message || errMsg,
        };
      }
    }

    return {
      success: false,
      usedWriteType: tryFirst,
      error: errMsg,
    };
  }
}
