
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
  Copy,
  MessageCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleHistory } from './VehicleHistory';
import { ServiceChangeHistory } from './ServiceChangeHistory';
import { ServiceCostsSection } from './ServiceCostsSection';
import { useServiceDetailsForView } from '@/hooks/useServiceDetailsGlobal';
import { shouldShowVehicleInfo, getServiceStatusBadge, formatCurrency, formatVehicleInfo } from '@/utils/statusHelpers';
import { useServiceDetailsPDF } from '@/hooks/useServiceDetailsPDF';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayServiceValue, getServiceValueBreakdown, isCustodyService, getCustodyInfo, isEquipmentRentalService } from '@/utils/serviceValueCalculations';
import { formatForDisplay, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';
import { toast } from 'sonner';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';
import { generateQuotePDF } from '@/utils/pdf/quotePdfGenerator';
import { generateWorkOrderPDF } from '@/utils/pdf/workOrderPdfGenerator';
import { useSettings } from '@/hooks/useSettings';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ServiceDetailsModal");
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
  <div className={`flex items-start gap-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="size-4 text-muted-foreground mt-1 flex-shrink-0" />
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
  blue: { border: 'border-l-info', bg: 'bg-info/5', iconBg: 'bg-info/10 text-info', title: 'text-foreground' },
  green: { border: 'border-l-success', bg: 'bg-success/5', iconBg: 'bg-success/10 text-success', title: 'text-foreground' },
  violet: { border: 'border-l-primary', bg: 'bg-primary/5', iconBg: 'bg-primary/10 text-primary', title: 'text-foreground' },
  orange: { border: 'border-l-warning', bg: 'bg-warning/5', iconBg: 'bg-warning/10 text-warning', title: 'text-foreground' },
  cyan: { border: 'border-l-info', bg: 'bg-info/5', iconBg: 'bg-info/10 text-info', title: 'text-foreground' },
  rose: { border: 'border-l-danger', bg: 'bg-danger/5', iconBg: 'bg-danger/10 text-danger', title: 'text-foreground' },
  amber: { border: 'border-l-warning', bg: 'bg-warning/5', iconBg: 'bg-warning/10 text-warning', title: 'text-foreground' },
  emerald: { border: 'border-l-success', bg: 'bg-success/5', iconBg: 'bg-success/10 text-success', title: 'text-foreground' },
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
          <Icon className="size-4" />
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
  const [isSendingOperatorWhatsApp, setIsSendingOperatorWhatsApp] = React.useState(false);
  
  // Usar el nuevo sistema global para obtener datos completos del servicio
  const { enhancedService } = useServiceDetailsForView(service?.id || null);
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
  
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;
  
  const primaryOperator =
    enhancedService?.operators && enhancedService.operators.length > 0
      ? (enhancedService.operators.find((op: { role?: string }) => op.role === 'Principal') || enhancedService.operators[0])?.operator
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
          logger.error('[MODAL_VERIFY] ❌ Error verificando comisiones:', error);
          return;
        }

        if (!existingCommissions || existingCommissions.length === 0) {
          // Sincronización silenciosa usando la función de la base de datos
          const { data: syncResult, error: syncError } = await supabase.rpc(
            'force_commission_sync_for_service', 
            { p_service_id: serviceData.id }
          );

          if (syncError) {
            logger.error('[MODAL_VERIFY] ❌ Error en sincronización silenciosa:', syncError);
          } else if (syncResult && typeof syncResult === 'object' && 'success' in syncResult) {
            // Invalidar queries después de la sincronización
            queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
            queryClient.invalidateQueries({ queryKey: ['costs'] });
            queryClient.invalidateQueries({ queryKey: ['commissions'] });
          }
        }
      } catch (error) {
        logger.error('[MODAL_VERIFY] ❌ Error en verificación silenciosa:', error);
      }
    };

    if (isOpen && serviceData?.id) {
      // Invalidación estándar
      queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      
      // Verificación silenciosa después de un pequeño delay
      const verifyTimeoutId = setTimeout(verifyAndSyncCommissions, 100);
      return () => clearTimeout(verifyTimeoutId);
    }
  }, [isOpen, serviceData?.id, serviceData?.folio, serviceData?.operatorCommission, queryClient]);

  // Hooks que deben ejecutarse SIEMPRE antes de cualquier early-return
  const { settings } = useSettings();
  const { isGenerating: isGeneratingDoc, generateAndDownload } = usePDFGeneration();

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

  // Generación de documentos comerciales
  const handleGenerateQuote = () =>
    generateAndDownload(
      () => generateQuotePDF(serviceData as Service, settings),
      `cotizacion-${serviceData.folio}.pdf`,
    );

  const handleGenerateWorkOrder = () =>
    generateAndDownload(
      () => generateWorkOrderPDF(serviceData as Service, settings),
      `orden-trabajo-${serviceData.folio}.pdf`,
    );

  const handleNotifyPurchaseOrder = async () => {
    const oc = serviceData.purchaseOrderNumber || serviceData.purchaseOrder;
    if (!oc) return;

    const { data, error } = await supabase.functions.invoke('send-whatsapp-admin', {
      body: {
        event: 'orden_compra',
        data: {
          proveedor: serviceData.client?.name || '',
          monto: displayServiceValue.toLocaleString('es-CL') || '0',
          descripcion: `OC ${oc} - Folio ${serviceData.folio}`,
        },
      },
    });

    if (error) {
      logger.warn('WhatsApp admin no enviado:', error);
      toast.error('No se pudo enviar la notificación');
      return;
    }

    if ((data as any)?.skipped) {
      const reason = (data as any)?.reason;
      logger.info('WhatsApp admin omitido:', reason);
      if (reason === 'whatsapp_disabled') {
        toast.warning('Envío de WhatsApp deshabilitado en Configuración');
      } else {
        toast.info('WhatsApp no enviado', { description: reason || 'Envío omitido por configuración' });
      }
      return;
    }

    toast.success('Administradores notificados por WhatsApp');
  };

  const handleNotifyOperator = async () => {
    if (!primaryOperator?.id) {
      toast.error('Este servicio no tiene un operador asignado');
      return;
    }

    setIsSendingOperatorWhatsApp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-operator', {
        body: {
          operatorId: primaryOperator.id,
          serviceId: serviceData.id,
          folio: serviceData.folio,
          vehicleBrand: serviceData.vehicleBrand || '',
          vehicleModel: serviceData.vehicleModel || '',
          licensePlate: serviceData.licensePlate || '',
          clientName: serviceData.client?.name || '',
          clientPhone: serviceData.client?.phone || '',
          contactPerson: serviceData.contactPerson || (serviceData as any).contact_person || '',
          contactPhone: serviceData.contactPhone || (serviceData as any).contact_phone || '',
          serviceDate: serviceData.serviceDate,
          origin: serviceData.origin || '',
          destination: serviceData.destination || '',
          force: true,
        },
      });

      if (error) {
        logger.warn('WhatsApp operador no enviado:', error);
        toast.error('No se pudo enviar la notificacion al operador');
        return;
      }

      if ((data as any)?.skipped) {
        const reason = (data as any)?.reason;
        logger.info('WhatsApp operador omitido:', reason);
        if (reason === 'whatsapp_disabled') {
          toast.warning('Envío de WhatsApp deshabilitado en Configuración');
        } else {
          toast.info('WhatsApp al operador omitido', { description: reason || 'Envío omitido por configuración' });
        }
        return;
      }

      toast.success('Operador notificado por WhatsApp');
    } finally {
      setIsSendingOperatorWhatsApp(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] max-w-4xl w-[95vw] flex-col border-border/70 bg-card p-0">
        <DialogHeader className="flex flex-shrink-0 flex-col gap-3 border-b border-border/70 px-6 pb-4 pt-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="whitespace-nowrap border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Servicio {serviceData.folio}
              </Badge>
              {getServiceStatusBadge(serviceData.status)}
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground text-center">
              Detalle Operativo y Financiero
            </DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
                variant="outline"
                size="sm"
                onClick={handleNotifyOperator}
                className="flex items-center gap-2"
                title={primaryOperator?.name ? `Notificar a ${primaryOperator.name}` : 'Servicio sin operador asignado'}
                disabled={!primaryOperator?.id || isSendingOperatorWhatsApp}
              >
                <MessageCircle className="size-4" />
                {isSendingOperatorWhatsApp ? 'Enviando...' : 'Notificar Operador'}
              </Button>
              {(serviceData.purchaseOrderNumber || serviceData.purchaseOrder) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNotifyPurchaseOrder}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="size-4" />
                  Notificar OC
                </Button>
              )}
              {onDuplicate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onDuplicate(serviceData as Service)}
                  className="flex items-center gap-2"
                >
                  <Copy className="size-4" />
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
                <Download className="size-4" />
                {isGenerating ? 'Generando...' : 'Descargar PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateQuote}
                disabled={isGeneratingDoc}
                className="flex items-center gap-2"
              >
                <FileText className="size-4" />
                Cotización
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateWorkOrder}
                disabled={isGeneratingDoc}
                className="flex items-center gap-2"
              >
                <FileText className="size-4" />
                Orden de Trabajo
              </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="general" className="w-full py-6">
            <TabsList className="mb-6 w-full border border-border/70 bg-muted/30 sm:grid sm:grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="costs">Costos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="changes">Cambios</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <div className="space-y-4">
                  <DetailSection title="Cliente" icon={User} color="blue">
                      <DetailItem icon={User} label="Nombre / Razón Social" value={toTitleCase(serviceData.client.name)} valueClass="text-lg" />
                      <DetailItem icon={Building} label="Departamento" value={serviceData.client.department} />
                      {serviceData.insuredName && (
                        <DetailItem icon={Shield} label="Asegurado" value={toTitleCase(serviceData.insuredName)} />
                      )}
                      <DetailItem icon={IdCard} label="RUT" value={serviceData.client.rut} />
                      <DetailItem icon={Phone} label="Teléfono" value={serviceData.client.phone} />
                      <DetailItem icon={Mail} label="Email" value={serviceData.client.email} />
                      <DetailItem icon={MapPin} label="Dirección" value={serviceData.client.address} isFullWidth={true} />
                      {(serviceData.contactPerson || (serviceData as any).contact_person) && (
                        <DetailItem icon={UserCheck} label="Persona en el Lugar" value={serviceData.contactPerson || (serviceData as any).contact_person} />
                      )}
                      {(serviceData.contactPhone || (serviceData as any).contact_phone) && (
                        <DetailItem icon={Phone} label="Teléfono Persona en el Lugar" value={serviceData.contactPhone || (serviceData as any).contact_phone} />
                      )}
                  </DetailSection>
                  <DetailSection title="Vehículo" icon={Truck} color="cyan">
                      <DetailItem icon={Truck} label="Referencia visible" value={formatVehicleInfo(serviceData)} />
                      {shouldShowVehicleInfo(serviceData) && (
                        <>
                          <DetailItem icon={Wrench} label="Marca y Modelo" value={`${serviceData.vehicleBrand} ${serviceData.vehicleModel}`} />
                          <DetailItem icon={IdCard} label="Patente" value={serviceData.licensePlate} valueClass="text-lg" />
                        </>
                      )}
                  </DetailSection>
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="mt-0">
              <div className="space-y-4">
                   <DetailSection title="Información del Servicio" icon={FileText} color="violet">
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
                  
                  {isCustody && custodyInfo && (
                      <DetailSection 
                        title={isEquipmentRental ? "Información de Arriendo" : "Información de Custodia"} 
                        icon={isEquipmentRental ? Wrench : Shield}
                        color="amber"
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
                          valueClass="text-lg text-success font-bold" 
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
                  )}
                  
                  {serviceData.outsourcedProviderId && (
                      <DetailSection title="Servicio Tercerizado" icon={Building} color="rose">
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
                  )}
                  
                  <DetailSection title="Recursos Asignados" icon={Truck} color="cyan">
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
                  
                  <DetailSection title="Finanzas" icon={DollarSign} color="emerald">
                        {serviceBreakdown.hasBothValues ? (
                          <>
                            <DetailItem 
                              icon={DollarSign} 
                              label="Valor Base del Servicio" 
                              value={formatCurrency(serviceBreakdown.baseValue)} 
                              valueClass="text-md text-info font-medium" 
                            />
                            <DetailItem 
                              icon={Shield} 
                              label="Valor de Custodia" 
                              value={formatCurrency(serviceBreakdown.custodyValue)} 
                              valueClass="text-md text-success font-medium" 
                            />
                            <DetailItem 
                              icon={DollarSign} 
                              label="Valor Total del Servicio" 
                              value={formatCurrency(displayServiceValue)} 
                              valueClass="border-t border-border pt-2 text-lg font-bold text-primary" 
                            />
                          </>
                        ) : (
                          <DetailItem 
                            icon={DollarSign} 
                            label={isCustody ? "Valor Total Servicio" : serviceData.hasExcess ? "Valor Total del Servicio" : "Valor del Servicio"} 
                            value={formatCurrency(displayServiceValue)} 
                            valueClass="text-lg text-primary font-bold" 
                          />
                        )}
                        {serviceData.hasExcess && serviceData.clientCoveredAmount && (
                          <>
                            <DetailItem 
                              icon={DollarSign} 
                              label="Monto Cubierto Cliente" 
                              value={formatCurrency(serviceData.clientCoveredAmount)} 
                              valueClass="text-md text-info font-medium" 
                            />
                            <DetailItem 
                              icon={DollarSign} 
                              label="Excedente" 
                              value={formatCurrency(displayServiceValue - (serviceData.clientCoveredAmount || 0))} 
                              valueClass="text-md text-warning font-medium" 
                            />
                          </>
                        )}
                         <DetailItem icon={DollarSign} label="Total Costos" value={formatCurrency(totalCosts)} valueClass="text-lg text-destructive font-bold" />
                         <DetailItem icon={DollarSign} label="Ganancia Neta" value={formatCurrency(netProfit)} valueClass={`text-lg font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}/>
                  </DetailSection>

                  {serviceData.observations && (
                      <DetailSection title="Observaciones" icon={FileText} color="orange">
                         <p className="text-muted-foreground whitespace-pre-wrap col-span-2">{serviceData.observations}</p>
                      </DetailSection>
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
