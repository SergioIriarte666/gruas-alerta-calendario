
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Service } from '@/types';
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
  Shield,
  Download,
  Timer,
  Gauge,
  Copy
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleHistory } from './VehicleHistory';
import { ServiceChangeHistory } from './ServiceChangeHistory';
import { ServiceCostsSection } from './ServiceCostsSection';
import { useServiceDetailsForView } from '@/hooks/useServiceDetailsGlobal';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { useServiceDetailsPDF } from '@/hooks/useServiceDetailsPDF';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayServiceValue, getServiceValueBreakdown, isCustodyService, getCustodyInfo, isEquipmentRentalService } from '@/utils/serviceValueCalculations';
import { formatForDisplay, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';

interface ServiceDetailsModalProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onDuplicate?: (service: Service) => void;
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
      <p className={`font-medium ${valueClass}`}>{value || 'N/A'}</p>
    </div>
  </div>
);

const calculateDuration = (startTime: string, endTime: string): string => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  const durationMinutes = endTotalMinutes - startTotalMinutes;
  
  if (durationMinutes < 0) {
    return 'Hora de término anterior a inicio';
  }
  
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} minutos`;
  } else if (minutes === 0) {
    return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else {
    return `${hours}h ${minutes}min`;
  }
};

type SectionColor = 'blue' | 'green' | 'violet' | 'orange' | 'cyan' | 'rose' | 'amber' | 'emerald';

const sectionColorConfig: Record<SectionColor, { border: string; bg: string; iconBg: string; title: string }> = {
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-500/5', iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', title: 'text-blue-700 dark:text-blue-300' },
  green: { border: 'border-l-green-500', bg: 'bg-green-500/5', iconBg: 'bg-green-500/10 text-green-600 dark:text-green-400', title: 'text-green-700 dark:text-green-300' },
  violet: { border: 'border-l-violet-500', bg: 'bg-violet-500/5', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', title: 'text-violet-700 dark:text-violet-300' },
  orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/5', iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', title: 'text-orange-700 dark:text-orange-300' },
  cyan: { border: 'border-l-cyan-500', bg: 'bg-cyan-500/5', iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', title: 'text-cyan-700 dark:text-cyan-300' },
  rose: { border: 'border-l-rose-500', bg: 'bg-rose-500/5', iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', title: 'text-rose-700 dark:text-rose-300' },
  amber: { border: 'border-l-amber-500', bg: 'bg-amber-500/5', iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', title: 'text-amber-700 dark:text-amber-300' },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', title: 'text-emerald-700 dark:text-emerald-300' },
};

interface DetailSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color?: SectionColor;
}

const DetailSection = ({ title, icon: Icon, children, color = 'blue' }: DetailSectionProps) => {
  const config = sectionColorConfig[color];
  return (
    <div className={`rounded-lg border border-border border-l-4 ${config.border} ${config.bg} p-4`}>
      <h3 className={`text-base font-semibold mb-4 flex items-center gap-2 ${config.title}`}>
        <div className={`p-1.5 rounded-lg ${config.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
};

