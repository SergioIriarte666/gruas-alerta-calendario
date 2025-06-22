
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarEvent } from '@/types';
import { AlertTriangle, Clock, FileText, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlertsPanelProps {
  events: CalendarEvent[];
}

export const AlertsPanel = ({ events }: AlertsPanelProps) => {
  const getAlertIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'document_expiry':
        return FileText;
      case 'invoice_due':
        return DollarSign;
      case 'service':
        return Clock;
      default:
        return AlertTriangle;
    }
  };

  const getAlertVariant = (status: CalendarEvent['status']) => {
    switch (status) {
      case 'urgent':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAlertTitle = (event: CalendarEvent) => {
    switch (event.type) {
      case 'document_expiry':
        return '📄 Documento por vencer';
      case 'invoice_due':
        return '💰 Factura vencida';
      case 'service':
        return '🚛 Servicio programado';
      default:
        return '⚠️ Alerta';
    }
  };

  return (
    <Card className="bg-white border border-gray-200" style={{ background: '#ffffff', color: '#000000' }}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-black">
          <AlertTriangle className="w-5 h-5 text-tms-green" />
          <span>Alertas y Recordatorios</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay alertas pendientes</p>
            <p className="text-sm mt-2">Las alertas aparecerán aquí cuando se programen eventos importantes</p>
          </div>
        ) : (
          events.map((event) => {
            const Icon = getAlertIcon(event.type);
            return (
              <Alert 
                key={event.id} 
                variant={getAlertVariant(event.status)}
                className="bg-gray-50 border-gray-200"
              >
                <Icon className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-black">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{getAlertTitle(event)}</p>
                      <p className="text-sm text-gray-600 mt-1">{event.title}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {format(new Date(event.date), 'dd MMM', { locale: es })}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
