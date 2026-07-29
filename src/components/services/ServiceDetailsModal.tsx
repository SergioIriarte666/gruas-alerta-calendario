
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
  MessageCircle,
  AlertTriangle,
  Pencil,
  Plus,
  ExternalLink,
  Share2,
  Route
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClients } from '@/hooks/useClients';
import { ClientForm } from '@/components/clients/ClientForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleHistory } from './VehicleHistory';
import { ServiceChangeHistory } from './ServiceChangeHistory';
import { ServiceCostsSection } from './ServiceCostsSection';
import { ClientNotificationsToggle } from './ClientNotificationsToggle';
import { ServiceDocumentsSection } from './ServiceDocumentsSection';
import { ServiceHandoffPanel } from './ServiceHandoffPanel';
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
import { ServiceItemsTab } from './ServiceItemsTab';
import { useOpenServiceDisputes, useServiceDisputeHistory } from '@/hooks/services/useServiceDisputes';
import { useServiceSaleMargin } from '@/hooks/services/useServiceSaleMargin';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { MarkServiceDisputeModal } from './disputes/MarkServiceDisputeModal';
import { ResolveServiceDisputeModal } from './disputes/ResolveServiceDisputeModal';
import { DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';
import { useServiceLatestOperatorLocation } from '@/hooks/useServiceLatestOperatorLocation';
import { useServiceRouteMetrics } from '@/hooks/useServiceRouteMetrics';
import { CheckCircle2 } from 'lucide-react';
import {
  VENTA_PRODUCTOS_SERVICE_TYPE_ID,
  isItemsServiceType as supportsServiceItems,
} from '@/utils/pdf/serviceItemsData';


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

const formatCoordinate = (value: number) => value.toFixed(6);

const formatAccuracy = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'Sin precision reportada';
  return `+-${Math.round(value)} m`;
};

const buildGoogleMapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

const FINAL_SERVICE_STATUSES = ['completed', 'cancelled', 'invoiced', 'partially_invoiced'];

