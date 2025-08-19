
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface InspectionHeaderProps {
  onBack: () => void;
}

export const InspectionHeader = ({ onBack }: InspectionHeaderProps) => {
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft />
      </Button>
      <h1 className="text-2xl font-bold">Inspección Pre-Servicio</h1>
    </div>
  );
};
