import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User,
  Phone,
  Mail,
  Calendar,
  Truck,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react';

interface OperatorDetailsModalProps {
  operator: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorDetailsModal = ({ operator, isOpen, onClose }: OperatorDetailsModalProps) => {
  if (!operator) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {operator.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <Badge variant="default">Asignado</Badge>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>

          {/* Información de Contacto */}
          <div className="grid grid-cols-2 gap-4">
            {operator.phone && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Teléfono</span>
                </div>
                <p className="text-sm">{operator.phone}</p>
              </div>
            )}

            {operator.email && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Email</span>
                </div>
                <p className="text-sm">{operator.email}</p>
              </div>
            )}
          </div>

          {/* Servicios del Día */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Servicios del Día</span>
              <Badge variant="outline">{operator.services?.length || 0}</Badge>
            </div>
            
            {operator.services && operator.services.length > 0 ? (
              <div className="space-y-2">
                {operator.services.slice(0, 5).map((service: any, index: number) => (
                  <div key={service.id || index} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <Truck className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">Servicio {service.id?.slice(0, 8) || `#${index + 1}`}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {service.status || 'Programado'}
                    </Badge>
                  </div>
                ))}
                {operator.services.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    y {operator.services.length - 5} servicios más...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay servicios asignados para hoy</p>
            )}
          </div>

          {/* Información de Licencias */}
          {operator.license_type && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Tipo de Licencia</span>
              </div>
              <p className="text-sm">{operator.license_type}</p>
            </div>
          )}

          {/* Experiencia */}
          {operator.experience_years && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Experiencia</span>
              </div>
              <p className="text-sm">{operator.experience_years} años</p>
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