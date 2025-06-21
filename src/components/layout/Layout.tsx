
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ConnectionStatus } from '@/components/shared/ConnectionStatus';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, rgba(109,168,19,0.1) 100%)'
    }}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      
      {/* Main Content */}
      <div className={cn(
        "transition-[padding-left] duration-300 ease-in-out",
        isSidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
      
      {/* Connection Status Indicator */}
      <ConnectionStatus />
    </div>
  );
};
