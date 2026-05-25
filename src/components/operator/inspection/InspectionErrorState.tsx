
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface InspectionErrorStateProps {
  error?: Error | null;
  serviceId?: string;
  onRetry: () => void;
  onBack: () => void;
}

export const InspectionErrorState = ({ error, serviceId, onRetry, onBack }: InspectionErrorStateProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Inspección Pre-Servicio</h1>
      </div>
      
      <div className="text-center p-8 bg-destructive/10 rounded-lg border border-destructive/30">
        <AlertTriangle className="size-16 mx-auto mb-4 text-destructive" />
        <h2 className="text-xl font-semibold mb-2 text-destructive">Error al cargar el servicio</h2>
        <p className="text-muted-foreground mb-4">
          {error?.message || 'No se pudo cargar la información del servicio.'}
        </p>
        <div className="bg-muted p-3 rounded mb-6">
          <p className="text-sm text-muted-foreground font-mono">
            ID del servicio: {serviceId}
          </p>
          <p className="text-sm text-muted-foreground font-mono">
            URL: {window.location.pathname}
          </p>
        </div>
        <div className="space-x-4">
          <Button onClick={onRetry} variant="destructive">
            <RefreshCw className="size-4 mr-2" />
            Reintentar
          </Button>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            Volver al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
