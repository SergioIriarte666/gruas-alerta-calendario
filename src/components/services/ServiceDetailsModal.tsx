
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  User, 
  Truck, 
  MapPin, 
  DollarSign, 
  FileText, 
  Clock,
  Phone,
  Mail,
  Building,
  License,
  UserCheck
} from 'lucide-react';

interface ServiceDetailsModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceDetailsModal = ({ service, isOpen, onClose }: ServiceDetailsModalProps) => {
  const getStatusBadge = (status: Service['status']) => {
    const variants = {
      pending: 'bg-yellow-500 text-white',
      closed: 'bg-green-500 text-white',
      invoiced: 'bg-blue-500 text-white'
    };

    const labels = {
      pending: 'En Curso',
      closed: 'Cerrado',
      invoiced: 'Facturado'
    };

    return (
      <Badge className={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Servicio - {service.folio}</span>
            {getStatusBadge(service.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-tms-green" />
                <span>Información General</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Fecha de Solicitud</p>
                  <p className="font-medium">{format(new Date(service.requestDate), 'dd/MM/yyyy', { locale: es })}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Fecha de Servicio</p>
                  <p className="font-medium">{format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Tipo de Servicio</p>
                  <p className="font-medium">{service.serviceType.name}</p>
                </div>
              </div>

              {service.purchaseOrder && (
                <div className="flex items-center space-x-3">
                  <Building className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Orden de Compra</p>
                    <p className="font-medium">{service.purchaseOrder}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Valor del Servicio</p>
                  <p className="font-medium text-lg text-tms-green">{formatCurrency(service.value)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <UserCheck className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Comisión Operador</p>
                  <p className="font-medium">{formatCurrency(service.operatorCommission)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-tms-green" />
                <span>Cliente</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Nombre / Razón Social</p>
                <p className="font-medium text-lg">{service.client.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">RUT</p>
                <p className="font-medium">{service.client.rut}</p>
              </div>

              <div className="flex items-center space-x-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Teléfono</p>
                  <p className="font-medium">{service.client.phone}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="font-medium">{service.client.email}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-400">Dirección</p>
                  <p className="font-medium">{service.client.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del Vehículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-tms-green" />
                <span>Vehículo</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Marca y Modelo</p>
                <p className="font-medium text-lg">{service.vehicleBrand} {service.vehicleModel}</p>
              </div>

              <div className="flex items-center space-x-3">
                <License className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-400">Patente</p>
                  <p className="font-medium text-lg">{service.licensePlate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rutas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-tms-green" />
                <span>Ruta del Servicio</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Origen</p>
                <p className="font-medium">{service.origin}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-gray-400">Destino</p>
                <p className="font-medium">{service.destination}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recursos Asignados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-tms-green" />
                <span>Recursos Asignados</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Grúa</p>
                <p className="font-medium">{service.crane.licensePlate}</p>
                <p className="text-sm text-gray-500">{service.crane.brand} {service.crane.model}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-gray-400">Operador</p>
                <p className="font-medium">{service.operator.name}</p>
                <p className="text-sm text-gray-500">RUT: {service.operator.rut}</p>
                <p className="text-sm text-gray-500">Teléfono: {service.operator.phone}</p>
              </div>
            </CardContent>
          </Card>

          {/* Observaciones */}
          {service.observations && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-tms-green" />
                  <span>Observaciones</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 whitespace-pre-wrap">{service.observations}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer con fechas de creación y actualización */}
        <div className="flex justify-between text-sm text-gray-400 pt-4 border-t border-gray-700">
          <span>Creado: {format(new Date(service.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          <span>Actualizado: {format(new Date(service.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
