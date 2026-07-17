import React from 'react';
import { PendingEntriesView } from '@/components/quick-entry/PendingEntriesView';
import { Zap } from 'lucide-react';

export default function QuickEntries() {
  return (
    <div className="quick-entries-concept space-y-6 pb-6">
      <div>
        <span className="dashboard-section-kicker"><Zap className="size-3.5" />Bandeja de captura</span>
        <h1 className="dashboard-section-title">Registros Rápidos</h1>
        <p className="dashboard-section-description">Entradas pendientes de completar y derivar al módulo correspondiente.</p>
      </div>
      <PendingEntriesView />
    </div>
  );
}
