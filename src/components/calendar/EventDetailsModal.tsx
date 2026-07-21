import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar,
  User,
  MapPin,
  FileText,
  Wrench,
  Users,
  CheckSquare
} from 'lucide-react';

interface EventDetailsModalProps {
  event: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EventDetailsModal = ({ event, isOpen, onClose }: EventDetailsModalProps) => {
  if (!event) return null;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return Wrench;
      case 'meeting': return Users;
      case 'inspection': return CheckSquare;
      default: return Calendar;
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'maintenance': return 'Mantenimiento';
      case 'meeting': return 'Reunión';
      case 'inspection': return 'Inspección';
      default: return 'Evento';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default' as const;
      case 'in_progress': return 'secondary' as const;
      case 'pending': return 'outline' as const;
      case 'cancelled': return 'destructive' as const;
      default: return 'outline' as const;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'in_progress': return 'En Progreso';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const IconComponent = getEventIcon(event.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="operations-dialog max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconComponent className="size-5" />
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo y Estado */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{getEventTypeName(event.type)}</Badge>
            <Badge variant={getStatusBadgeVariant(event.status)}>
              {getStatusText(event.status)}
            </Badge>
          </div>

          {/* Información Básica */}
          <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-info-text">
              <div className="rounded bg-info/10 p-1 text-info">
                <Calendar className="size-4" />
              </div>
              Información Básica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Fecha</span>
                <p className="text-sm font-medium">{event.date}</p>
              </div>
              {event.time && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Hora</span>
                  <p className="text-sm font-medium">{event.time}</p>
                </div>
              )}
            </div>
          </div>

          {/* Participantes */}
          {(event.client || event.operator) && (
            <div className="rounded-lg border border-border border-l-4 border-l-success bg-success/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-success-text">
                <div className="rounded bg-success/10 p-1 text-success">
                  <User className="size-4" />
                </div>
                Participantes
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {event.client && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Cliente</span>
                    <p className="text-sm font-medium">{event.client}</p>
                  </div>
                )}
                {event.operator && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Operador</span>
                    <p className="text-sm font-medium">{event.operator}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información del Equipo */}
          {event.crane && (
            <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning-text">
                <div className="rounded bg-warning/10 p-1 text-warning-text">
                  <Wrench className="size-4" />
                </div>
                Información del Equipo
              </h3>
              <p className="text-sm">{event.crane}</p>
            </div>
          )}

          {/* Ubicación */}
          {event.location && (
            <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-info-text">
                <div className="rounded bg-info/10 p-1 text-info">
                  <MapPin className="size-4" />
                </div>
                Ubicación
              </h3>
              <p className="text-sm">{event.location}</p>
            </div>
          )}

          {/* Descripción */}
          {event.description && (
            <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning-text">
                <div className="rounded bg-warning/10 p-1 text-warning-text">
                  <FileText className="size-4" />
                </div>
                Descripción
              </h3>
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
