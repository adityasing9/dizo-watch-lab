import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

describe('DIZO Watch Lab Application UI', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('dizo_mock_mode', 'true');
  });

  it('renders application header with brand and target', async () => {
    await act(async () => {
      render(<App />);
    });
    const titles = screen.getAllByText('DIZO Watch Lab');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/GATT Research Platform/i)).toBeInTheDocument();
  });

  it('renders navigation tabs and switches to Time Sync Lab', async () => {
    await act(async () => {
      render(<App />);
    });

    const timeSyncNavBtn = screen.getAllByText('Time Sync Lab')[0];
    await act(async () => {
      fireEvent.click(timeSyncNavBtn);
    });

    expect(
      screen.getByText(/Section A: Reference Host Time/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Section C: Formal Time Synchronization Status/i)
    ).toBeInTheDocument();
  });

  it('displays host system clock information in Time Sync Lab', async () => {
    await act(async () => {
      render(<App />);
    });

    const timeSyncNavBtn = screen.getAllByText('Time Sync Lab')[0];
    await act(async () => {
      fireEvent.click(timeSyncNavBtn);
    });

    expect(screen.getByText('Local Date')).toBeInTheDocument();
    expect(screen.getByText('Local Time')).toBeInTheDocument();
    expect(screen.getByText('Timezone & Offset')).toBeInTheDocument();
  });

  it('navigates to Diagnostic Logs screen and displays export buttons', async () => {
    await act(async () => {
      render(<App />);
    });

    const logsNavBtn = screen.getAllByText('Diagnostic Logs')[0];
    await act(async () => {
      fireEvent.click(logsNavBtn);
    });

    expect(screen.getByText('Diagnostic Event Logging')).toBeInTheDocument();
    expect(screen.getByText('Clear Logs')).toBeInTheDocument();
  });
});
