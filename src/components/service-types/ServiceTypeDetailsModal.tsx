
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ServiceTypeConfig } from '@/types/serviceTypes';
import { Check, X } from 'lucide-react';

interface ServiceTypeDetailsModalProps {
  serviceType: ServiceTypeConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceTypeDetailsModal = ({ serviceType, isOpen, onClose }: ServiceTypeDetailsModalProps) => {
  if (!serviceType) return null;

  const formatPrice = (price?: number) => {
    if (!price) return 'No definido';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const RequirementRow = ({ label, required }: { label: string; required: boolean }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        {required ? (
          <>
            <Check className="h-4 w-4 text-green-400" />
            <Badge variant="default" className="bg-green-600">Requerido</Badge>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-gray-500" />
            <Badge variant="secondary">Opcional</Badge>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Detalles del Tipo de Servicio</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="bg-gray-700 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                {serviceType.name}
                <Badge variant={serviceType.isActive ? "default" : "secondary"}>
                  {serviceType.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Descripción</p>
                <p className="text-gray-200">{serviceType.description || 'Sin descripción'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Precio Base</p>
                  <p className="text-gray-200 font-medium">{formatPrice(serviceType.basePrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Info. Vehículo Opcional (Legacy)</p>
                  <Badge variant={serviceType.vehicleInfoOptional ? "secondary" : "outline"}>
                    {serviceType.vehicleInfoOptional ? 'Sí' : 'No'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Creado</p>
                  <p className="text-gray-200">{formatDate(serviceType.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Actualizado</p>
                  <p className="text-gray-200">{formatDate(serviceType.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-700 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">Configuración de Campos</CardTitle>
              <p className="text-sm text-gray-400">
                Campos que serán requeridos en el formulario de servicios
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <RequirementRow label="Orden de Compra" required={serviceType.purchaseOrderRequired} />
                <RequirementRow label="Origen" required={serviceType.originRequired} />
                <RequirementRow label="Destino" required={serviceType.destinationRequired} />
                <RequirementRow label="Grúa" required={serviceType.craneRequired} />
                <RequirementRow label="Operador" required={serviceType.operatorRequired} />
                
                <Separator className="bg-gray-600 my-3" />
                
                <div className="text-sm font-medium text-gray-300 mb-2">Información del Vehículo</div>
                <RequirementRow label="Marca del Vehículo" required={serviceType.vehicleBrandRequired} />
                <RequirementRow label="Modelo del Vehículo" required={serviceType.vehicleModelRequired} />
                <RequirementRow label="Patente" required={serviceType.licensePlateRequired} />
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
