import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Operator } from '@/types';
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
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

interface OperatorDetailsModalProps {
  operator: (Operator & { services?: any[] }) | null;
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
            <Badge variant={operator.isActive ? "default" : "secondary"}>
              {operator.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            {operator.isActive && <CheckCircle className="w-4 h-4 text-green-500" />}
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

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">RUT</span>
              </div>
              <p className="text-sm">{operator.rut}</p>
            </div>
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
          {operator.licenseNumber && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Número de Licencia</span>
              </div>
              <p className="text-sm">{operator.licenseNumber}</p>
            </div>
          )}

          {/* Vencimiento de Examen */}
          {operator.examExpiry && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Vencimiento Examen</span>
              </div>
              <p className="text-sm">{operator.examExpiry}</p>
            </div>
          )}

          {/* Footer con información de creación */}
          <div className="flex justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>
              Creado: {formatForDisplayWithTime(operator.createdAt)}
              {operator.creatorName && ` por ${operator.creatorName}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(operator.updatedAt)}</span>
          </div>

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