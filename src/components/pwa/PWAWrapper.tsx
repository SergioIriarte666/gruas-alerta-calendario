
import React from 'react';
import { Connection Status } from './ConnectionStatus';
import { InstallPrompt } from './InstallPrompt';
import { SyncIndicator } from './SyncIndicator';
import { UpdateNotification } from './UpdateNotification';
import { useUser } from '@/contexts/UserContext';

interface PWAWrapperProps {
  children: React.ReactNode;
}

export const PWAWrapper: React.FC<PWAWrapperProps> = ({ children }) => {
  const { user } = useUser();

  return (
    <>
      {children}
      <ConnectionStatus />
      <InstallPrompt userRole={user?.role} />
      <SyncIndicator />
      <UpdateNotification />
    </>
  );
};
