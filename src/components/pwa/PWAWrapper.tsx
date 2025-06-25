
import React from 'react';
import { InstallPrompt } from './InstallPrompt';
import { ConnectionStatus } from './ConnectionStatus';
import { SyncIndicator } from './SyncIndicator';

interface PWAWrapperProps {
  children: React.ReactNode;
}

export const PWAWrapper: React.FC<PWAWrapperProps> = ({ children }) => {
  return (
    <>
      {children}
      <InstallPrompt />
      <ConnectionStatus />
      <SyncIndicator />
    </>
  );
};
