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
      case 'maintenance':
        return Wrench;
      case 'meeting':
        return Users;
      case 'inspection':
        return CheckSquare;
      default:
        return Calendar;
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'maintenance':
        return 'Mantenimiento';
      case 'meeting':
        return 'Reunión';
      case 'inspection':
        return 'Inspección';
      default:
        return 'Evento';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'pending':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Progreso';
      case 'pending':
        return 'Pendiente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const IconComponent = getEventIcon(event.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5" />
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tipo y Estado */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{getEventTypeName(event.type)}</Badge>
            <Badge variant={getStatusBadgeVariant(event.status)}>
              {getStatusText(event.status)}
            </Badge>
          </div>

          {/* Información Básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Fecha</span>
              </div>
              <p className="text-sm">{event.date}</p>
            </div>

            {event.time && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Hora</span>
                </div>
                <p className="text-sm">{event.time}</p>
              </div>
            )}
          </div>

          {/* Participantes */}
          <div className="grid grid-cols-2 gap-4">
            {event.client && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Cliente</span>
                </div>
                <p className="text-sm">{event.client}</p>
              </div>
            )}

            {event.operator && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Operador</span>
                </div>
                <p className="text-sm">{event.operator}</p>
              </div>
            )}
          </div>

          {/* Información del Equipo */}
          {event.crane && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Información del Equipo</span>
              </div>
              <p className="text-sm">{event.crane}</p>
            </div>
          )}

          {/* Ubicación */}
          {event.location && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Ubicación</span>
              </div>
              <p className="text-sm">{event.location}</p>
            </div>
          )}

          {/* Descripción */}
          {event.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Descripción</span>
              </div>
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