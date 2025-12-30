import React from 'react';
import { InstallPrompt } from './InstallPrompt';
import { ConnectionStatus } from './ConnectionStatus';
import { SyncIndicator } from './SyncIndicator';
import { useOfflinePreload } from '@/hooks/useOfflinePreload';

interface PWAWrapperProps {
  children: React.ReactNode;
}

export const PWAWrapper: React.FC<PWAWrapperProps> = ({ children }) => {
  // Pre-cargar datos esenciales para uso offline
  useOfflinePreload();

  return (
    <>
      {children}
      <InstallPrompt />
      <ConnectionStatus />
      <SyncIndicator />
    </>
  );
};
