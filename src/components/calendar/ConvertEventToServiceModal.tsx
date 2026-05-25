import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/types/calendar';
import { ArrowRight, Calendar, Clock, User, Truck } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { EnhancedServiceForm } from '@/components/services/EnhancedServiceForm';
import { Service } from '@/types';
import { ServiceFormData, ServiceOperator } from '@/types/serviceDetails';
import { useServiceManager } from '@/hooks/services/useServiceManager';
import { formatForDatabase, getCurrentChileDate, getCurrentChileDateString } from '@/utils/timezoneUtils';

interface ConvertEventToServiceModalProps {
  event: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdate: (eventId: string, updates: Partial<CalendarEvent>) => void;
}

export const ConvertEventToServiceModal = ({ 
  event, 
  open, 
  onOpenChange,
  onEventUpdate 
}: ConvertEventToServiceModalProps) => {
  const { toast } = useToast();
  const { createService, isCreating } = useServiceManager();
  const [showServiceForm, setShowServiceForm] = useState(false);

  // Prepare prefilled data from event
  const currentDateString = getCurrentChileDateString();
  const prefilledData = {
    requestDate: currentDateString,
    serviceDate: currentDateString,
    client: event.clientId || '',
    crane: event.craneId || '',
    operators: event.operatorId ? [{
      id: crypto.randomUUID(),
      operatorId: event.operatorId,
      commission: 0,
      role: 'Principal',
      hours: 8
    }] : [],
    observations: event.description || '',
    value: 0,
    costDetails: [],
    hasExcess: false,
    status: 'pending' as const,
    // Required fields with defaults
    folio: '',
    serviceType: '',
    vehicleBrand: '',
    vehicleModel: '',
    licensePlate: '',
    origin: '',
    destination: ''
  };

  const handleServiceSubmit = async (serviceData: any) => {
    try {
      console.log('[ConvertEventToServiceModal] Creating service from calendar event:', {
        eventId: event.id,
        serviceData
      });

      await createService(serviceData);

      // Update event to mark it as converted
      onEventUpdate(event.id, { 
        status: 'completed',
        description: `${event.description || ''}\n[Convertido a servicio]`.trim()
      });

      onOpenChange(false);

      toast({
        type: 'success',
        title: 'Evento convertido',
        description: 'El evento se ha convertido exitosamente a servicio.'
      });
    } catch (error) {
      console.error('[ConvertEventToServiceModal] Error creating service:', error);
      toast({
        type: 'error',
        title: 'Error',
        description: 'Error al convertir el evento a servicio.'
      });
    }
  };

  const handleShowForm = () => {
    setShowServiceForm(true);
  };

  if (showServiceForm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] bg-background border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="size-5 text-primary" />
              <ArrowRight className="size-4 text-muted-foreground" />
              <Truck className="size-5 text-primary" />
              <span>Convertir Evento a Servicio</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <EnhancedServiceForm
              prefilledData={prefilledData}
              onSubmit={handleServiceSubmit}
              onCancel={() => setShowServiceForm(false)}
              fromCalendarEvent={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-background border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="size-5 text-primary" />
            <ArrowRight className="size-4 text-muted-foreground" />
            <Truck className="size-5 text-primary" />
            <span>Convertir Evento a Servicio</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Preview */}
          <div className="p-4 bg-muted rounded-lg border">
            <h3 className="font-medium mb-3 flex items-center">
              <Calendar className="size-4 mr-2 text-primary" />
              Datos del Evento
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Título:</span>
                <p className="font-medium">{event.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha:</span>
                <p className="font-medium">{event.date}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Horario:</span>
                <p className="font-medium flex items-center">
                  <Clock className="size-3 mr-1" />
                  {event.startTime} - {event.endTime}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">{event.type}</p>
              </div>
            </div>
            {event.description && (
              <div className="mt-3">
                <span className="text-muted-foreground">Descripción:</span>
                <p className="font-medium">{event.description}</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Este evento se convertirá en un servicio. Podrás completar todos los detalles en el formulario de servicios.
            </p>
            
            <div className="flex justify-center space-x-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleShowForm}
                className="bg-primary hover:bg-primary/90"
              >
                <ArrowRight className="size-4 mr-2" />
                Convertir a Servicio
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};