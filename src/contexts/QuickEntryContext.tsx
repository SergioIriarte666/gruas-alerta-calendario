import React, { createContext, useContext, useState, ReactNode } from 'react';

interface QuickEntryContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const QuickEntryContext = createContext<QuickEntryContextType | undefined>(undefined);

export function QuickEntryProvider({ children }: { children: ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <QuickEntryContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      {children}
    </QuickEntryContext.Provider>
  );
}

export function useQuickEntryContext() {
  const context = useContext(QuickEntryContext);
  if (context === undefined) {
    throw new Error('useQuickEntryContext must be used within a QuickEntryProvider');
  }
  return context;
}