
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-tms">
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
    </div>
  );
};
