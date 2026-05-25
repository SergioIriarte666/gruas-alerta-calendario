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
            <User className="size-5" />
            {operator.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <Badge variant={operator.isActive ? "default" : "secondary"}>
              {operator.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            {operator.isActive && <CheckCircle className="size-4 text-green-500" />}
          </div>

          {/* Información de Contacto */}
          <div className="rounded-lg border border-border border-l-4 border-l-blue-500 bg-blue-500/5 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <div className="p-1 rounded bg-blue-500/10 text-blue-600">
                <Phone className="size-4" />
              </div>
              Información de Contacto
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {operator.phone && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Teléfono</span>
                  <p className="text-sm font-medium">{operator.phone}</p>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">RUT</span>
                <p className="text-sm font-medium">{operator.rut}</p>
              </div>
            </div>
          </div>

          {/* Servicios del Día */}
          <div className="rounded-lg border border-border border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                <FileText className="size-4" />
              </div>
              Servicios del Día
              <Badge variant="outline">{operator.services?.length || 0}</Badge>
            </h3>
            
            {operator.services && operator.services.length > 0 ? (
              <div className="space-y-2">
                {operator.services.slice(0, 5).map((service: any, index: number) => (
                  <div key={service.id || index} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <Truck className="size-3 text-muted-foreground" />
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
          {(operator.licenseNumber || operator.examExpiry) && (
            <div className="rounded-lg border border-border border-l-4 border-l-amber-500 bg-amber-500/5 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <div className="p-1 rounded bg-amber-500/10 text-amber-600">
                  <FileText className="size-4" />
                </div>
                Licencias y Exámenes
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {operator.licenseNumber && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Número de Licencia</span>
                    <p className="text-sm font-medium">{operator.licenseNumber}</p>
                  </div>
                )}
                {operator.examExpiry && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Vencimiento Examen</span>
                    <p className="text-sm font-medium">{operator.examExpiry}</p>
                  </div>
                )}
              </div>
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
