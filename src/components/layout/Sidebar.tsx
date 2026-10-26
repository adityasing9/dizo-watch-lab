import React from 'react';
import { useBluetooth } from '../../context/BluetoothContext';
import {
  LayoutDashboard,
  Bluetooth,
  Binary,
  KeyRound,
  Bell,
  FlaskConical,
  Clock,
  ScrollText,
  Settings,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tabId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onNavigate, isOpen, onClose }) => {
  const { status, services, notifications, experiments, timeSyncStatus } = useBluetooth();

  const totalChars = services.reduce((acc, s) => acc + s.characteristics.length, 0);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: status === 'connected' ? 'LIVE' : undefined,
      badgeColor: 'text-emerald-400 bg-emerald-950 border-emerald-800',
    },
    {
      id: 'connect',
      label: 'Connect',
      icon: Bluetooth,
      badge: status === 'connected' ? '1 Device' : undefined,
    },
    {
      id: 'gatt',
      label: 'GATT Explorer',
      icon: Binary,
      badge: services.length > 0 ? `${services.length} Srv / ${totalChars} Chr` : undefined,
    },
    {
      id: 'pairing',
      label: 'Pairing Assistant',
      icon: KeyRound,
      highlight: true,
      badge: 'PRIORITY',
      badgeColor: 'text-yellow-400 bg-yellow-950 border-yellow-700 font-bold',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: notifications.length > 0 ? `${notifications.length}` : undefined,
    },
    {
      id: 'protocol-research',
      label: 'Protocol Research',
      icon: FlaskConical,
      badge: experiments.length > 0 ? `${experiments.length} exp` : undefined,
    },
    {
      id: 'time-sync',
      label: 'Time Sync Lab',
      icon: Clock,
      badge: timeSyncStatus === 'TIME_SYNC_VERIFIED' ? 'VERIFIED' : undefined,
      badgeColor: 'text-emerald-400 bg-emerald-950 border-emerald-800',
    },
    {
      id: 'logs',
      label: 'Diagnostic Logs',
      icon: ScrollText,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-lab-surface border-r border-lab-border flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-4rem)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 border-b border-lab-border lg:hidden">
          <span className="font-semibold text-slate-200">Navigation</span>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section title */}
        <div className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold border-b border-lab-border/50">
          DIZO Diagnostic Suite
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono transition-colors text-left group ${
                  isActive
                    ? 'bg-lab-card text-yellow-300 font-bold border border-yellow-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-lab-card/60'
                } ${item.highlight && !isActive ? 'border-l-2 border-l-yellow-400 pl-2.5' : ''}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-yellow-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        item.badgeColor || 'text-slate-400 bg-slate-900 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info panel */}
        <div className="p-4 border-t border-lab-border bg-lab-card/30 text-[11px] font-mono text-slate-400 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span>BLE Core Target:</span>
            <span className="text-yellow-400 font-bold">DIZO Watch D</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400/90 text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Safe Diagnostic Mode (No arbitrary writes)</span>
          </div>
        </div>
      </aside>
    </>
  );
};
