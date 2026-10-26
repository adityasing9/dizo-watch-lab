import React from 'react';
import { useBluetooth } from '../../context/BluetoothContext';
import {
  LayoutDashboard,
  Bluetooth,
  KeyRound,
  Binary,
  ScrollText,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tabId: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onNavigate }) => {
  const { status } = useBluetooth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'connect',
      label: 'Connect',
      icon: Bluetooth,
      dot: status === 'connected',
      dotColor: 'bg-emerald-400',
    },
    {
      id: 'pairing',
      label: 'Recovery',
      icon: KeyRound,
      highlight: true,
      dot: status === 'connected',
      dotColor: 'bg-yellow-400',
    },
    {
      id: 'gatt',
      label: 'GATT',
      icon: Binary,
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: ScrollText,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-lab-surface/95 backdrop-blur-md border-t border-lab-border lg:hidden px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'connect' && activeTab === 'connection');

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center -mt-4 group relative"
                aria-label={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-yellow-400 text-slate-950 shadow-yellow-400/40 ring-2 ring-yellow-300'
                      : 'bg-gradient-to-tr from-yellow-500 to-yellow-400 text-slate-950 hover:brightness-110 shadow-yellow-900/40'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span
                  className={`text-[10px] font-mono mt-1 font-bold ${
                    isActive ? 'text-yellow-400' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
                {item.dot && (
                  <span
                    className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-lab-surface ${item.dotColor}`}
                  />
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors relative min-w-[56px] active:bg-slate-800/40 ${
                isActive ? 'text-yellow-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-400' : 'text-slate-400'}`} />
                {item.dot && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-lab-surface ${item.dotColor}`}
                  />
                )}
              </div>
              <span className={`text-[10px] font-mono mt-1 ${isActive ? 'font-bold text-yellow-300' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
