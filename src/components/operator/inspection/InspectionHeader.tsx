import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface InspectionHeaderProps {
  onBack: () => void;
}

export const InspectionHeader = ({ onBack }: InspectionHeaderProps) => {
  return (
    <div className="flex items-center gap-3 mb-2">
      <button
        onClick={onBack}
        className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div>
        <h1 className="text-lg font-bold leading-tight text-foreground">Inspección</h1>
        <p className="text-xs text-muted-foreground">Pre-servicio</p>
      </div>
    </div>
  );
};
