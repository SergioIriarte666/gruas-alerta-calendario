import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServicesForClosures } from '@/hooks/useServicesForClosures';
import { ServiceClosure, ClosureStatus } from '@/types';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import EnhancedServicesSelector from './EnhancedServicesSelector';
import FormActions from './FormActions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { detectPurchaseOrders, getPurchaseOrderSummary } from '@/utils/closureUtils';

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
  const [formData, setFormData] = useState<FormData>({
    dateFrom: undefined,
    dateTo: undefined,
    clientId: '',
    serviceIds: [],
    total: 0,
    status: 'open',
    purchaseOrder: ''
  });

  // Pass date range to the hook for filtering
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
  console.log('ClosureForm render - open:', open, 'servicesLoading:', servicesLoading, 'services count:', services.length);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dateFrom || !formData.dateTo) return;

    // Validate that at least one service is selected
    if (formData.serviceIds.length === 0) {
      console.log('No services selected, preventing submission');
      return;
    }
    console.log('Submitting closure form with data:', formData);
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

      // Reset form
      setFormData({
        dateFrom: undefined,
        dateTo: undefined,
        clientId: '',
        serviceIds: [],
        total: 0,
        status: 'open',
        purchaseOrder: ''
      });

      // Refresh available services after creating closure
      refetch();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating closure:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    console.log('Service selection changed:', serviceId, checked);
    setFormData(prev => {
      const newServiceIds = checked ? [...prev.serviceIds, serviceId] : prev.serviceIds.filter(id => id !== serviceId);

      // Calculate new total using closure-specific value calculation (includes excess)
      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = calculateClosureTotal(selectedServices);
      
      // Auto-detect purchase orders from selected services
      const detectedPO = detectPurchaseOrders(selectedServices);
      
      console.log('Updated service IDs:', newServiceIds, 'New total:', total, 'Detected PO:', detectedPO);
      return {
        ...prev,
        serviceIds: newServiceIds,
        total,
        purchaseOrder: detectedPO
      };
    });
  };
  const handleClientChange = (clientId: string) => {
    console.log('Client changed:', clientId);
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

  // Updated validation: require dates AND at least one service selected
  const isFormValid = formData.dateFrom && formData.dateTo && formData.serviceIds.length > 0;
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b">
          <DialogTitle className="text-foreground">Nuevo Cierre de Servicios</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert className="border border-border bg-muted">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-muted-foreground">
              Solo se pueden incluir servicios completados del rango de fechas seleccionado que no hayan sido facturados previamente.
              Una vez incluido en un cierre, el servicio no estará disponible para futuros cierres.
            </AlertDescription>
          </Alert>

          <DateRangePicker dateFrom={formData.dateFrom} dateTo={formData.dateTo} onDateFromChange={handleDateFromChange} onDateToChange={handleDateToChange} />

          <ClientSelector clientId={formData.clientId} onClientChange={handleClientChange} />

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

          {/* Show validation error when no services are selected */}
          {formData.dateFrom && formData.dateTo && formData.serviceIds.length === 0 && !servicesLoading}

          {/* Purchase Order */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Orden de Compra 
              {formData.serviceIds.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Auto-detectada de servicios seleccionados)
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
              className="placeholder:text-muted-foreground" 
            />
            {formData.serviceIds.length > 0 && formData.purchaseOrder && (
              <div className="text-xs text-muted-foreground">
                {getPurchaseOrderSummary(services.filter(s => formData.serviceIds.includes(s.id)))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="space-y-2">
            <Label className="text-foreground">Total</Label>
            <Input type="number" value={formData.total} onChange={e => setFormData(prev => ({
            ...prev,
            total: Number(e.target.value)
          }))} className="" readOnly />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-foreground">Estado</Label>
            <Select value={formData.status} onValueChange={(value: ClosureStatus) => setFormData(prev => ({
              ...prev,
              status: value
            }))}>
              <SelectTrigger className="">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Abierto</SelectItem>
                <SelectItem value="closed">Cerrado</SelectItem>
                <SelectItem value="invoiced">Facturado</SelectItem>
                <SelectItem value="quoted">Cotizado</SelectItem>
                <SelectItem value="purchase_order_pending">Esperando Orden de Compra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FormActions loading={loading} isFormValid={!!isFormValid} hasSelectedServices={formData.serviceIds.length > 0} selectedServicesCount={formData.serviceIds.length} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>;
};
export default ClosureForm;