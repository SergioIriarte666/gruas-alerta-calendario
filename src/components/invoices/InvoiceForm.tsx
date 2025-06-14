
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice, InvoiceStatus } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useServices } from '@/hooks/useServices';

const invoiceSchema = z.object({
  serviceIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un servicio'),
  clientId: z.string().min(1, 'Cliente es requerido'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const)
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  invoice?: Invoice;
  onSubmit: (data: InvoiceFormData & { subtotal: number; vat: number; total: number }) => void;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  onSubmit,
  onCancel
}) => {
  const { clients } = useClients();
  const { services } = useServices();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      serviceIds: invoice?.serviceIds || [],
      clientId: invoice?.clientId || '',
      issueDate: invoice?.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: invoice?.status || 'draft'
    }
  });

  const selectedServiceIds = watch('serviceIds');
  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const subtotal = selectedServices.reduce((sum, service) => sum + service.value, 0);
  const vat = subtotal * 0.19; // 19% IVA
  const total = subtotal + vat;

  const handleFormSubmit = (data: InvoiceFormData) => {
    onSubmit({
      ...data,
      subtotal,
      vat,
      total
    });
  };

  const handleServiceToggle = (serviceId: string) => {
    const currentIds = selectedServiceIds;
    const newIds = currentIds.includes(serviceId)
      ? currentIds.filter(id => id !== serviceId)
      : [...currentIds, serviceId];
    setValue('serviceIds', newIds);
  };

  const activeClients = clients.filter(c => c.isActive);
  const availableServices = services.filter(s => s.status === 'completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {invoice ? 'Editar Factura' : 'Nueva Factura'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId">Cliente</Label>
              <Select onValueChange={(value) => setValue('clientId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clientId && (
                <p className="text-sm text-red-600 mt-1">{errors.clientId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Estado</Label>
              <Select onValueChange={(value) => setValue('status', value as InvoiceStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="issueDate">Fecha de Emisión</Label>
              <Input
                id="issueDate"
                type="date"
                {...register('issueDate')}
                className="mt-1"
              />
              {errors.issueDate && (
                <p className="text-sm text-red-600 mt-1">{errors.issueDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                {...register('dueDate')}
                className="mt-1"
              />
              {errors.dueDate && (
                <p className="text-sm text-red-600 mt-1">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Servicios a Facturar</Label>
            <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg p-4">
              {availableServices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay servicios completados disponibles</p>
              ) : (
                <div className="space-y-2">
                  {availableServices.map((service) => (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                        selectedServiceIds.includes(service.id) ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                      onClick={() => handleServiceToggle(service.id)}
                    >
                      <div>
                        <p className="font-medium">{service.folio}</p>
                        <p className="text-sm text-gray-600">{service.client.name}</p>
                        <p className="text-sm text-gray-500">{service.serviceDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${service.value.toLocaleString()}</p>
                        <input
                          type="checkbox"
                          checked={selectedServiceIds.includes(service.id)}
                          onChange={() => handleServiceToggle(service.id)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.serviceIds && (
              <p className="text-sm text-red-600 mt-1">{errors.serviceIds.message}</p>
            )}
          </div>

          {selectedServices.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Resumen de Facturación</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (19%):</span>
                  <span>${vat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {invoice ? 'Actualizar' : 'Crear'} Factura
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
