import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServicesForClosures } from '@/hooks/useServicesForClosures';
import { ServiceClosure } from '@/types';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import ServicesSelector from './ServicesSelector';
import FormActions from './FormActions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
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
  status: 'open' | 'closed' | 'invoiced';
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
    status: 'open'
  });

  // Pass date range to the hook for filtering
  const {
    services,
    loading: servicesLoading,
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
        status: formData.status
      });

      // Reset form
      setFormData({
        dateFrom: undefined,
        dateTo: undefined,
        clientId: '',
        serviceIds: [],
        total: 0,
        status: 'open'
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

      // Calculate new total
      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = selectedServices.reduce((sum, service) => sum + service.value, 0);
      console.log('Updated service IDs:', newServiceIds, 'New total:', total);
      return {
        ...prev,
        serviceIds: newServiceIds,
        total
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card">
        <DialogHeader>
          <DialogTitle className="text-white">Nuevo Cierre de Servicios</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              Solo se pueden incluir servicios completados del rango de fechas seleccionado que no hayan sido facturados previamente.
              Una vez incluido en un cierre, el servicio no estará disponible para futuros cierres.
            </AlertDescription>
          </Alert>

          <DateRangePicker dateFrom={formData.dateFrom} dateTo={formData.dateTo} onDateFromChange={handleDateFromChange} onDateToChange={handleDateToChange} />

          <ClientSelector clientId={formData.clientId} onClientChange={handleClientChange} />

          <ServicesSelector services={services} loading={servicesLoading} clientId={formData.clientId} selectedServiceIds={formData.serviceIds} onServiceToggle={handleServiceSelection} />

          {/* Show validation error when no services are selected */}
          {formData.dateFrom && formData.dateTo && formData.serviceIds.length === 0 && !servicesLoading}

          {/* Total */}
          <div className="space-y-2">
            <Label className="text-gray-300">Total</Label>
            <Input type="number" value={formData.total} onChange={e => setFormData(prev => ({
            ...prev,
            total: Number(e.target.value)
          }))} className="bg-white/5 border-gray-700 text-white" readOnly />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-gray-300">Estado</Label>
            <Select value={formData.status} onValueChange={(value: 'open' | 'closed' | 'invoiced') => setFormData(prev => ({
            ...prev,
            status: value
          }))}>
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Abierto</SelectItem>
                <SelectItem value="closed">Cerrado</SelectItem>
                <SelectItem value="invoiced">Facturado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FormActions loading={loading} isFormValid={!!isFormValid} hasSelectedServices={formData.serviceIds.length > 0} selectedServicesCount={formData.serviceIds.length} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>;
};
export default ClosureForm;