import React, { useState, useEffect } from 'react';
import { BluetoothProvider } from './context/BluetoothContext';
import { AppLayout } from './components/layout/AppLayout';
import { SimpleWatchLabPage } from './pages/SimpleWatchLabPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceConnectionPage } from './pages/DeviceConnectionPage';
import { GattExplorerPage } from './pages/GattExplorerPage';
import { DataInspectorPage } from './pages/DataInspectorPage';
import { CommandLabPage } from './pages/CommandLabPage';
import { TimeSyncPage } from './pages/TimeSyncPage';
import { DiagnosticLogsPage } from './pages/DiagnosticLogsPage';
import { SettingsHelpPage } from './pages/SettingsHelpPage';

export const AppContent: React.FC = () => {
  const [appMode, setAppMode] = useState<'simple' | 'advanced'>(() => {
    return (localStorage.getItem('dizo_app_mode') as 'simple' | 'advanced') || 'simple';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('dizo_active_tab') || 'dashboard';
  });

  const handleSetMode = (mode: 'simple' | 'advanced') => {
    setAppMode(mode);
    localStorage.setItem('dizo_app_mode', mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem('dizo_active_tab', tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (appMode === 'simple') {
    return (
      <div className="min-h-screen bg-lab-bg text-lab-text p-4 sm:p-6 flex flex-col justify-between">
        <SimpleWatchLabPage onSwitchToAdvanced={() => handleSetMode('advanced')} />
      </div>
    );
  }

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
    <AppLayout
      activeTab={activeTab}
      onNavigate={handleNavigate}
      onSwitchToSimple={() => handleSetMode('simple')}
    >
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