const formatKmCL = (value: number) =>
  `${value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

const formatDurationHumanized = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
};

interface RouteMetricsSectionProps {
  serviceId: string;
  status: string;
  isOpen: boolean;
}

const RouteMetricsSection = ({ serviceId, status, isOpen }: RouteMetricsSectionProps) => {
  const { data: routeMetrics, isLoading } = useServiceRouteMetrics(serviceId, isOpen);

  if (isLoading) return null;

  const hasBreakdown = routeMetrics?.en_route_distance_km != null && routeMetrics?.towing_distance_km != null;

  // Km por vía (Map Matching, Fase 2) acompañan al haversine (GPS), no lo
  // reemplazan. Si el matching quedó con baja confianza se muestra atenuado y
  // referencial. Si aún no se computó (NULL), solo se muestra el valor GPS.
  const matchedKm = routeMetrics?.matched_total_distance_km ?? null;
  const lowMatchConfidence = (routeMetrics?.matching_confidence ?? 1) < 0.5;
  const distanceValue = routeMetrics ? (
    matchedKm != null ? (
      <span>
        {formatKmCL(routeMetrics.total_distance_km)}{' '}
        <span className="font-normal text-muted-foreground">(GPS)</span>
        {' · '}
        {lowMatchConfidence ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help italic text-muted-foreground/70">
                  {formatKmCL(matchedKm)} (por vía)
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Baja confianza de matching — referencial.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span>
            {formatKmCL(matchedKm)}{' '}
            <span className="font-normal text-muted-foreground">(por vía)</span>
          </span>
        )}
      </span>
    ) : (
      formatKmCL(routeMetrics.total_distance_km)
    )
  ) : null;

  return (
    <DetailSection title="Recorrido" icon={Route} color="cyan">
      {routeMetrics ? (
        <>
          <DetailItem icon={Gauge} label="Distancia recorrida" value={distanceValue} />
          <DetailItem icon={Timer} label="Tiempo en servicio" value={formatDurationHumanized(routeMetrics.total_duration_minutes)} />
          {hasBreakdown && (
            <p className="col-span-1 text-sm text-muted-foreground md:col-span-2">
              Ida: {formatKmCL(routeMetrics.en_route_distance_km as number)} · {formatDurationHumanized(routeMetrics.en_route_duration_minutes as number)}
              {' — '}
              Traslado: {formatKmCL(routeMetrics.towing_distance_km as number)} · {formatDurationHumanized(routeMetrics.towing_duration_minutes as number)}
            </p>
          )}
          {routeMetrics.low_confidence && (
            <div className="col-span-1 md:col-span-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="cursor-help text-warning-text border-warning bg-warning-soft">
                      Datos parciales
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    El GPS tuvo huecos de señal durante este servicio; los valores pueden estar subestimados.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </>
      ) : (
        <p className="col-span-1 text-sm text-muted-foreground md:col-span-2">
          {FINAL_SERVICE_STATUSES.includes(status)
            ? 'Sin registro GPS para este servicio.'
            : 'El recorrido se calculará al cerrar el servicio.'}
        </p>
      )}
    </DetailSection>
  );
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

const NO_THIRD_PARTY = '__none__';

interface ThirdPartyPayerSectionProps {
  serviceId: string;
  thirdPartyClientId: string | null;
  thirdPartyClientName?: string | null;
  thirdPartyClientRut?: string | null;
}

// Selector inline del tercero pagador del excedente. Sin este dato no se puede
// generar el cierre de excedente en el módulo de Cierres.
const ThirdPartyPayerSection = ({
  serviceId,
  thirdPartyClientId,
  thirdPartyClientName,
  thirdPartyClientRut
}: ThirdPartyPayerSectionProps) => {
  const queryClient = useQueryClient();
  const { clients, createClient } = useClients();
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string>(thirdPartyClientId || NO_THIRD_PARTY);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = React.useState(false);

  React.useEffect(() => {
    setSelectedId(thirdPartyClientId || NO_THIRD_PARTY);
    setIsEditing(false);
  }, [thirdPartyClientId, serviceId]);

  const activeClients = React.useMemo(
    () => (clients || []).filter(c => c.isActive),
    [clients]
  );

  const resolvedClient = React.useMemo(() => {
    if (!thirdPartyClientId) return null;
    const fromList = (clients || []).find(c => c.id === thirdPartyClientId);
    if (fromList) {
      return { name: fromList.displayName ?? fromList.name, rut: fromList.rut };
    }
    if (thirdPartyClientName) {
      return { name: thirdPartyClientName, rut: thirdPartyClientRut || '' };
    }
    return null;
  }, [clients, thirdPartyClientId, thirdPartyClientName, thirdPartyClientRut]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newValue = selectedId === NO_THIRD_PARTY ? null : selectedId;
      const { error } = await supabase
        .from('services')
        .update({ third_party_client_id: newValue })
        .eq('id', serviceId);

      if (error) throw error;

      toast.success(newValue
        ? 'Tercero pagador del excedente asignado'
        : 'Tercero pagador del excedente removido');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceId] });
    } catch (error: any) {
      logger.error('Error actualizando tercero pagador:', error);
      toast.error('No se pudo guardar el tercero pagador', {
        description: error?.message || 'Error desconocido',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="col-span-1 md:col-span-2 space-y-3 rounded-md border border-warning/30 bg-warning/5 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Quién paga el excedente</Label>
        {thirdPartyClientId && (
          <Badge variant="outline" className="text-warning-text border-warning bg-warning-soft">
            Excedente asignado
          </Badge>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente que paga el excedente..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_THIRD_PARTY}>— Sin asignar —</SelectItem>
              {activeClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName ?? c.name}{c.rut ? ` · ${c.rut}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => {
                  setSelectedId(thirdPartyClientId || NO_THIRD_PARTY);
                  setIsEditing(false);
                }}
              >
                Cancelar
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="flex items-center gap-1 text-xs"
              disabled={isSaving}
              onClick={() => setIsClientFormOpen(true)}
            >
              <Plus className="size-3.5" />
              Agregar Cliente
            </Button>
          </div>

          {/* Modal de creación rápida de cliente; al crear se auto-selecciona */}
          <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-popover/95 p-0">
              <ClientForm
                onSubmit={async (data) => {
                  try {
                    const result = await createClient(data);
                    const newClientId = (result as any)?.clients?.[0]?.id;
                    if (newClientId) {
                      setSelectedId(newClientId);
                    }
                    setIsClientFormOpen(false);
                  } catch (error: any) {
                    logger.error('Error creando cliente desde modal de servicio:', error);
                  }
                }}
                onCancel={() => setIsClientFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {resolvedClient ? (
            <p className="text-sm text-muted-foreground">
              {toTitleCase(resolvedClient.name)}{resolvedClient.rut ? ` · ${resolvedClient.rut}` : ''}
            </p>
          ) : (
            <span className="text-sm text-warning-text flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Sin tercero asignado — no se puede generar cierre de excedente
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="flex items-center gap-1 text-xs"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-3.5" />
            {thirdPartyClientId ? 'Cambiar' : 'Asignar'}
          </Button>
        </div>
      )}
    </div>
  );
};