export const ServiceDetailsModal = ({ service, isOpen, onClose, onDuplicate }: ServiceDetailsModalProps) => {
  const queryClient = useQueryClient();
  
  // Usar el nuevo sistema global para obtener datos completos del servicio
  const { enhancedService, isLoading } = useServiceDetailsForView(service?.id || null);
  // Hook para generar PDF
  const { generatePDF, isGenerating } = useServiceDetailsPDF();
  
  // Datos combinados seguros cuando no hay servicio seleccionado
  const serviceData = React.useMemo(() => {
    if (!service) return null;
    if (enhancedService) {
      return {
        ...enhancedService,
        client: {
          ...enhancedService.client,
          department: (enhancedService.client.department && enhancedService.client.department.trim())
            ? enhancedService.client.department
            : service.client.department
        },
        createdBy: enhancedService.createdBy || service.createdBy,
        creatorName: enhancedService.creatorName || service.creatorName || 'Usuario Desconocido'
      } as any;
    }
    return service as any;
  }, [service, enhancedService]);
  
  const serviceCosts = enhancedService?.serviceCosts || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;
  
  const primaryOperator =
    enhancedService?.operators && enhancedService.operators.length > 0
      ? (enhancedService.operators.find(op => op.role === 'Principal') || enhancedService.operators[0])?.operator
      : (serviceData as any)?.operator;
  const hasMultipleOperators = enhancedService?.operators && enhancedService.operators.length > 1;
  
  // Detectar si es un servicio de custodia y obtener información
  const isCustody = serviceData ? isCustodyService(serviceData) : false;
  const custodyInfo = isCustody && serviceData ? getCustodyInfo(serviceData) : null;
  const isEquipmentRental = serviceData ? isEquipmentRentalService(serviceData) : false;
  
  // FASE 4: VERIFICACIÓN SILENCIOSA DE INTEGRIDAD DE COMISIONES
  useEffect(() => {
    const verifyAndSyncCommissions = async () => {
      if (!isOpen || !serviceData?.id) return;

      try {
        // Solo verificar servicios con comisiones configuradas (operator_commission > 0)
        if (((serviceData as any)?.operatorCommission || 0) <= 0) {
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
          // Sincronización silenciosa usando la función de la base de datos
          const { data: syncResult, error: syncError } = await supabase.rpc(
            'force_commission_sync_for_service', 
            { p_service_id: serviceData.id }
          );

          if (syncError) {
            console.error('[MODAL_VERIFY] ❌ Error en sincronización silenciosa:', syncError);
          } else if (syncResult && typeof syncResult === 'object' && 'success' in syncResult) {
            // Invalidar queries después de la sincronización
            queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['costs'] });
            queryClient.invalidateQueries({ queryKey: ['commissions'] });
          }
        }
      } catch (error) {
        console.error('[MODAL_VERIFY] ❌ Error en verificación silenciosa:', error);
      }
    };

    if (isOpen && serviceData?.id) {
      // Invalidación estándar
      queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      
      // Verificación silenciosa después de un pequeño delay
      setTimeout(verifyAndSyncCommissions, 100);
    }
  }, [isOpen, serviceData?.id, serviceData?.folio, serviceData?.operatorCommission, queryClient]);

  if (!isOpen || !serviceData) return null;
  
  // Calcular totales usando datos mejorados si están disponibles
  const totalCosts = totalServiceCosts + totalCommissions;
  
  // Usar getDisplayServiceValue para mostrar el valor total real del servicio
  const displayServiceValue = getDisplayServiceValue(serviceData);
  
  // Obtener desglose de valores
  const serviceBreakdown = getServiceValueBreakdown(serviceData);
  
  // Para cálculos de ganancia neta, usar el valor TOTAL del servicio
  // (tanto el monto cubierto como el excedente son utilidad para la empresa)
  const netProfit = displayServiceValue - totalCosts;
  
  // Handler para descargar PDF
  const handleDownloadPDF = () => {
    generatePDF(serviceData, totalCosts, totalCommissions, netProfit);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Detalles del Servicio - {serviceData.folio}</span>
              {getServiceStatusBadge(serviceData.status)}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onDuplicate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onDuplicate(serviceData as Service)}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isGenerating ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="costs">Costos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="changes">Cambios</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <div className="space-y-6">
                  <DetailSection title="Cliente" icon={User}>
                      <DetailItem icon={User} label="Nombre / Razón Social" value={toTitleCase(serviceData.client.name)} valueClass="text-lg" />
                      <DetailItem icon={Building} label="Departamento" value={serviceData.client.department} />
                      {serviceData.insuredName && (
                        <DetailItem icon={Shield} label="Asegurado" value={toTitleCase(serviceData.insuredName)} />
                      )}
                      <DetailItem icon={IdCard} label="RUT" value={serviceData.client.rut} />
                      <DetailItem icon={Phone} label="Teléfono" value={serviceData.client.phone} />
                      <DetailItem icon={Mail} label="Email" value={serviceData.client.email} />
                      <DetailItem icon={MapPin} label="Dirección" value={serviceData.client.address} isFullWidth={true} />
                  </DetailSection>
                   <Separator className="border-border"/>
                  {shouldShowVehicleInfo(serviceData) && (
                    <>
                       <Separator className="border-border"/>
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
                       <DetailItem 
                         icon={FileText} 
                         label="Tipo de Servicio" 
                         value={serviceData.serviceType?.name || serviceData.service_type?.name || 'N/A'} 
                       />
                      {(serviceData.purchaseOrderNumber || serviceData.purchaseOrder) && (
                        <DetailItem icon={Building} label="Orden de Compra" value={serviceData.purchaseOrderNumber || serviceData.purchaseOrder} />
                      )}
                      {serviceData.quoteNumber && (
                        <DetailItem icon={FileText} label="Número de Cotización" value={serviceData.quoteNumber} />
                      )}
                       {(enhancedService?.resolvedInvoiceFolio || serviceData.invoiceFolio) && (
                         <DetailItem icon={FileText} label="Folio Factura" value={enhancedService?.resolvedInvoiceFolio || serviceData.invoiceFolio} />
                       )}
                       {(enhancedService?.resolvedInvoiceNumeroFiscal || serviceData.invoiceNumeroFiscal) && (
                         <DetailItem icon={FileText} label="Número Fiscal" value={enhancedService?.resolvedInvoiceNumeroFiscal || serviceData.invoiceNumeroFiscal} />
                       )}
                       {enhancedService?.resolvedClosureFolio && (
                         <DetailItem icon={FileText} label="Cierre" value={enhancedService.resolvedClosureFolio} />
                       )}
                      <DetailItem icon={Calendar} label="Fecha de Solicitud" value={formatForDisplay(serviceData.requestDate)} />
                      <DetailItem icon={Clock} label="Fecha y Hora de Servicio" value={formatForDisplayWithTime(serviceData.serviceDate)} />
                      {serviceData.startTime && (
                        <DetailItem icon={Clock} label="Hora de Inicio" value={serviceData.startTime} />
                      )}
                      {serviceData.endTime && (
                        <DetailItem icon={Timer} label="Hora de Término" value={serviceData.endTime} />
                      )}
                      {serviceData.startTime && serviceData.endTime && (
                        <DetailItem 
                          icon={Clock} 
                          label="Duración del Servicio" 
                          value={calculateDuration(serviceData.startTime, serviceData.endTime)} 
                        />
                      )}
                      {serviceData.craneMileage && (
                        <DetailItem 
                          icon={Gauge} 
                          label="Kilometraje Grúa" 
                          value={`${serviceData.craneMileage.toLocaleString('es-CL')} km`} 
                        />
                      )}
                      <DetailItem icon={MapPin} label="Origen" value={serviceData.origin} isFullWidth={true} />
                      <DetailItem icon={MapPin} label="Destino" value={serviceData.destination} isFullWidth={true} />
                  </DetailSection>
                  
                  {/* Sección de Custodia/Arriendo */}
                  {isCustody && custodyInfo && (
                    <>
                       <Separator className="border-border"/>
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
                        <DetailItem 
                          icon={DollarSign} 
                          label={
                            custodyInfo.rateType === 'weekly' ? 'Tarifa Semanal' :
                            custodyInfo.rateType === 'monthly' ? 'Tarifa Mensual' :
                            'Tarifa Diaria'
                          } 
                          value={formatCurrency(custodyInfo.originalRate)}
                        />
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
                          <DetailItem icon={Calendar} label="Fecha Inicio" value={formatForDisplay(custodyInfo.startDate)} />
                        )}
                        {custodyInfo.endDate && (
                          <DetailItem icon={Calendar} label="Fecha Fin" value={formatForDisplay(custodyInfo.endDate)} />
                        )}
                        {custodyInfo.notes && (
                          <DetailItem icon={FileText} label="Notas" value={custodyInfo.notes} isFullWidth={true} />
                        )}
                      </DetailSection>
                    </>
                  )}
                  
                  {/* Sección Servicio Tercerizado */}
                  {serviceData.outsourcedProviderId && (
                    <>
                       <Separator className="border-border"/>
                      <DetailSection title="Servicio Tercerizado" icon={Building}>
                        <DetailItem 
                          icon={Building} 
                          label="Proveedor Tercero" 
                          value={enhancedService?.outsourcedProviderName || serviceData.outsourcedProviderId} 
                        />
                        <DetailItem 
                          icon={DollarSign} 
                          label="Costo del Tercero" 
                          value={formatCurrency(serviceData.outsourcedCost || 0)} 
                          valueClass="text-lg text-destructive font-bold" 
                        />
                        {serviceData.outsourcedNotes && (
                          <DetailItem icon={FileText} label="Notas" value={serviceData.outsourcedNotes} isFullWidth={true} />
                        )}
                      </DetailSection>
                    </>
                  )}
                  
                   <Separator className="border-border"/>
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
                    <Separator className="border-border"/>
                    <DetailSection title="Finanzas" icon={DollarSign}>
                        {/* Mostrar desglose si hay tanto valor base como custodia */}
                        {serviceBreakdown.hasBothValues ? (
                          <>
                            <DetailItem 
                              icon={DollarSign} 
                              label="Valor Base del Servicio" 
                              value={formatCurrency(serviceBreakdown.baseValue)} 
                              valueClass="text-md text-blue-600 font-medium" 
                            />
                            <DetailItem 
                              icon={Shield} 
                              label="Valor de Custodia" 
                              value={formatCurrency(serviceBreakdown.custodyValue)} 
                              valueClass="text-md text-green-600 font-medium" 
                            />
                            <DetailItem 
                              icon={DollarSign} 
                              label="Valor Total del Servicio" 
                              value={formatCurrency(displayServiceValue)} 
                              valueClass="text-lg text-violet-600 font-bold border-t border-border pt-2" 
                            />
                          </>
                        ) : (
                          <DetailItem 
                            icon={DollarSign} 
                            label={isCustody ? "Valor Total Servicio" : serviceData.hasExcess ? "Valor Total del Servicio" : "Valor del Servicio"} 
                            value={formatCurrency(displayServiceValue)} 
                            valueClass="text-lg text-violet-600 font-bold" 
                          />
                        )}
                        {serviceData.hasExcess && serviceData.clientCoveredAmount && (
                          <>
                            <DetailItem 
                              icon={DollarSign} 
                              label="Monto Cubierto Cliente" 
                              value={formatCurrency(serviceData.clientCoveredAmount)} 
                              valueClass="text-md text-blue-600 font-medium" 
                            />
                            <DetailItem 
                              icon={DollarSign} 
                              label="Excedente" 
                              value={formatCurrency(displayServiceValue - (serviceData.clientCoveredAmount || 0))} 
                              valueClass="text-md text-orange-600 font-medium" 
                            />
                          </>
                        )}
                         <DetailItem icon={DollarSign} label="Total Costos" value={formatCurrency(totalCosts)} valueClass="text-lg text-destructive font-bold" />
                         <DetailItem icon={DollarSign} label="Ganancia Neta" value={formatCurrency(netProfit)} valueClass={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-destructive'}`}/>
                    </DetailSection>

                  {serviceData.observations && (
                    <>
                      <Separator className="border-border"/>
                       <div className='pt-6'>
                          <DetailSection title="Observaciones" icon={FileText}>
                             <p className="text-muted-foreground whitespace-pre-wrap col-span-2">{serviceData.observations}</p>
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

            <TabsContent value="changes" className="mt-0">
              <ServiceChangeHistory serviceId={serviceData.id} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between text-sm text-muted-foreground pt-4 mt-6 mb-6 border-t border-border">
            <span>
              Creado: {formatForDisplayWithTime(serviceData.createdAt)}
              {serviceData.creatorName && ` por ${serviceData.creatorName}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(serviceData.updatedAt)}</span>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
