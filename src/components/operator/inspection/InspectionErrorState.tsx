
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
        <h1 className="text-2xl font-bold">Inspección Pre-Servicio</h1>
      </div>
      
      <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold mb-2 text-red-800">Error al cargar el servicio</h2>
        <p className="text-red-600 mb-4">
          {error?.message || 'No se pudo cargar la información del servicio.'}
        </p>
        <div className="bg-red-100 p-3 rounded mb-6">
          <p className="text-sm text-red-700 font-mono">
            ID del servicio: {serviceId}
          </p>
          <p className="text-sm text-red-700 font-mono">
            URL: {window.location.pathname}
          </p>
        </div>
        <div className="space-x-4">
          <Button onClick={onRetry} className="bg-red-600 hover:bg-red-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
