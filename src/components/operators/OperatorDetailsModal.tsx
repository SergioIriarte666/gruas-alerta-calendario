import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Operator } from '@/types';
import {
  User,
  Phone,
  Truck,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { OperatorDocumentsSection } from './OperatorDocumentsSection';

interface OperatorDetailsModalProps {
  operator: (Operator & { services?: any[] }) | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorDetailsModal = ({ operator, isOpen, onClose }: OperatorDetailsModalProps) => {
  if (!operator) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl border-border/70 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader className="-mx-6 -mt-6 border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            {operator.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="mb-4">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          {/* ── Tab Información ── */}
          <TabsContent value="info" className="space-y-4">
            {/* Estado */}
            <div className="flex items-center gap-2">
              <Badge variant={operator.isActive ? 'default' : 'secondary'}>
                {operator.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              {operator.isActive && <CheckCircle className="size-4 text-success" />}
            </div>

            {/* Información de Contacto */}
            <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-info/10 p-1 text-info">
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
            <div className="rounded-lg border border-border border-l-4 border-l-success bg-success/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-success/10 p-1 text-success">
                  <FileText className="size-4" />
                </div>
                Servicios del Día
                <Badge variant="outline">{operator.services?.length || 0}</Badge>
              </h3>

              {operator.services && operator.services.length > 0 ? (
                <div className="space-y-2">
                  {operator.services.slice(0, 5).map((service: any, index: number) => (
                    <div
                      key={service.id || index}
                      className="flex items-center justify-between p-2 bg-background rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="size-3 text-muted-foreground" />
                        <span className="text-sm">
                          Servicio {service.id?.slice(0, 8) || `#${index + 1}`}
                        </span>
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

            {/* Licencias y Exámenes */}
            {(operator.licenseNumber || operator.examExpiry) && (
              <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded bg-warning/10 p-1 text-warning">
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

            {/* Footer */}
            <div className="flex justify-between border-t border-border/70 pt-4 text-sm text-muted-foreground">
              <span>
                Creado: {formatForDisplayWithTime(operator.createdAt)}
                {operator.creatorName && ` por ${operator.creatorName}`}
              </span>
              <span>Actualizado: {formatForDisplayWithTime(operator.updatedAt)}</span>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                className="border-border/70 bg-background/60"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab Documentos ── */}
          <TabsContent value="documents">
            <OperatorDocumentsSection operator={operator} />
            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                className="border-border/70 bg-background/60"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
