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
        className="size-9 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all flex-shrink-0"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div>
        <h1 className="text-lg font-bold text-white leading-tight">Inspección</h1>
        <p className="text-xs text-zinc-500">Pre-servicio</p>
      </div>
    </div>
  );
};
