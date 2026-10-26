import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../../context/BluetoothContext';
import { Badge } from '../common/Badge';
import {
  Watch,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Menu,
  Clock,
  Sparkles,
  RefreshCw,
  Power,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  onNavigate: (tabId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { status, device, isMockMode, setMockMode, disconnect } = useBluetooth();
  const [localTime, setLocalTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setLocalTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="success" dot>
            CONNECTED
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="warning" dot>
            CONNECTING...
          </Badge>
        );
      case 'disconnecting':
        return (
          <Badge variant="warning" dot>
            DISCONNECTING...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" dot>
            ERROR
          </Badge>
        );
      case 'disconnected':
      default:
        return (
          <Badge variant="neutral" dot>
            DISCONNECTED
          </Badge>
        );
    }
  };

  return (
    <header className="h-14 sm:h-16 border-b border-lab-border bg-lab-surface/95 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
            <Watch className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-slate-100 text-sm sm:text-base">DIZO Watch Lab</span>
              <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1 py-0.2 rounded hidden xs:inline">
                v1.0
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono hidden md:block">
              DIZO Watch D • Protocol Diagnostic & Time Sync
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Clock display */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono text-slate-300 bg-lab-card/80 border border-lab-border px-3 py-1.5 rounded-md">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{localTime.toLocaleTimeString()}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{localTime.toLocaleDateString()}</span>
        </div>

        {/* Device Status & Identifier */}
        <div className="flex items-center gap-2">
          {getStatusBadge()}

          {device && device.connected && (
            <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-700/70 px-2.5 py-1 rounded">
              <BluetoothConnected className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-200 font-medium">{device.name || 'DIZO Watch D'}</span>
              <span className="text-slate-500 text-[10px]">({device.id.substring(0, 8)}...)</span>
            </div>
          )}
        </div>

        {/* Mock mode toggle - hidden on mobile unless mock mode is active */}
        <div className={`items-center gap-1.5 bg-lab-card border border-lab-border px-2 py-1 rounded-md text-xs font-mono ${isMockMode ? 'flex' : 'hidden sm:flex'}`}>
          <span className="text-[10px] text-slate-400 uppercase hidden sm:inline">Mode:</span>
          <button
            onClick={() => setMockMode(!isMockMode)}
            className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors ${
              isMockMode
                ? 'bg-amber-600/80 text-amber-100 border border-amber-500'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle between Live Web Bluetooth and offline simulated test mode"
          >
            {isMockMode ? 'MOCK' : 'LIVE'}
          </button>
        </div>

        {/* Action Button */}
        {status === 'connected' ? (
          <button
            onClick={() => disconnect()}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-200 text-xs font-mono transition-colors"
            title="Disconnect current GATT session"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('connection')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-medium transition-colors shadow-sm"
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Connect</span>
          </button>
        )}
      </div>
    </header>
  );
};
