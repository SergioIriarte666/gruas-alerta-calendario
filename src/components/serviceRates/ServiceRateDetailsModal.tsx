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
          <div className="rounded-lg border border-border border-l-4 border-l-blue-500 bg-blue-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
              <div className="p-1 rounded bg-blue-500/10 text-blue-600">
                <User className="h-3 w-3" />
              </div>
              Cliente
            </div>
            <p className="font-medium">{rate.client?.name || 'N/A'}</p>
            {rate.client?.department && (
              <p className="text-sm text-muted-foreground">{rate.client.department}</p>
            )}
          </div>

          {/* Tipo de Servicio */}
          <div className="rounded-lg border border-border border-l-4 border-l-orange-500 bg-orange-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 font-medium mb-1">
              <div className="p-1 rounded bg-orange-500/10 text-orange-600">
                <FileText className="h-3 w-3" />
              </div>
              Tipo de Servicio
            </div>
            {rate.service_type ? (
              <Badge variant="outline">{rate.service_type.name}</Badge>
            ) : (
              <span className="text-muted-foreground">Aplica a todos los tipos</span>
            )}
          </div>

          {/* Ruta */}
          <div className="rounded-lg border border-border border-l-4 border-l-emerald-500 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-medium mb-1">
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                <MapPin className="h-3 w-3" />
              </div>
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
          <div className="rounded-lg border border-border border-l-4 border-l-violet-500 bg-violet-500/5 p-4 text-center">
            <div className="text-sm text-violet-700 dark:text-violet-300 font-medium mb-1">Valor del Servicio</div>
            <p className="text-3xl font-bold text-violet-600">
              {formatCurrency(rate.value)}
            </p>
          </div>

          {/* Notas */}
          {rate.notes && (
            <div className="rounded-lg border border-border border-l-4 border-l-cyan-500 bg-cyan-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-cyan-700 dark:text-cyan-300 font-medium mb-1">
                <div className="p-1 rounded bg-cyan-500/10 text-cyan-600">
                  <FileText className="h-3 w-3" />
                </div>
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
