
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
    <Card className="bg-white border border-gray-200 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-3 text-black text-xl">
          <div className="p-2 bg-tms-green/10 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-tms-green" />
          </div>
          <span>Alertas y Recordatorios</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-gray-50 rounded-xl inline-block mb-4">
              <Clock className="w-12 h-12 mx-auto text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg">No hay alertas pendientes</p>
            <p className="text-gray-500 text-sm mt-2">Las alertas aparecerán aquí cuando se programen eventos importantes</p>
          </div>
        ) : (
          events.map((event) => {
            const Icon = getAlertIcon(event.type);
            return (
              <Alert 
                key={event.id} 
                variant={getAlertVariant(event.status)}
                className="bg-gray-50 border-gray-200 p-4"
              >
                <Icon className="h-5 w-5 text-gray-600" />
                <AlertDescription className="text-black ml-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{getAlertTitle(event)}</p>
                      <p className="text-sm text-gray-600">{event.title}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4 font-medium">
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
