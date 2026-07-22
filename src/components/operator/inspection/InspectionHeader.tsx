import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface InspectionHeaderProps {
  onBack: () => void;
  folio?: string;
  phase?: 'initial' | 'final';
}

export const InspectionHeader = ({ onBack, folio, phase = 'initial' }: InspectionHeaderProps) => {
  return (
    <div className="operator-inspection-header -mx-4 flex items-center gap-3 px-4 py-3">
      <button
        onClick={onBack}
        aria-label="Volver a servicios"
        className="operator-native-icon-button flex size-11 flex-shrink-0 items-center justify-center text-foreground active:scale-95"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="operator-native-eyebrow">{phase === 'final' ? 'Cierre de servicio' : 'Control pre-servicio'}</p>
        <h1 className="truncate text-lg font-bold leading-tight text-foreground">Inspección {folio ? `· ${folio}` : ''}</h1>
      </div>
      <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
        {phase === 'final' ? 'Entrega' : 'Inicial'}
      </span>
    </div>
  );
};
