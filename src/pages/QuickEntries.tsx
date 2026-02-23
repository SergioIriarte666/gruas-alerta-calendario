import React from 'react';
import { PendingEntriesView } from '@/components/quick-entry/PendingEntriesView';

export default function QuickEntries() {
  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-6">
      <PendingEntriesView />
    </div>
  );
}