export const ServiceDetailsModal = ({ service, isOpen, onClose, onDuplicate }: ServiceDetailsModalProps) => {
  const { data: latestOperatorLocation } = useServiceLatestOperatorLocation(service?.id);
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

  const showItemsTab = supportsServiceItems(serviceData?.serviceType);
  
  // Refrescar datos al abrir. La antigua "sincronización silenciosa" de comisiones
  // (rpc force_commission_sync_for_service) se eliminó: era un write-path oculto
  // que creaba comisiones al abrir el modal. La generación de comisiones es
  // responsabilidad del trigger de BD y de la herramienta de reparación admin.
  useEffect(() => {
    if (isOpen && serviceData?.id) {
      queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    }
  }, [isOpen, serviceData?.id, queryClient]);

  // Hooks que deben ejecutarse SIEMPRE antes de cualquier early-return
  const { settings } = useSettings();
  const { isGenerating: isGeneratingDoc, generateAndDownload } = usePDFGeneration();

  const disputeServiceIds = React.useMemo(() => (service?.id ? [service.id] : []), [service?.id]);
  const { openDisputesByServiceId } = useOpenServiceDisputes(disputeServiceIds);
  const { disputes: disputeHistory } = useServiceDisputeHistory(service?.id);
  const currentDispute = service?.id ? openDisputesByServiceId.get(service.id) : undefined;
  const [showMarkDispute, setShowMarkDispute] = React.useState(false);
  const [showResolveDispute, setShowResolveDispute] = React.useState(false);

  const isProductSaleService = serviceData?.serviceType?.id === VENTA_PRODUCTOS_SERVICE_TYPE_ID
    || serviceData?.serviceType?.name === 'Venta de Productos';
  const { isAdmin } = useUserPermissions();
  const saleMargin = useServiceSaleMargin(
    serviceData?.id,
    Number(serviceData?.value || 0),
    isProductSaleService && isAdmin
  );

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

  const handleShareTracking = async () => {
    try {
      const { data: token, error } = await supabase.rpc('create_service_tracking_link', {
        p_service_id: serviceData.id,
      });

      if (error) throw error;

      await navigator.clipboard.writeText(`https://app.gruas5norte.cl/track/${token}`);
      toast.success('Link de seguimiento copiado');
    } catch (err) {
      logger.error('[ServiceDetailsModal] Error generando link de seguimiento:', err);
      const message = typeof (err as { message?: unknown })?.message === 'string'
        ? (err as { message: string }).message
        : 'No se pudo generar el link de seguimiento';
      toast.error(message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] max-w-7xl w-[95vw] flex-col border-border/70 bg-card p-0">
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
              {/* Visible ⟺ estado operacional activo + operador asignado.
                  Nunca condicionar por categoría del tipo de servicio: el
                  edge function service-tracking soporta cualquier servicio
                  (incl. in_situ como Taxi) en estos estados. isAdmin se
                  mantiene porque create_service_tracking_link exige admin. */}
              {isAdmin
                && (serviceData.status === 'pending' || serviceData.status === 'in_progress' || serviceData.status === 'inspection_completed')
                && !!primaryOperator?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleShareTracking()}
                  className="flex items-center gap-2"
                >
                  <Share2 className="size-4" />
                  Compartir seguimiento
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
              {currentDispute ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResolveDispute(true)}
                  className="flex items-center gap-2 border-success/30 text-success-text hover:bg-success/90"
                >
                  <CheckCircle2 className="size-4" />
                  Resolver Disputa
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMarkDispute(true)}
                  className="flex items-center gap-2 border-warning/30 text-warning-text hover:bg-warning/90"
                >
                  <AlertTriangle className="size-4" />
                  Marcar en Disputa
                </Button>
              )}
              {/* Interruptor, no botón: es un ESTADO del servicio, no una
                  acción. Va al final de la barra y solo para admin. */}
              {isAdmin && (
                <ClientNotificationsToggle serviceId={serviceData.id} className="ml-auto" />
              )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <Tabs defaultValue="general" className="w-full py-6">
            <TabsList className={`mb-6 w-full border border-border/70 bg-muted/30 sm:grid ${showItemsTab ? 'sm:grid-cols-8' : 'sm:grid-cols-7'}`}>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="details">Detalles</TabsTrigger>
              {showItemsTab && <TabsTrigger value="items">Desglose</TabsTrigger>}
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="costs">Costos</TabsTrigger>
              <TabsTrigger value="disputes">
                Disputas
                {disputeHistory.length > 0 && (
                  <Badge variant={currentDispute ? 'destructive' : 'secondary'} className="ml-1.5 h-4 px-1 text-xs">
                    {disputeHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="changes">Cambios</TabsTrigger>
            </TabsList>
            
            <TabsContent value="documents" className="mt-0">
              <DetailSection title="Documentos del expediente" icon={FileText} color="blue">
                <div className="col-span-full">
                  <ServiceDocumentsSection serviceId={serviceData.id} folio={serviceData.folio} />
                </div>
              </DetailSection>
            </TabsContent>

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

                  {latestOperatorLocation && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-2"
                        >
                          <a
                            href={buildGoogleMapsUrl(
                              latestOperatorLocation.latitude,
                              latestOperatorLocation.longitude,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Abrir en Google Maps
                          </a>
                        </Button>
                      </div>
                      <DetailSection title="Última ubicación del operador" icon={MapPin} color="green">
                      <DetailItem
                        icon={Clock}
                        label="Última actualización"
                        value={formatForDisplayWithTime(latestOperatorLocation.recorded_at)}
                      />
                      <DetailItem
                        icon={Gauge}
                        label="Precisión"
                        value={formatAccuracy(latestOperatorLocation.accuracy_meters)}
                      />
                      <DetailItem
                        icon={MapPin}
                        label="Latitud"
                        value={formatCoordinate(latestOperatorLocation.latitude)}
                      />
                      <DetailItem
                        icon={MapPin}
                        label="Longitud"
                        value={formatCoordinate(latestOperatorLocation.longitude)}
                      />
                      <DetailItem
                        icon={FileText}
                        label="Origen del punto"
                        value={latestOperatorLocation.is_offline_sync ? 'Sincronizado después' : 'Enviado en línea'}
                        isFullWidth={true}
                      />
                      </DetailSection>
                    </div>
                  )}

                  <RouteMetricsSection
                    serviceId={serviceData.id}
                    status={serviceData.status}
                    isOpen={isOpen}
                  />

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
                        {serviceData.hasExcess && (
                          <ThirdPartyPayerSection
                            serviceId={serviceData.id}
                            thirdPartyClientId={serviceData.thirdPartyClientId || null}
                            thirdPartyClientName={(serviceData as any).thirdPartyClientName}
                            thirdPartyClientRut={(serviceData as any).thirdPartyClientRut}
                          />
                        )}
                         <DetailItem icon={DollarSign} label="Total Costos" value={formatCurrency(totalCosts)} valueClass="text-lg text-destructive font-bold" />
                         <DetailItem icon={DollarSign} label="Ganancia Neta" value={formatCurrency(netProfit)} valueClass={`text-lg font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}/>
                  </DetailSection>

                  {isProductSaleService && isAdmin && (
                      <DetailSection title="Margen de Venta de Productos" icon={DollarSign} color="emerald">
                         <DetailItem
                           icon={DollarSign}
                           label="Total Venta"
                           value={formatCurrency(saleMargin.saleTotal)}
                           valueClass="text-md text-info font-medium"
                         />
                         <DetailItem
                           icon={DollarSign}
                           label="Costo FIFO (bodega)"
                           value={saleMargin.isLoading ? '…' : formatCurrency(saleMargin.fifoCost)}
                           valueClass="text-md text-destructive font-medium"
                         />
                         <DetailItem
                           icon={DollarSign}
                           label="Margen"
                           value={saleMargin.isLoading ? '…' : formatCurrency(saleMargin.margin)}
                           valueClass={`text-lg font-bold ${saleMargin.margin >= 0 ? 'text-success' : 'text-destructive'}`}
                           isFullWidth
                         />
                      </DetailSection>
                  )}

                  {serviceData.observations && (
                      <DetailSection title="Observaciones" icon={FileText} color="orange">
                         <p className="text-muted-foreground whitespace-pre-wrap col-span-2">{serviceData.observations}</p>
                      </DetailSection>
                  )}
              </div>
            </TabsContent>

            {showItemsTab && (
              <TabsContent value="items" className="mt-0">
                <ServiceItemsTab
                  serviceId={serviceData.id}
                  readOnly={true}
                />
              </TabsContent>
            )}

            <TabsContent value="costs" className="mt-0">
              <ServiceCostsSection serviceId={serviceData.id} enhancedService={enhancedService} />
            </TabsContent>

            <TabsContent value="disputes" className="mt-0">
              {disputeHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Este servicio no tiene disputas registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {disputeHistory.map(dispute => (
                    <div
                      key={dispute.id}
                      className={`rounded-lg border p-3 text-sm space-y-1.5 ${
                        dispute.status === 'open' ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{DISPUTE_TYPE_LABELS[dispute.disputeType]}</span>
                        <Badge variant={dispute.status === 'open' ? 'destructive' : 'secondary'}>
                          {dispute.status === 'open' ? 'Abierta' : 'Resuelta'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{dispute.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {dispute.referenceDoc && <span>Referencia: {dispute.referenceDoc}</span>}
                        {dispute.disputedAmount != null && (
                          <span>Monto: {formatCurrency(dispute.disputedAmount)}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                        Marcada {formatForDisplayWithTime(dispute.createdAt)}
                        {dispute.createdByName && ` por ${dispute.createdByName}`}
                      </div>
                      {dispute.status === 'resolved' && (
                        <div className="text-xs text-muted-foreground">
                          Resuelta {dispute.resolvedAt ? formatForDisplayWithTime(dispute.resolvedAt) : ''}
                          {dispute.resolvedByName && ` por ${dispute.resolvedByName}`}
                          {dispute.resolutionNotes && (
                            <p className="mt-1 text-foreground">Notas: {dispute.resolutionNotes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-6">
               <ServiceHandoffPanel serviceId={serviceData.id} />
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
        </div>
      </DialogContent>

      <MarkServiceDisputeModal
        open={showMarkDispute}
        onOpenChange={setShowMarkDispute}
        serviceId={serviceData.id}
        serviceFolio={serviceData.folio}
      />
      <ResolveServiceDisputeModal
        open={showResolveDispute}
        onOpenChange={setShowResolveDispute}
        dispute={currentDispute || null}
        serviceFolio={serviceData.folio}
      />
    </Dialog>
  );
};
