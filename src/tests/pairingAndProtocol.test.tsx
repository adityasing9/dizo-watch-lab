import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { BluetoothProvider } from '../context/BluetoothContext';
import { PairingAssistantPage } from '../pages/PairingAssistantPage';
import { ProtocolResearchPage } from '../pages/ProtocolResearchPage';
import {
  CANDIDATE_PAIRING_COMMANDS,
  findMatchingPairingPipe,
} from '../utils/pairingProtocol';
import { GattServiceInfo } from '../types/bluetooth';

describe('Pairing Assistant & Protocol Research (Core Features C & E)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('dizo_mock_mode', 'true');
  });

  it('all candidate pairing commands are initialized as unverified (scientific rigor)', () => {
    expect(CANDIDATE_PAIRING_COMMANDS.length).toBeGreaterThanOrEqual(4);
    for (const cmd of CANDIDATE_PAIRING_COMMANDS) {
      expect(cmd.isVerified).toBe(false);
      expect(cmd.payload.length).toBeGreaterThan(0);
      expect(cmd.serviceUuid).toBeTruthy();
      expect(cmd.characteristicUuid).toBeTruthy();
    }
  });

  it('findMatchingPairingPipe correctly discovers writable command pipes', () => {
    const mockServices: GattServiceInfo[] = [
      {
        uuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
        normalizedUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
        name: 'Vendor Primary Service',
        isStandard: false,
        isPrimary: true,
        characteristics: [
          {
            uuid: '0000ff02-0000-1000-8000-00805f9b34fb',
            normalizedUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
            name: 'Command Pipe',
            isStandard: false,
            serviceUuid: '000001ff-3c17-d293-8e48-14fe2e4da212',
            properties: {
              read: false,
              write: true,
              writeWithoutResponse: true,
              notify: false,
              indicate: false,
            },
          },
        ],
      },
    ];

    const match = findMatchingPairingPipe(mockServices, CANDIDATE_PAIRING_COMMANDS[0]);
    expect(match).not.toBeNull();
    expect(match?.characteristic.uuid).toBe('0000ff02-0000-1000-8000-00805f9b34fb');
  });

  it('renders Pairing Assistant with required safety gating disclosure and 5 buttons', async () => {
    const mockNavigate = () => {};

    await act(async () => {
      render(
        <BluetoothProvider>
          <PairingAssistantPage onNavigate={mockNavigate} />
        </BluetoothProvider>
      );
    });

    // Verify Title
    expect(screen.getByText('DIZO Watch D — Pairing Assistant')).toBeInTheDocument();

    // Verify the mandatory gating disclaimer
    expect(
      screen.getByText(
        /The Bluetooth command for accepting this watch's phone-binding confirmation has not yet been verified/i
      )
    ).toBeInTheDocument();

    // Verify all 5 core buttons exist
    expect(screen.getByText(/Connect to Watch/i)).toBeInTheDocument();
    expect(screen.getByText(/Check Pairing Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Accept on Watch/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel Operation/i)).toBeInTheDocument();
    expect(screen.getByText(/View Diagnostic Log/i)).toBeInTheDocument();
  });

  it('renders Protocol Research Workspace with state comparison workflow', async () => {
    await act(async () => {
      render(
        <BluetoothProvider>
          <ProtocolResearchPage />
        </BluetoothProvider>
      );
    });

    expect(screen.getByText('Protocol Research Workspace')).toBeInTheDocument();
    expect(screen.getByText('Controlled 6-Step State Comparison Workflow')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Initial Baseline')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Single Known Action')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Resulting State')).toBeInTheDocument();
    expect(screen.getByText(/Export Evidence JSON/i)).toBeInTheDocument();
  });
});
