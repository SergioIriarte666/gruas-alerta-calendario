import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar,
  Clock,
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
      <DialogContent className="max-w-2xl">
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
          <div className="rounded-lg border border-border border-l-4 border-l-blue-500 bg-blue-500/5 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <div className="p-1 rounded bg-blue-500/10 text-blue-600">
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
            <div className="rounded-lg border border-border border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <div className="p-1 rounded bg-emerald-500/10 text-emerald-600">
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
            <div className="rounded-lg border border-border border-l-4 border-l-orange-500 bg-orange-500/5 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <div className="p-1 rounded bg-orange-500/10 text-orange-600">
                  <Wrench className="size-4" />
                </div>
                Información del Equipo
              </h3>
              <p className="text-sm">{event.crane}</p>
            </div>
          )}

          {/* Ubicación */}
          {event.location && (
            <div className="rounded-lg border border-border border-l-4 border-l-cyan-500 bg-cyan-500/5 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                <div className="p-1 rounded bg-cyan-500/10 text-cyan-600">
                  <MapPin className="size-4" />
                </div>
                Ubicación
              </h3>
              <p className="text-sm">{event.location}</p>
            </div>
          )}

          {/* Descripción */}
          {event.description && (
            <div className="rounded-lg border border-border border-l-4 border-l-amber-500 bg-amber-500/5 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <div className="p-1 rounded bg-amber-500/10 text-amber-600">
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
