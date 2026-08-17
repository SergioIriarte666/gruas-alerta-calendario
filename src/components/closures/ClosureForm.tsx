import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServicesForClosures } from '@/hooks/useServicesForClosures';
import { EXCESS_ROW_SUFFIX } from '@/utils/closureBilling';
import { toast } from 'sonner';
import { ServiceClosure, ClosureStatus } from '@/types';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import EnhancedServicesSelector from './EnhancedServicesSelector';
import { ClosureFormStepNavigation, getClosureFormSteps, ClosureFormStep } from './ClosureFormStepNavigation';
import { ClosureSummaryPanel } from './ClosureSummaryPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { detectPurchaseOrders, getPurchaseOrderSummary } from '@/utils/closureUtils';
import { useClients } from '@/hooks/useClients';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ClosureForm");
interface ClosureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (closure: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

interface FormData {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientId: string;
  serviceIds: string[];
  total: number;
  status: ClosureStatus;
  purchaseOrder: string;
}

const ClosureForm = ({
  open,
  onOpenChange,
  onSubmit
}: ClosureFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [servicesSearchTerm, setServicesSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>({
    dateFrom: undefined,
    dateTo: undefined,
    clientId: '',
    serviceIds: [],
    total: 0,
    status: 'open',
    purchaseOrder: ''
  });

  const { clients = [] } = useClients();
  const selectedClient = clients.find(c => c.id === formData.clientId);

  const {
    services,
    pendingServices,
    usedServiceIds,
    alreadyInClosureCount,
    previewLimited,
    loading: servicesLoading,
    completeService,
    completeMultipleServices,
    isGlobalSearch,
    processedServices,
    searchingProcessed,
    searchProcessedServices,
    clearProcessedServices
  } = useServicesForClosures({
    dateFrom: formData.dateFrom,
    dateTo: formData.dateTo,
    searchTerm: servicesSearchTerm,
    // El cliente acota la consulta en el servidor: sin esto la lista solo podía
    // filtrar la página de los servicios más recientes.
    clientId: formData.clientId,
    enabled: open
  });
  
  const [loading, setLoading] = useState(false);

  // Calculate step completion
  const steps = useMemo((): ClosureFormStep[] => {
    const baseSteps = getClosureFormSteps();
    
    const step1Complete = formData.serviceIds.length > 0;
    const step2Complete = !!formData.dateFrom && !!formData.dateTo;
    const step3Complete = true; // Details are optional

    const completionStatus = [step1Complete, step2Complete, step3Complete];
    
    return baseSteps.map((step, index) => ({
      ...step,
      isCompleted: completionStatus[index],
      hasError: false,
    }));
  }, [formData]);

  const handleSubmit = async () => {
    if (!formData.dateFrom || !formData.dateTo) return;
    if (formData.serviceIds.length === 0) return;

    setLoading(true);
    try {
      await onSubmit({
        dateRange: {
          from: toLocalDateString(formData.dateFrom),
          to: toLocalDateString(formData.dateTo)
        },
        clientId: formData.clientId || undefined,
        serviceIds: formData.serviceIds,
        total: formData.total,
        status: formData.status,
        purchaseOrder: formData.purchaseOrder || undefined
      });

      // Cerrar primero evita re-fetch pesado con enabled=true durante el reset del formulario
      onOpenChange(false);

      // Reset diferido para que el modal ya esté cerrado
      setTimeout(() => {
        setFormData({
          dateFrom: undefined,
          dateTo: undefined,
          clientId: '',
          serviceIds: [],
          total: 0,
          status: 'open',
          purchaseOrder: ''
        });
        setCurrentStep(1);
      }, 0);
    } catch (error) {
      logger.error('Error creating closure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      // Un cierre debe ser homogéneo: solo montos cubiertos o solo excedentes
      if (checked) {
        const disputedService = services.find(s => s.id === serviceId);
        if ((disputedService as any)?._disputeReason) {
          toast.error('No se puede incluir un servicio en disputa', {
            description: `En disputa: ${(disputedService as any)._disputeReason}`,
          });
          return prev;
        }
        if (prev.serviceIds.includes(serviceId)) {
          toast.error('Este servicio ya está incluido en este cierre con el mismo tipo de monto');
          return prev;
        }
        const isExcess = serviceId.endsWith(EXCESS_ROW_SUFFIX);
        const mixesTypes = prev.serviceIds.some(id => id.endsWith(EXCESS_ROW_SUFFIX) !== isExcess);
        if (mixesTypes) {
          toast.error('Un cierre no puede mezclar montos cubiertos y excedentes', {
            description: 'Crea un cierre separado para los excedentes.',
          });
          return prev;
        }
      }

      const newServiceIds = checked
        ? [...prev.serviceIds, serviceId]
        : prev.serviceIds.filter(id => id !== serviceId);

      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = calculateClosureTotal(selectedServices);
      const detectedPO = detectPurchaseOrders(selectedServices);
      
      // Detectar cliente único de los servicios seleccionados
      let detectedClientId = prev.clientId;
      if (selectedServices.length > 0) {
        const clientIds = [...new Set(selectedServices.map(s => s.client?.id).filter(Boolean))];
        // Si todos los servicios tienen el mismo cliente, auto-rellenar
        if (clientIds.length === 1 && clientIds[0]) {
          detectedClientId = clientIds[0];
        }
      } else {
        // Si no hay servicios seleccionados, limpiar cliente
        detectedClientId = '';
      }
      
      return {
        ...prev,
        serviceIds: newServiceIds,
        total,
        purchaseOrder: detectedPO,
        clientId: detectedClientId
      };
    });
  };

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      clientId,
      serviceIds: [],
      total: 0
    }));
  };

  const handleDateFromChange = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      dateFrom: date,
      serviceIds: [],
      total: 0
    }));
  };

  const handleDateToChange = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      dateTo: date,
      serviceIds: [],
      total: 0
    }));
  };

  const handleAutoFillDates = (dateFrom: Date, dateTo: Date) => {
    setFormData(prev => ({
      ...prev,
      dateFrom,
      dateTo
    }));
    // Navigate to step 2 (Período) to show the auto-filled dates
    setCurrentStep(2);
  };

  const handleNextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isFormValid = formData.dateFrom && formData.dateTo && formData.serviceIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Alto fijo + min-h-0 en cada nivel: sin eso los `h-full` encadenados
          colapsaban y el cuerpo se recortaba sin barra de desplazamiento. */}
      <DialogContent className="finance-dialog bg-card border max-w-5xl h-[85dvh] flex flex-col overflow-hidden gap-0 p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary-soft to-primary/10 px-6 py-4 pr-12">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Nuevo Cierre de Servicios
          </DialogTitle>
          <p className="text-muted-foreground">
            Agrupa servicios completados para facturación
          </p>
        </DialogHeader>

        {/* Cuerpo: en móvil desplaza completo, en escritorio cada columna aparte */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-4 lg:overflow-hidden">
          {/* Left Sidebar */}
          <div className="shrink-0 space-y-4 border-b bg-muted/30 p-4 lg:col-span-1 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <ClosureFormStepNavigation
              steps={steps}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />

            <div className="hidden lg:block">
              <ClosureSummaryPanel
                dateFrom={formData.dateFrom}
                dateTo={formData.dateTo}
                clientName={selectedClient?.name || ''}
                selectedCount={formData.serviceIds.length}
                total={formData.total}
                purchaseOrder={formData.purchaseOrder}
                status={formData.status}
              />
            </div>
          </div>

          {/* Right Content */}
          <div className="min-h-0 lg:col-span-3 lg:overflow-y-auto">
            <div className="p-4 sm:p-6">
                    {/* Step 1: Cliente y Servicios */}
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        {/* El cliente acota la lista de abajo: va primero para no
                            quedar escondido al final del paso. */}
                        <ColoredSectionCard
                          title="Cliente (Opcional)"
                          icon={<AlertCircle className="size-4" />}
                          color="blue"
                        >
                          <ClientSelector
                            clientId={formData.clientId}
                            onClientChange={handleClientChange}
                          />
                        </ColoredSectionCard>

                        <ColoredSectionCard
                          title="Servicios Disponibles"
                          icon={<AlertCircle className="size-4" />}
                          color="green"
                          required
                        >
                          <EnhancedServicesSelector
                            services={services}
                            pendingServices={pendingServices}
                            loading={servicesLoading}
                            clientId={formData.clientId}
                            selectedServiceIds={formData.serviceIds}
                            onServiceToggle={handleServiceSelection}
                            onCompleteService={completeService}
                            onCompleteMultipleServices={completeMultipleServices}
                            alreadyInClosureCount={alreadyInClosureCount}
                            usedServiceIds={usedServiceIds}
                            isGlobalSearch={isGlobalSearch}
                            previewLimited={previewLimited}
                            onAutoFillDates={handleAutoFillDates}
                            onSearchTermChange={setServicesSearchTerm}
                            processedServices={processedServices}
                            searchingProcessed={searchingProcessed}
                            onSearchProcessed={searchProcessedServices}
                            onClearProcessed={clearProcessedServices}
                          />
                        </ColoredSectionCard>
                      </div>
                    )}

                    {/* Step 2: Período */}
                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <Alert className="border border-primary/30 bg-primary-soft">
                          <AlertCircle className="size-4 text-primary" />
                          <AlertDescription className="text-muted-foreground">
                            Solo se pueden incluir montos pendientes de facturar. En servicios con excedente, la cobertura y el excedente se cierran por separado.
                          </AlertDescription>
                        </Alert>

                        <ColoredSectionCard
                          title="Período del Cierre"
                          icon={<AlertCircle className="size-4" />}
                          color="purple"
                          required
                        >
                          <DateRangePicker 
                            dateFrom={formData.dateFrom} 
                            dateTo={formData.dateTo} 
                            onDateFromChange={handleDateFromChange} 
                            onDateToChange={handleDateToChange} 
                          />
                        </ColoredSectionCard>
                      </div>
                    )}

                    {/* Step 3: Detalles */}
                    {currentStep === 3 && (
                      <div className="space-y-4">
                        <ColoredSectionCard
                          title="Orden de Compra"
                          icon={<AlertCircle className="size-4" />}
                          color="orange"
                        >
                          <div className="space-y-2">
                            <Label className="text-foreground">
                              Orden de Compra 
                              {formData.serviceIds.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Auto-detectada de servicios)
                                </span>
                              )}
                            </Label>
                            <Input 
                              type="text" 
                              placeholder="Ej: OC-2024-001"
                              value={formData.purchaseOrder} 
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                purchaseOrder: e.target.value
                              }))} 
                            />
                            {formData.serviceIds.length > 0 && formData.purchaseOrder && (
                              <div className="text-xs text-muted-foreground">
                                {getPurchaseOrderSummary(services.filter(s => formData.serviceIds.includes(s.id)))}
                              </div>
                            )}
                          </div>
                        </ColoredSectionCard>

                        <ColoredSectionCard
                          title="Total y Estado"
                          icon={<AlertCircle className="size-4" />}
                          color="cyan"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-foreground">Total</Label>
                              <Input 
                                type="number" 
                                value={formData.total} 
                                readOnly 
                                className="font-mono text-lg"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-foreground">Estado</Label>
                              <Select 
                                value={formData.status} 
                                onValueChange={(value: ClosureStatus) => setFormData(prev => ({
                                  ...prev,
                                  status: value
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Abierto</SelectItem>
                                  <SelectItem value="closed">Cerrado</SelectItem>
                                  <SelectItem value="invoiced">Facturado</SelectItem>
                                  <SelectItem value="quoted">Cotizado</SelectItem>
                                  <SelectItem value="purchase_order_pending">Esperando OC</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </ColoredSectionCard>
                      </div>
                    )}
            </div>
          </div>
        </div>

        {/* Footer: fuera del cuerpo desplazable, visible en todo viewport */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          <span className="text-sm text-muted-foreground">
            Paso {currentStep} de 3
          </span>

          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isFormValid}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Crear Cierre
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureForm;
