
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useClients } from '@/hooks/useClients';
import { useServices } from '@/hooks/useServices';
import { ServiceClosure } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClosureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (closure: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const ClosureForm = ({ open, onOpenChange, onSubmit }: ClosureFormProps) => {
  const { clients } = useClients();
  const { services } = useServices();
  const [formData, setFormData] = useState({
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    clientId: '',
    serviceIds: [] as string[],
    total: 0,
    status: 'open' as const
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dateFrom || !formData.dateTo) return;

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
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating closure:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service => {
    if (!formData.clientId) return true;
    return service.client.id === formData.clientId;
  });

  const calculateTotal = () => {
    const selectedServices = services.filter(s => formData.serviceIds.includes(s.id));
    const total = selectedServices.reduce((sum, service) => sum + service.value, 0);
    setFormData(prev => ({ ...prev, total }));
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      const newServiceIds = checked 
        ? [...prev.serviceIds, serviceId]
        : prev.serviceIds.filter(id => id !== serviceId);
      
      // Calculate new total
      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = selectedServices.reduce((sum, service) => sum + service.value, 0);
      
      return { ...prev, serviceIds: newServiceIds, total };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card">
        <DialogHeader>
          <DialogTitle className="text-white">Nuevo Cierre de Servicios</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Fecha Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/5 border-gray-700 text-white",
                      !formData.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dateFrom ? format(formData.dateFrom, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dateFrom}
                    onSelect={(date) => setFormData(prev => ({ ...prev, dateFrom: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Fecha Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/5 border-gray-700 text-white",
                      !formData.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dateTo ? format(formData.dateTo, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dateTo}
                    onSelect={(date) => setFormData(prev => ({ ...prev, dateTo: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="text-gray-300">Cliente (Opcional)</Label>
            <Select value={formData.clientId} onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value, serviceIds: [] }))}>
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Services Selection */}
          <div className="space-y-2">
            <Label className="text-gray-300">Servicios</Label>
            <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
              {filteredServices.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay servicios disponibles</p>
              ) : (
                filteredServices.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id={service.id}
                      checked={formData.serviceIds.includes(service.id)}
                      onChange={(e) => handleServiceSelection(service.id, e.target.checked)}
                      className="text-tms-green"
                    />
                    <label htmlFor={service.id} className="text-sm text-gray-300 flex-1">
                      {service.folio} - {service.client.name} - ${service.value.toLocaleString()}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Total */}
          <div className="space-y-2">
            <Label className="text-gray-300">Total</Label>
            <Input
              type="number"
              value={formData.total}
              onChange={(e) => setFormData(prev => ({ ...prev, total: Number(e.target.value) }))}
              className="bg-white/5 border-gray-700 text-white"
              readOnly
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-gray-300">Estado</Label>
            <Select value={formData.status} onValueChange={(value: 'open' | 'closed' | 'invoiced') => setFormData(prev => ({ ...prev, status: value }))}>
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

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.dateFrom || !formData.dateTo}
              className="bg-tms-green hover:bg-tms-green/90"
            >
              {loading ? 'Creando...' : 'Crear Cierre'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureForm;
