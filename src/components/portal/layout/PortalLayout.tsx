
import React from 'react';
import { Outlet } from 'react-router-dom';
import PortalHeader from './PortalHeader';
import PortalSidebar from './PortalSidebar';

interface PortalLayoutProps {
  children?: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-tms-dark text-white">
      <PortalSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PortalHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-tms-dark p-4 md:p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
