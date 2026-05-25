
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface InspectionLoadingStateProps {
  serviceId: string;
  onBack: () => void;
}

export const InspectionLoadingState = ({ serviceId, onBack }: InspectionLoadingStateProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Inspección Pre-Servicio</h1>
      </div>
      <div className="text-center p-8">
        <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-foreground">Cargando servicio...</p>
        <p className="text-sm text-muted-foreground mt-2">ID: {serviceId}</p>
      </div>
    </div>
  );
};
