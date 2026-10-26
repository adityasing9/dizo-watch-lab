import React, { useState, useEffect } from 'react';
import { BluetoothProvider } from './context/BluetoothContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceConnectionPage } from './pages/DeviceConnectionPage';
import { GattExplorerPage } from './pages/GattExplorerPage';
import { DataInspectorPage } from './pages/DataInspectorPage';
import { CommandLabPage } from './pages/CommandLabPage';
import { TimeSyncPage } from './pages/TimeSyncPage';
import { DiagnosticLogsPage } from './pages/DiagnosticLogsPage';
import { SettingsHelpPage } from './pages/SettingsHelpPage';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('dizo_active_tab') || 'dashboard';
  });

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem('dizo_active_tab', tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'connection':
        return <DeviceConnectionPage onNavigate={handleNavigate} />;
      case 'gatt':
        return <GattExplorerPage onNavigate={handleNavigate} />;
      case 'inspector':
        return <DataInspectorPage />;
      case 'command-lab':
        return <CommandLabPage />;
      case 'time-sync':
        return <TimeSyncPage onNavigate={handleNavigate} />;
      case 'logs':
        return <DiagnosticLogsPage />;
      case 'settings':
        return <SettingsHelpPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onNavigate={handleNavigate}>
      {renderActiveTab()}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <BluetoothProvider>
      <AppContent />
    </BluetoothProvider>
  );
};

export default App;
