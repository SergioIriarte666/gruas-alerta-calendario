
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
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import ClosureSelector from './ClosureSelector';
import InvoiceSummary from './InvoiceSummary';

const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const)
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSubmit: (data: InvoiceFormData & { subtotal: number; vat: number; total: number; clientId: string }) => void;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  onSubmit,
  onCancel
}) => {
  const { closures } = useClosuresForInvoices();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      closureId: invoice?.closureId || '',
      issueDate: invoice?.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: invoice?.status || 'draft'
    }
  });

  const selectedClosureId = watch('closureId');
  const selectedClosure = closures.find(c => c.id === selectedClosureId);
  
  // Calculate totals from selected closure
  const subtotal = selectedClosure?.total || 0;
  const vat = subtotal * 0.19; // 19% IVA
  const total = subtotal + vat;

  const handleFormSubmit = (data: InvoiceFormData) => {
    if (!selectedClosure) return;

    onSubmit({
      ...data,
      subtotal,
      vat,
      total,
      clientId: selectedClosure.clientId || ''
    });
  };

  const handleClosureChange = (closureId: string) => {
    setValue('closureId', closureId);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">
          {invoice ? 'Editar Factura' : 'Nueva Factura'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status" className="text-gray-300">Estado</Label>
              <Select onValueChange={(value) => setValue('status', value as InvoiceStatus)}>
                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
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
                <p className="text-sm text-red-400 mt-1">{errors.status.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="issueDate" className="text-gray-300">Fecha de Emisión</Label>
              <Input
                id="issueDate"
                type="date"
                {...register('issueDate')}
                className="mt-1 bg-white/5 border-gray-700 text-white"
              />
              {errors.issueDate && (
                <p className="text-sm text-red-400 mt-1">{errors.issueDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dueDate" className="text-gray-300">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                {...register('dueDate')}
                className="mt-1 bg-white/5 border-gray-700 text-white"
              />
              {errors.dueDate && (
                <p className="text-sm text-red-400 mt-1">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <ClosureSelector
            selectedClosureId={selectedClosureId}
            onClosureChange={handleClosureChange}
          />
          
          {errors.closureId && (
            <p className="text-sm text-red-400 mt-1">{errors.closureId.message}</p>
          )}

          {selectedClosure && (
            <InvoiceSummary
              subtotal={subtotal}
              vat={vat}
              total={total}
            />
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel} className="border-gray-700 text-gray-300 hover:text-white">
              Cancelar
            </Button>
            <Button type="submit" className="bg-tms-green hover:bg-tms-green/90">
              {invoice ? 'Actualizar' : 'Crear'} Factura
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
