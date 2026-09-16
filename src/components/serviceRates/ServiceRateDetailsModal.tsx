import { businessClock } from '@/utils/businessClock';
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
      <DialogContent className="configuration-dialog max-w-md">
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
          <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-info-text">
              <div className="rounded bg-info/10 p-1 text-info">
                <User className="size-3" />
              </div>
              Cliente
            </div>
            <p className="font-medium">{rate.client?.name || 'N/A'}</p>
            {rate.client?.department && (
              <p className="text-sm text-muted-foreground">{rate.client.department}</p>
            )}
          </div>

          {/* Tipo de Servicio */}
          <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-warning-text">
              <div className="rounded bg-warning/10 p-1 text-warning-text">
                <FileText className="size-3" />
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
          <div className="rounded-lg border border-border border-l-4 border-l-success bg-success/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-success-text">
              <div className="rounded bg-success/10 p-1 text-success">
                <MapPin className="size-3" />
              </div>
              Ruta
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{rate.origin}</span>
              {rate.destination && (
                <>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">{rate.destination}</span>
                </>
              )}
            </div>
          </div>

          {/* Valor */}
          <div className="rounded-lg border border-border border-l-4 border-l-primary bg-primary/5 p-4 text-center">
            <div className="mb-1 text-sm font-medium text-primary">Valor del Servicio</div>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(rate.value)}
            </p>
          </div>

          {/* Notas */}
          {rate.notes && (
            <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-info-text">
                <div className="rounded bg-info/10 p-1 text-info">
                  <FileText className="size-3" />
                </div>
                Notas
              </div>
              <p className="text-sm">{rate.notes}</p>
            </div>
          )}

          {/* Metadatos */}
          <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="size-3" />
              Creado: {businessClock.format(rate.created_at, "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              {rate.creator && ` por ${rate.creator.email}`}
            </div>
            {rate.updated_at && rate.updated_at !== rate.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="size-3" />
                Actualizado: {businessClock.format(rate.updated_at, "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
