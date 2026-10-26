import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { CapabilityBanner } from '../common/CapabilityBanner';

interface AppLayoutProps {
  activeTab: string;
  onNavigate: (tabId: string) => void;
  onSwitchToSimple?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ activeTab, onNavigate, onSwitchToSimple, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-lab-bg text-lab-text">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onNavigate={onNavigate}
        onSwitchToSimple={onSwitchToSimple}
      />
      <CapabilityBanner />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onNavigate={onNavigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onNavigate={onNavigate} />
    </div>
  );
};
