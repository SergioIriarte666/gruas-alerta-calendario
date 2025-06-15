
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  IdCard,
  UserCheck,
  Wrench
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleHistory } from './VehicleHistory';

interface ServiceDetailsModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
}

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  isFullWidth?: boolean;
}

const DetailItem = ({ icon: Icon, label, value, valueClass = '', isFullWidth = false }: DetailItemProps) => (
  <div className={`flex items-start space-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
    <div className="flex-grow">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`font-medium ${valueClass}`}>{value || 'N/A'}</p>
    </div>
  </div>
);

interface DetailSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const DetailSection = ({ title, icon: Icon, children }: DetailSectionProps) => (
  <div>
    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-tms-green"/>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);

export const ServiceDetailsModal = ({ service, isOpen, onClose }: ServiceDetailsModalProps) => {
  const getStatusBadge = (status: Service['status']) => {
    const variants = {
      pending: 'bg-yellow-500 text-white',
      in_progress: 'bg-blue-500 text-white',
      completed: 'bg-green-500 text-white',
      cancelled: 'bg-red-500 text-white',
    };
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    const variant = variants[status] || 'bg-gray-500';
    const label = labels[status] || 'Desconocido';
    return <Badge className={variant}>{label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  const netProfit = service.value - service.operatorCommission;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Servicio - {service.folio}</span>
            {getStatusBadge(service.status)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="details">Detalles del Servicio</TabsTrigger>
            <TabsTrigger value="history">Historial Vehículo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
                <DetailSection title="Cliente" icon={User}>
                    <DetailItem icon={User} label="Nombre / Razón Social" value={service.client.name} valueClass="text-lg" />
                    <DetailItem icon={IdCard} label="RUT" value={service.client.rut} />
                    <DetailItem icon={Phone} label="Teléfono" value={service.client.phone} />
                    <DetailItem icon={Mail} label="Email" value={service.client.email} />
                    <DetailItem icon={MapPin} label="Dirección" value={service.client.address} isFullWidth={true} />
                </DetailSection>
                <Separator className="bg-gray-700"/>
                <DetailSection title="Vehículo" icon={Truck}>
                    <DetailItem icon={Wrench} label="Marca y Modelo" value={`${service.vehicleBrand} ${service.vehicleModel}`} />
                    <DetailItem icon={IdCard} label="Patente" value={service.licensePlate} valueClass="text-lg" />
                </DetailSection>
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="mt-6">
            <div className="space-y-6">
                <DetailSection title="Información del Servicio" icon={FileText}>
                    <DetailItem icon={FileText} label="Tipo de Servicio" value={service.serviceType.name} />
                    <DetailItem icon={Building} label="Orden de Compra" value={service.purchaseOrder} />
                    <DetailItem icon={Calendar} label="Fecha de Solicitud" value={format(new Date(service.requestDate), 'dd/MM/yyyy', { locale: es })} />
                    <DetailItem icon={Clock} label="Fecha y Hora de Servicio" value={format(new Date(service.serviceDate), "dd/MM/yyyy HH:mm", { locale: es })} />
                    <DetailItem icon={MapPin} label="Origen" value={service.origin} isFullWidth={true} />
                    <DetailItem icon={MapPin} label="Destino" value={service.destination} isFullWidth={true} />
                </DetailSection>
                <Separator className="bg-gray-700"/>
                <DetailSection title="Recursos Asignados" icon={Truck}>
                    <DetailItem 
                        icon={Truck} 
                        label="Grúa" 
                        value={`${service.crane.brand} ${service.crane.model} (${service.crane.licensePlate})`} 
                    />
                    <DetailItem 
                        icon={UserCheck} 
                        label="Operador" 
                        value={`${service.operator.name} (${service.operator.rut})`} 
                    />
                </DetailSection>
                 <Separator className="bg-gray-700"/>
                <DetailSection title="Finanzas" icon={DollarSign}>
                    <DetailItem icon={DollarSign} label="Valor del Servicio" value={formatCurrency(service.value)} valueClass="text-lg text-tms-green font-bold" />
                    <DetailItem icon={UserCheck} label="Comisión Operador" value={formatCurrency(service.operatorCommission)} />
                    <DetailItem icon={DollarSign} label="Ganancia Neta" value={formatCurrency(netProfit)} valueClass="text-lg text-emerald-400 font-bold"/>
                </DetailSection>

                {service.observations && (
                  <>
                    <Separator className="bg-gray-700"/>
                     <div className='pt-6'>
                        <DetailSection title="Observaciones" icon={FileText}>
                           <p className="text-gray-300 whitespace-pre-wrap col-span-2">{service.observations}</p>
                        </DetailSection>
                     </div>
                  </>
                )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
             <VehicleHistory licensePlate={service.licensePlate} currentServiceId={service.id} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between text-sm text-gray-400 pt-4 mt-4 border-t border-gray-700">
          <span>Creado: {format(new Date(service.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          <span>Actualizado: {format(new Date(service.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
