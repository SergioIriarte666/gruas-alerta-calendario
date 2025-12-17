import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ServiceRateWithRelations } from '@/types/serviceRates';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, ArrowRight, User, Calendar, FileText } from 'lucide-react';

interface ServiceRateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rate: ServiceRateWithRelations | null;
}

export const ServiceRateDetailsModal: React.FC<ServiceRateDetailsModalProps> = ({
  isOpen,
  onClose,
  rate,
}) => {
  if (!rate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalle de Tarifa
            <Badge variant={rate.is_active ? 'default' : 'secondary'}>
              {rate.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <User className="h-4 w-4" />
              Cliente
            </div>
            <p className="font-medium">{rate.client?.name || 'N/A'}</p>
            {rate.client?.department && (
              <p className="text-sm text-muted-foreground">{rate.client.department}</p>
            )}
          </div>

          {/* Tipo de Servicio */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground mb-1">Tipo de Servicio</div>
            {rate.service_type ? (
              <Badge variant="outline">{rate.service_type.name}</Badge>
            ) : (
              <span className="text-muted-foreground">Aplica a todos los tipos</span>
            )}
          </div>

          {/* Ruta */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              Ruta
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{rate.origin}</span>
              {rate.destination && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{rate.destination}</span>
                </>
              )}
            </div>
          </div>

          {/* Valor */}
          <div className="p-4 rounded-lg bg-violet-500/10 text-center">
            <div className="text-sm text-muted-foreground mb-1">Valor del Servicio</div>
            <p className="text-3xl font-bold text-violet-600">
              {formatCurrency(rate.value)}
            </p>
          </div>

          {/* Notas */}
          {rate.notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                Notas
              </div>
              <p className="text-sm">{rate.notes}</p>
            </div>
          )}

          {/* Metadatos */}
          <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Creado: {format(new Date(rate.created_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              {rate.creator && ` por ${rate.creator.email}`}
            </div>
            {rate.updated_at && rate.updated_at !== rate.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Actualizado: {format(new Date(rate.updated_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
