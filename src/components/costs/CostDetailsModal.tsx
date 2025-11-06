import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Cost } from '@/types/costs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  Tag,
  Truck,
  User,
  Wrench,
  Building,
  Hash,
  MapPin,
  Navigation,
  Users,
  Car
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseFromDatabase } from '@/utils/timezoneUtils';

interface CostDetailsModalProps {
  cost: Cost;
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
    <Icon className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
    <div className="flex-grow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium text-foreground ${valueClass}`}>{value || 'N/A'}</p>
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
    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-primary"/>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);

export const CostDetailsModal = ({ cost, isOpen, onClose }: CostDetailsModalProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getAssociatedInfo = () => {
    if (cost.cranes) {
      return {
        type: 'Grúa',
        icon: Truck,
        details: `${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`
      };
    }
    if (cost.operators) {
      return {
        type: 'Operador',
        icon: User,
        details: `${cost.operators.name} (${cost.operators.rut})`
      };
    }
    if (cost.services) {
      return {
        type: 'Servicio',
        icon: Wrench,
        details: `Folio: ${cost.services.folio}`
      };
    }
    return null;
  };

  const associatedInfo = getAssociatedInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Costo - {cost.description}</span>
            <Badge className="bg-destructive text-destructive-foreground">
              {formatCurrency(Number(cost.amount))}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="associations">Asociaciones</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
              <DetailSection title="Información Básica" icon={FileText}>
                <DetailItem 
                  icon={FileText} 
                  label="Descripción" 
                  value={cost.description} 
                  valueClass="text-lg" 
                />
                <DetailItem 
                  icon={Tag} 
                  label="Categoría" 
                  value={cost.subcategory 
                    ? `${cost.cost_categories?.name} > ${cost.subcategory}` 
                    : cost.cost_categories?.name || 'Sin categoría'
                  } 
                />
                <DetailItem 
                  icon={Calendar} 
                  label="Fecha" 
                  value={format(parseFromDatabase(cost.date), 'dd/MM/yyyy', { locale: es })} 
                />
                <DetailItem 
                  icon={DollarSign} 
                  label="Monto" 
                  value={formatCurrency(Number(cost.amount))} 
                  valueClass="text-lg text-destructive font-bold" 
                />
              </DetailSection>

              <Separator className="border-border"/>
              <DetailSection title="Notas" icon={FileText}>
                <div className="col-span-1 md:col-span-2">
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <p className="text-muted-foreground whitespace-pre-wrap min-h-[60px]">
                      {cost.notes || 'Sin notas adicionales'}
                    </p>
                  </div>
                </div>
              </DetailSection>

              {cost.cost_categories?.description && (
                <>
                  <Separator className="border-border"/>
                  <DetailSection title="Descripción de Categoría" icon={Tag}>
                    <div className="col-span-1 md:col-span-2">
                      <p className="text-muted-foreground">{cost.cost_categories.description}</p>
                    </div>
                  </DetailSection>
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="mt-6">
            <div className="space-y-6">
              <DetailSection title="Información Detallada" icon={FileText}>
                {cost.service_folio && (
                  <DetailItem 
                    icon={Building} 
                    label="Folio de Servicio" 
                    value={cost.service_folio} 
                    isFullWidth={true}
                  />
                )}
                {!cost.service_folio && (
                  <div className="col-span-1 md:col-span-2 text-center py-6 text-muted-foreground">
                    <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay información detallada adicional</p>
                  </div>
                )}
              </DetailSection>
            </div>
          </TabsContent>

          <TabsContent value="associations" className="mt-6">
            <div className="space-y-6">
              {associatedInfo ? (
                <DetailSection title={`Asociado a ${associatedInfo.type}`} icon={associatedInfo.icon}>
                  <DetailItem 
                    icon={associatedInfo.icon} 
                    label={associatedInfo.type} 
                    value={associatedInfo.details} 
                    valueClass="text-lg text-primary" 
                    isFullWidth={true}
                  />
                  
                  {/* Información completa del servicio asociado */}
                  {cost.services && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Wrench className="w-4 h-4 mr-2 text-primary"/>
                          Información del Servicio
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={FileText} label="Folio" value={cost.services.folio} />
                          <DetailItem icon={Users} label="Cliente" value={cost.services.clients?.name || 'Sin cliente'} />
                          <DetailItem icon={Calendar} label="Fecha de Solicitud" value={format(parseFromDatabase(cost.services.request_date), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Fecha de Servicio" value={format(parseFromDatabase(cost.services.service_date), 'dd/MM/yyyy', { locale: es })} />
                          {cost.services.purchase_order && (
                            <DetailItem icon={Hash} label="Orden de Compra" value={cost.services.purchase_order} />
                          )}
                          <DetailItem icon={Tag} label="Estado" value={cost.services.status || 'Sin estado'} />
                        </div>
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Car className="w-4 h-4 mr-2 text-primary"/>
                          Información del Vehículo
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Car} label="Marca" value={cost.services.vehicle_brand} />
                          <DetailItem icon={Car} label="Modelo" value={cost.services.vehicle_model} />
                          <DetailItem icon={Hash} label="Patente" value={cost.services.license_plate} valueClass="font-mono" />
                        </div>
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <MapPin className="w-4 h-4 mr-2 text-primary"/>
                          Ubicación del Servicio
                        </h4>
                        <div className="grid grid-cols-1 gap-y-3">
                          <DetailItem icon={MapPin} label="Origen" value={cost.services.origin} isFullWidth={true} />
                          <DetailItem icon={Navigation} label="Destino" value={cost.services.destination} isFullWidth={true} />
                        </div>
                      </div>

                      {cost.services.observations && (
                        <div className="col-span-1 md:col-span-2">
                          <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-primary"/>
                            Observaciones del Servicio
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-4 border">
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {cost.services.observations}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Información de grúa si está asociada */}
                  {cost.cranes && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Truck className="w-4 h-4 mr-2 text-primary"/>
                          Información de la Grúa
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Truck} label="Tipo" value={cost.cranes.type} />
                          <DetailItem icon={Calendar} label="Seguro Vigencia" value={format(parseFromDatabase(cost.cranes.insurance_expiry), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Revisión Técnica" value={format(parseFromDatabase(cost.cranes.technical_review_expiry), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Permiso Circulación" value={format(parseFromDatabase(cost.cranes.circulation_permit_expiry), 'dd/MM/yyyy', { locale: es })} />
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Información de operador si está asociado */}
                  {cost.operators && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <User className="w-4 h-4 mr-2 text-primary"/>
                          Información del Operador
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Hash} label="Número de Licencia" value={cost.operators.license_number} />
                          <DetailItem icon={Calendar} label="Vencimiento Examen" value={format(parseFromDatabase(cost.operators.exam_expiry), 'dd/MM/yyyy', { locale: es })} />
                        </div>
                      </div>
                    </>
                  )}
                </DetailSection>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Este costo no está asociado a ningún recurso específico</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between text-sm text-muted-foreground pt-4 mt-4 border-t">
          <span>Creado: {format(parseFromDatabase(cost.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          <span>Actualizado: {format(parseFromDatabase(cost.updated_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};