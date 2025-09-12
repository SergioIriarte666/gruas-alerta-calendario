
import React, { useEffect, useCallback, useMemo } from 'react';
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
import { useInvoiceFormData } from '@/hooks/invoices/useInvoiceFormData';
import EnhancedClosureSelector from './EnhancedClosureSelector';
import InvoiceSummary from './InvoiceSummary';

const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string()
    .min(1, 'Fecha de emisión es requerida')
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    }, 'Fecha de emisión inválida'),
  dueDate: z.string()
    .min(1, 'Fecha de vencimiento es requerida')
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    }, 'Fecha de vencimiento inválida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const),
  paymentDate: z.string()
    .optional()
    .refine((date) => {
      if (!date || date.trim() === '') return true;
      const d = new Date(date);
      return !isNaN(d.getTime());
    }, 'Fecha de pago inválida'),
  numeroFiscal: z.string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      return /^\d+$/.test(val.trim());
    }, 'El número fiscal debe contener solo números')
}).refine((data) => {
  const issueDate = new Date(data.issueDate);
  const dueDate = new Date(data.dueDate);
  return dueDate > issueDate;
}, {
  message: 'La fecha de vencimiento debe ser posterior a la fecha de emisión',
  path: ['dueDate']
}).refine((data) => {
  if (data.status === 'paid' && (!data.paymentDate || data.paymentDate.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'La fecha de pago es requerida cuando el estado es "pagada"',
  path: ['paymentDate']
}).refine((data) => {
  if (data.paymentDate && data.paymentDate.trim() !== '') {
    const issueDate = new Date(data.issueDate);
    const paymentDate = new Date(data.paymentDate);
    return paymentDate >= issueDate;
  }
  return true;
}, {
  message: 'La fecha de pago no puede ser anterior a la fecha de emisión',
  path: ['paymentDate']
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  preselectedClosureId?: string | null;
  onSubmit: (data: InvoiceFormData & { subtotal: number; vat: number; total: number; clientId: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  preselectedClosureId,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const isEditing = !!invoice;
  const { formData, shouldReset } = useInvoiceFormData({ invoice, preselectedClosureId });
  const { closures } = useClosuresForInvoices({ includeInvoiced: isEditing });
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
    trigger
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: formData,
    mode: 'onChange'
  });

  // Single effect to reset form only when needed
  useEffect(() => {
    if (shouldReset) {
      const resetFormData = invoice ? {
        closureId: invoice.closureId || '',
        issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: invoice.status || 'draft' as InvoiceStatus,
        paymentDate: invoice.paymentDate || '',
        numeroFiscal: invoice.numeroFiscal || ''
      } : {
        closureId: preselectedClosureId || '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft' as InvoiceStatus,
        paymentDate: '',
        numeroFiscal: ''
      };
      console.log('InvoiceForm - Resetting form with data:', resetFormData);
      reset(resetFormData);
    }
  }, [shouldReset, invoice?.id, preselectedClosureId, reset]);

  // Determine what can be edited based on invoice status
  const getEditableFields = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft':
        return {
          canEditClosure: true,
          canEditDates: true,
          canEditNumeroFiscal: true,
          canEditStatus: true,
          canEditPaymentDate: false,
          message: 'Factura en borrador - se puede editar completamente'
        };
      case 'sent':
        return {
          canEditClosure: true,
          canEditDates: true,
          canEditNumeroFiscal: true,
          canEditStatus: true,
          canEditPaymentDate: false,
          message: 'Factura enviada - se puede cambiar cierre, fechas, número fiscal y estado'
        };
      case 'paid':
        return {
          canEditClosure: false,
          canEditDates: false,
          canEditNumeroFiscal: false,
          canEditStatus: true,
          canEditPaymentDate: true,
          message: 'Factura pagada - se puede cambiar el estado y fecha de pago'
        };
      case 'overdue':
        return {
          canEditClosure: true,
          canEditDates: true,
          canEditNumeroFiscal: true,
          canEditStatus: true,
          canEditPaymentDate: false,
          message: 'Factura vencida - se puede cambiar cierre, fechas, número fiscal y estado'
        };
      case 'cancelled':
        return {
          canEditClosure: false,
          canEditDates: false,
          canEditNumeroFiscal: false,
          canEditStatus: true,
          canEditPaymentDate: false,
          message: 'Factura cancelada - solo se puede reactivar cambiando el estado'
        };
      default:
        return {
          canEditClosure: true,
          canEditDates: true,
          canEditNumeroFiscal: true,
          canEditStatus: true,
          canEditPaymentDate: false,
          message: ''
        };
    }
  };

  const editableFields = isEditing && invoice ? getEditableFields(invoice.status) : {
    canEditClosure: true,
    canEditDates: true,
    canEditNumeroFiscal: true,
    canEditStatus: true,
    canEditPaymentDate: false,
    message: ''
  };

  const selectedClosureId = watch('closureId');
  
  // Memoize selected closure to prevent recalculation
  const selectedClosure = useMemo(() => {
    return closures.find(c => c.id === selectedClosureId);
  }, [closures, selectedClosureId]);
  
  // Memoize calculated totals
  const { subtotal, vat, total } = useMemo(() => {
    const subtotalValue = Math.round(selectedClosure?.total || 0);
    const vatValue = Math.round(subtotalValue * 0.19); // 19% IVA
    const totalValue = subtotalValue + vatValue;
    
    return {
      subtotal: subtotalValue,
      vat: vatValue,
      total: totalValue
    };
  }, [selectedClosure?.total]);

  // Enhanced form submission with validation and loading states
  const handleFormSubmit = useCallback(async (data: InvoiceFormData) => {
    try {
      console.log('InvoiceForm - Starting form submission with data:', data);
      
      // Validate closure selection
      if (!selectedClosure) {
        console.error('InvoiceForm - No closure selected for submission');
        throw new Error('Debe seleccionar un cierre para continuar');
      }

      // Validate calculated totals
      if (subtotal < 0 || vat < 0 || total < 0) {
        throw new Error('Los montos calculados no pueden ser negativos');
      }

      // Validate client ID
      if (!selectedClosure.clientId) {
        throw new Error('El cierre seleccionado no tiene un cliente asociado válido');
      }

      // Additional validation for editing mode
      if (isEditing && invoice) {
        const editableFields = getEditableFields(invoice.status);
        
        if (!editableFields.canEditClosure && data.closureId !== invoice.closureId) {
          throw new Error('No se puede cambiar el cierre para facturas en este estado');
        }
        
        if (!editableFields.canEditDates && (data.issueDate !== invoice.issueDate || data.dueDate !== invoice.dueDate)) {
          throw new Error('No se pueden cambiar las fechas para facturas en este estado');
        }
      }

      const submitData = {
        ...data,
        subtotal,
        vat,
        total,
        clientId: selectedClosure.clientId,
        numeroFiscal: data.numeroFiscal?.trim() || undefined
      };
      
      console.log('InvoiceForm - Validated submit data:', submitData);
      await onSubmit(submitData);
    } catch (error: any) {
      console.error('InvoiceForm - Submission error:', error);
      // Error will be handled by parent component
      throw error;
    }
  }, [selectedClosure, subtotal, vat, total, onSubmit, isEditing, invoice]);

  // Enhanced closure change with validation
  const handleClosureChange = useCallback(async (closureId: string) => {
    setValue('closureId', closureId);
    // Trigger validation after closure change
    await trigger('closureId');
  }, [setValue, trigger]);

  // Enhanced status change with field validation
  const handleStatusChange = useCallback(async (value: string) => {
    setValue('status', value as InvoiceStatus);
    await trigger('status');
  }, [setValue, trigger]);

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">
          {isEditing ? 'Editar Factura' : 'Nueva Factura'}
          {preselectedClosureId && (
            <span className="text-sm font-normal text-primary ml-2">
              (Cierre preseleccionado)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editableFields.message && (
          <div className="mb-4 p-3 bg-muted border rounded-lg">
            <p className="text-base text-foreground font-medium">{editableFields.message}</p>
          </div>
        )}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status" className="text-foreground">Estado</Label>
              <Select 
                onValueChange={handleStatusChange}
                value={watch('status')}
                disabled={!editableFields.canEditStatus}
              >
                <SelectTrigger className="disabled:opacity-50 disabled:cursor-not-allowed">
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
                <p className="text-sm text-destructive mt-1">{errors.status.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="numeroFiscal" className="text-foreground">Número Fiscal (Opcional)</Label>
              <Input
                id="numeroFiscal"
                type="text"
                placeholder="Ej: 123456789"
                {...register('numeroFiscal')}
                disabled={!editableFields.canEditNumeroFiscal}
                className="mt-1 placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.numeroFiscal && (
                <p className="text-sm text-destructive mt-1">{errors.numeroFiscal.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Número fiscal para registro SII (opcional)
              </p>
            </div>

          {watch('status') === 'paid' && (
            <div>
              <Label htmlFor="paymentDate" className="text-foreground">Fecha de Pago</Label>
              <Input
                id="paymentDate"
                type="date"
                {...register('paymentDate')}
                disabled={!editableFields.canEditPaymentDate}
                className="mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.paymentDate && (
                <p className="text-sm text-destructive mt-1">{errors.paymentDate.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Fecha en que se recibió el pago
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="issueDate" className="text-foreground">Fecha de Emisión</Label>
            <Input
              id="issueDate"
              type="date"
              {...register('issueDate')}
              disabled={!editableFields.canEditDates}
              className="mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors.issueDate && (
              <p className="text-sm text-destructive mt-1">{errors.issueDate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="dueDate" className="text-foreground">Fecha de Vencimiento</Label>
            <Input
              id="dueDate"
              type="date"
              {...register('dueDate')}
              disabled={!editableFields.canEditDates}
              className="mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors.dueDate && (
              <p className="text-sm text-destructive mt-1">{errors.dueDate.message}</p>
            )}
          </div>
          </div>

          <EnhancedClosureSelector
            selectedClosureId={selectedClosureId}
            onClosureChange={handleClosureChange}
            isEditing={isEditing}
            currentInvoice={invoice ? { id: invoice.id, closureId: invoice.closureId } : undefined}
            disabled={!editableFields.canEditClosure}
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={!selectedClosure || isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                `${isEditing ? 'Actualizar' : 'Crear'} Factura`
              )}
            </Button>
            {!selectedClosure && (
              <p className="text-sm text-destructive mt-2">
                Debe seleccionar un cierre para continuar
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
