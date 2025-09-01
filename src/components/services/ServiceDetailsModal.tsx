
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Wrench,
  Shield
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleHistory } from './VehicleHistory';
import { ServiceCostsSection } from './ServiceCostsSection';
import { useServiceDetailsForView } from '@/hooks/useServiceDetailsGlobal';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getServiceValueForClosure, isCustodyService, getCustodyInfo, isEquipmentRentalService } from '@/utils/serviceValueCalculations';

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
  const queryClient = useQueryClient();
  
  // Usar el nuevo sistema global para obtener datos completos del servicio
  const { enhancedService, isLoading } = useServiceDetailsForView(service.id);
  
  // Usar los datos mejorados si están disponibles, sino usar los datos básicos
  const serviceData = enhancedService || service;
  const serviceCosts = enhancedService?.serviceCosts || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;
  
  // Obtener información del operador principal
  const getPrimaryOperator = () => {
    if (enhancedService?.operators && enhancedService.operators.length > 0) {
      // Usar datos enhanced: buscar operador principal o tomar el primero
      const primaryOperator = enhancedService.operators.find(op => op.role === 'Principal') || enhancedService.operators[0];
      return primaryOperator.operator;
    }
    // Usar datos básicos como fallback
    return serviceData.operator;
  };
  
  const primaryOperator = getPrimaryOperator();
  const hasMultipleOperators = enhancedService?.operators && enhancedService.operators.length > 1;
  
  // Detectar si es un servicio de custodia y obtener información
  const isCustody = isCustodyService(serviceData);
  const custodyInfo = isCustody ? getCustodyInfo(serviceData) : null;
  const isEquipmentRental = isEquipmentRentalService(serviceData);
  
  // FASE 4: VERIFICACIÓN SILENCIOSA DE INTEGRIDAD DE COMISIONES
  useEffect(() => {
    const verifyAndSyncCommissions = async () => {
      if (!isOpen || !serviceData.id) return;

      try {
        // Solo verificar servicios con comisiones configuradas (operator_commission > 0)
        if ((serviceData.operatorCommission || 0) <= 0) {
          console.log(`[MODAL_VERIFY] ✅ Servicio ${serviceData.folio} sin comisiones - no requiere verificación`);
          return;
        }

        // Verificar si las comisiones están sincronizadas
        const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
        
        const { data: existingCommissions, error } = await supabase
          .from('costs')
          .select('id, amount')
          .eq('service_id', serviceData.id)
          .eq('category_id', commissionCategoryId);

        if (error) {
          console.error('[MODAL_VERIFY] ❌ Error verificando comisiones:', error);
          return;
        }

        if (!existingCommissions || existingCommissions.length === 0) {
          console.log(`[MODAL_VERIFY] 🔧 Servicio ${serviceData.folio} requiere sincronización silenciosa`);
          
          // Sincronización silenciosa usando la función de la base de datos
          const { data: syncResult, error: syncError } = await supabase.rpc(
            'force_commission_sync_for_service', 
            { p_service_id: serviceData.id }
          );

          if (syncError) {
            console.error('[MODAL_VERIFY] ❌ Error en sincronización silenciosa:', syncError);
          } else if (syncResult && typeof syncResult === 'object' && 'success' in syncResult) {
            console.log(`[MODAL_VERIFY] ✅ Sincronización silenciosa exitosa para ${serviceData.folio}:`, syncResult);
            
            // Invalidar queries después de la sincronización
            queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['costs'] });
            queryClient.invalidateQueries({ queryKey: ['commissions'] });
          }
        } else {
          console.log(`[MODAL_VERIFY] ✅ Servicio ${serviceData.folio} ya tiene comisiones sincronizadas`);
        }
      } catch (error) {
        console.error('[MODAL_VERIFY] ❌ Error en verificación silenciosa:', error);
      }
    };

    if (isOpen && serviceData.id) {
      // Invalidación estándar
      queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      
      // Verificación silenciosa después de un pequeño delay
      setTimeout(verifyAndSyncCommissions, 100);
    }
  }, [isOpen, serviceData.id, serviceData.folio, serviceData.operatorCommission, queryClient]);
  
  // Calcular totales usando datos mejorados si están disponibles
  const totalCosts = totalServiceCosts + totalCommissions;
  
  // Usar getServiceValueForClosure para obtener el valor correcto del servicio
  const displayServiceValue = getServiceValueForClosure(serviceData);
  
  // Calcular ganancia neta basada en el valor correcto del servicio
  const netProfit = displayServiceValue - totalCosts;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Servicio - {serviceData.folio}</span>
            {getServiceStatusBadge(serviceData.status)}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="details">Detalles del Servicio</TabsTrigger>
              <TabsTrigger value="costs">Costos y Gastos</TabsTrigger>
              <TabsTrigger value="history">Historial Vehículo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <div className="space-y-6">
                  <DetailSection title="Cliente" icon={User}>
                      <DetailItem icon={User} label="Nombre / Razón Social" value={serviceData.client.name} valueClass="text-lg" />
                      <DetailItem icon={Building} label="Departamento" value={serviceData.client.department} />
                      <DetailItem icon={IdCard} label="RUT" value={serviceData.client.rut} />
                      <DetailItem icon={Phone} label="Teléfono" value={serviceData.client.phone} />
                      <DetailItem icon={Mail} label="Email" value={serviceData.client.email} />
                      <DetailItem icon={MapPin} label="Dirección" value={serviceData.client.address} isFullWidth={true} />
                  </DetailSection>
                  <Separator className="bg-gray-700"/>
                  {shouldShowVehicleInfo(serviceData) && (
                    <>
                      <Separator className="bg-gray-700"/>
                      <DetailSection title="Vehículo" icon={Truck}>
                          <DetailItem icon={Wrench} label="Marca y Modelo" value={`${serviceData.vehicleBrand} ${serviceData.vehicleModel}`} />
                          <DetailItem icon={IdCard} label="Patente" value={serviceData.licensePlate} valueClass="text-lg" />
                      </DetailSection>
                    </>
                  )}
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="mt-0">
              <div className="space-y-6">
                  <DetailSection title="Información del Servicio" icon={FileText}>
                      <DetailItem icon={FileText} label="Tipo de Servicio" value={serviceData.serviceType.name} />
                      {serviceData.purchaseOrder && (
                        <DetailItem icon={Building} label="Orden de Compra" value={serviceData.purchaseOrder} />
                      )}
                      {serviceData.quoteNumber && (
                        <DetailItem icon={FileText} label="Número de Cotización" value={serviceData.quoteNumber} />
                      )}
                      {serviceData.invoiceFolio && (
                        <DetailItem icon={FileText} label="Folio Factura" value={serviceData.invoiceFolio} />
                      )}
                      {serviceData.invoiceNumeroFiscal && (
                        <DetailItem icon={FileText} label="Número Fiscal" value={serviceData.invoiceNumeroFiscal} />
                      )}
                      <DetailItem icon={Calendar} label="Fecha de Solicitud" value={format(parseFromDatabase(serviceData.requestDate), 'dd/MM/yyyy', { locale: es })} />
                      <DetailItem icon={Clock} label="Fecha y Hora de Servicio" value={format(parseFromDatabase(serviceData.serviceDate), "dd/MM/yyyy HH:mm", { locale: es })} />
                      <DetailItem icon={MapPin} label="Origen" value={serviceData.origin} isFullWidth={true} />
                      <DetailItem icon={MapPin} label="Destino" value={serviceData.destination} isFullWidth={true} />
                  </DetailSection>
                  
                  {/* Sección de Custodia/Arriendo */}
                  {isCustody && custodyInfo && (
                    <>
                      <Separator className="bg-gray-700"/>
                      <DetailSection 
                        title={isEquipmentRental ? "Información de Arriendo" : "Información de Custodia"} 
                        icon={isEquipmentRental ? Wrench : Shield}
                      >
                        <DetailItem 
                          icon={isEquipmentRental ? Wrench : Shield} 
                          label={isEquipmentRental ? "Tipo de Equipo" : "Tipo de Vehículo"} 
                          value={custodyInfo.vehicleType} 
                        />
                        <DetailItem 
                          icon={Calendar} 
                          label={isEquipmentRental ? "Días de Arriendo" : "Días de Custodia"} 
                          value={custodyInfo.days} 
                        />
                        <DetailItem icon={DollarSign} label="Tarifa Diaria" value={formatCurrency(custodyInfo.dailyRate)} />
                        {custodyInfo.discountPercentage > 0 && (
                          <DetailItem icon={DollarSign} label="Descuento" value={`${custodyInfo.discountPercentage}%`} />
                        )}
                        <DetailItem 
                          icon={DollarSign} 
                          label={isEquipmentRental ? "Total Arriendo" : "Total Custodia"} 
                          value={formatCurrency(custodyInfo.totalAmount)} 
                          valueClass="text-lg text-tms-green font-bold" 
                        />
                        {custodyInfo.startDate && (
                          <DetailItem icon={Calendar} label="Fecha Inicio" value={format(new Date(custodyInfo.startDate), 'dd/MM/yyyy', { locale: es })} />
                        )}
                        {custodyInfo.endDate && (
                          <DetailItem icon={Calendar} label="Fecha Fin" value={format(new Date(custodyInfo.endDate), 'dd/MM/yyyy', { locale: es })} />
                        )}
                        {custodyInfo.notes && (
                          <DetailItem icon={FileText} label="Notas" value={custodyInfo.notes} isFullWidth={true} />
                        )}
                      </DetailSection>
                    </>
                  )}
                  
                  <Separator className="bg-gray-700"/>
                  <DetailSection title="Recursos Asignados" icon={Truck}>
                      <DetailItem 
                          icon={Truck} 
                          label="Grúa" 
                          value={serviceData.crane ? `${serviceData.crane.brand} ${serviceData.crane.model} (${serviceData.crane.licensePlate})` : 'Sin asignar'} 
                      />
                       <DetailItem 
                           icon={UserCheck} 
                           label="Operador" 
                           value={primaryOperator ? `${primaryOperator.name} (${primaryOperator.rut})${hasMultipleOperators ? ' (Principal)' : ''}` : 'Sin asignar'} 
                       />
                  </DetailSection>
                   <Separator className="bg-gray-700"/>
                   <DetailSection title="Finanzas" icon={DollarSign}>
                       <DetailItem 
                         icon={DollarSign} 
                         label={isCustody ? "Valor Total Servicio" : "Valor del Servicio"} 
                         value={formatCurrency(displayServiceValue)} 
                         valueClass="text-lg text-tms-green font-bold" 
                       />
                       {serviceData.hasExcess && serviceData.clientCoveredAmount && (
                         <DetailItem icon={DollarSign} label="Monto Cubierto Cliente" value={formatCurrency(serviceData.clientCoveredAmount)} valueClass="text-sm text-gray-400" />
                       )}
                       <DetailItem icon={DollarSign} label="Total Costos" value={formatCurrency(totalCosts)} valueClass="text-lg text-red-400 font-bold" />
                       <DetailItem icon={DollarSign} label="Ganancia Neta" value={formatCurrency(netProfit)} valueClass={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}/>
                   </DetailSection>

                  {serviceData.observations && (
                    <>
                      <Separator className="bg-gray-700"/>
                       <div className='pt-6'>
                          <DetailSection title="Observaciones" icon={FileText}>
                             <p className="text-gray-300 whitespace-pre-wrap col-span-2">{serviceData.observations}</p>
                          </DetailSection>
                       </div>
                    </>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="costs" className="mt-0">
              <ServiceCostsSection serviceId={serviceData.id} enhancedService={enhancedService} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
               <VehicleHistory 
                 licensePlate={serviceData.licensePlate} 
                 currentServiceId={serviceData.id}
                 clientId={serviceData.client.id}
                 clientName={serviceData.client.name}
               />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between text-sm text-gray-400 pt-4 mt-6 mb-6 border-t border-gray-700">
            <span>Creado: {format(parseFromDatabase(serviceData.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
            <span>Actualizado: {format(parseFromDatabase(serviceData.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};