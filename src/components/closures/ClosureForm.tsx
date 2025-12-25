import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServicesForClosures } from '@/hooks/useServicesForClosures';
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
    totalCompleted,
    loading: servicesLoading,
    completeService,
    completeMultipleServices,
    refetch
  } = useServicesForClosures({
    dateFrom: formData.dateFrom,
    dateTo: formData.dateTo
  });
  
  const [loading, setLoading] = useState(false);

  // Calculate step completion
  const steps = useMemo((): ClosureFormStep[] => {
    const baseSteps = getClosureFormSteps();
    
    const step1Complete = !!formData.dateFrom && !!formData.dateTo;
    const step2Complete = formData.serviceIds.length > 0;
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
          from: formData.dateFrom.toISOString().split('T')[0],
          to: formData.dateTo.toISOString().split('T')[0]
        },
        clientId: formData.clientId || undefined,
        serviceIds: formData.serviceIds,
        total: formData.total,
        status: formData.status,
        purchaseOrder: formData.purchaseOrder || undefined
      });

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
      refetch();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating closure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      const newServiceIds = checked 
        ? [...prev.serviceIds, serviceId] 
        : prev.serviceIds.filter(id => id !== serviceId);

      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = calculateClosureTotal(selectedServices);
      const detectedPO = detectPurchaseOrders(selectedServices);
      
      return {
        ...prev,
        serviceIds: newServiceIds,
        total,
        purchaseOrder: detectedPO
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

  const handleNextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isFormValid = formData.dateFrom && formData.dateTo && formData.serviceIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Nuevo Cierre de Servicios
            </DialogTitle>
            <p className="text-muted-foreground">
              Agrupa servicios completados para facturación
            </p>
          </DialogHeader>

          {/* Main Content - 2 Column Layout */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
              {/* Left Sidebar */}
              <div className="lg:col-span-1 border-r bg-muted/30 p-4 overflow-y-auto space-y-4">
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
              <div className="lg:col-span-3 flex flex-col overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Período */}
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <Alert className="border border-violet-500/30 bg-violet-500/5">
                          <AlertCircle className="h-4 w-4 text-violet-600" />
                          <AlertDescription className="text-muted-foreground">
                            Solo se pueden incluir servicios completados del rango de fechas seleccionado que no hayan sido facturados previamente.
                          </AlertDescription>
                        </Alert>

                        <ColoredSectionCard
                          title="Período del Cierre"
                          icon={<AlertCircle className="h-4 w-4" />}
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

                    {/* Step 2: Cliente y Servicios */}
                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <ColoredSectionCard
                          title="Cliente (Opcional)"
                          icon={<AlertCircle className="h-4 w-4" />}
                          color="blue"
                        >
                          <ClientSelector 
                            clientId={formData.clientId} 
                            onClientChange={handleClientChange} 
                          />
                        </ColoredSectionCard>

                        <ColoredSectionCard
                          title="Servicios Disponibles"
                          icon={<AlertCircle className="h-4 w-4" />}
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
                            totalCompleted={totalCompleted}
                            usedServiceIds={usedServiceIds}
                          />
                        </ColoredSectionCard>
                      </div>
                    )}

                    {/* Step 3: Detalles */}
                    {currentStep === 3 && (
                      <div className="space-y-4">
                        <ColoredSectionCard
                          title="Orden de Compra"
                          icon={<AlertCircle className="h-4 w-4" />}
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
                          icon={<AlertCircle className="h-4 w-4" />}
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

                  {/* Footer */}
                  <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      disabled={currentStep === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>

                    <span className="text-sm text-muted-foreground">
                      Paso {currentStep} de 3
                    </span>

                    <div className="flex gap-2">
                      {currentStep < 3 ? (
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSubmit}
                          disabled={loading || !isFormValid}
                          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Crear Cierre
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureForm;
