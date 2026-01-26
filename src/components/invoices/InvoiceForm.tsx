import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice, InvoiceStatus } from '@/types';
import { useClosuresForInvoices, ClosureWithClient } from '@/hooks/useClosuresForInvoices';
import { useInvoiceFormData } from '@/hooks/invoices/useInvoiceFormData';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { ChevronLeft, ChevronRight, Save, X, Receipt } from 'lucide-react';
import { InvoiceFormStepNavigation, getInvoiceFormSteps, InvoiceFormStep } from './form/InvoiceFormStepNavigation';
import { InvoiceSummaryPanel } from './form/InvoiceSummaryPanel';
import { InvoiceFormStep1 } from './form/InvoiceFormStep1';
import { InvoiceFormStep2 } from './form/InvoiceFormStep2';
import { InvoiceFormStep3 } from './form/InvoiceFormStep3';

const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const),
  paymentTermId: z.string().optional(),
  paymentDate: z.string().optional(),
  numeroFiscal: z.string().optional()
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
  const [currentStep, setCurrentStep] = useState(1);
  const isEditing = !!invoice;
  const { formData, shouldReset } = useInvoiceFormData({ invoice, preselectedClosureId });
  const { closures } = useClosuresForInvoices({ includeInvoiced: isEditing });
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  
  const { watch, setValue, formState: { errors, isSubmitting }, reset, handleSubmit } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: formData,
    mode: 'onChange'
  });

  useEffect(() => {
    if (shouldReset) {
      const resetFormData = invoice ? {
        closureId: invoice.closureId || '',
        issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: invoice.status || 'draft' as InvoiceStatus,
        paymentTermId: invoice.paymentTermId || undefined,
        paymentDate: invoice.paymentDate || '',
        numeroFiscal: invoice.numeroFiscal || ''
      } : {
        closureId: preselectedClosureId || '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft' as InvoiceStatus,
        paymentTermId: undefined,
        paymentDate: '',
        numeroFiscal: ''
      };
      reset(resetFormData);
    }
  }, [shouldReset, invoice?.id, preselectedClosureId, reset]);

  const getEditableFields = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid': return { canEditClosure: false, canEditDates: false, canEditNumeroFiscal: false, canEditStatus: true, canEditPaymentDate: true };
      case 'cancelled': return { canEditClosure: false, canEditDates: false, canEditNumeroFiscal: false, canEditStatus: true, canEditPaymentDate: false };
      default: return { canEditClosure: true, canEditDates: true, canEditNumeroFiscal: true, canEditStatus: true, canEditPaymentDate: false };
    }
  };

  const editableFields = isEditing && invoice ? getEditableFields(invoice.status) : {
    canEditClosure: true, canEditDates: true, canEditNumeroFiscal: true, canEditStatus: true, canEditPaymentDate: false
  };

  const selectedClosureId = watch('closureId');
  const selectedClosure = useMemo(() => closures.find(c => c.id === selectedClosureId), [closures, selectedClosureId]);
  
  const { subtotal, vat, total } = useMemo(() => {
    const subtotalValue = Math.round(selectedClosure?.total || 0);
    const vatValue = Math.round(subtotalValue * 0.19);
    return { subtotal: subtotalValue, vat: vatValue, total: subtotalValue + vatValue };
  }, [selectedClosure?.total]);

  const handleFormSubmit = useCallback(async (data: InvoiceFormData) => {
    if (!selectedClosure) throw new Error('Debe seleccionar un cierre');
    await onSubmit({ ...data, subtotal, vat, total, clientId: selectedClosure.clientId });
  }, [selectedClosure, subtotal, vat, total, onSubmit]);

  useEffect(() => {
    const termId = watch('paymentTermId');
    const issueDate = watch('issueDate');
    if (termId && issueDate && !isEditing) {
      const term = paymentTerms.find(t => t.id === termId);
      if (term && term.days > 0) {
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + term.days);
        setValue('dueDate', dueDate.toISOString().split('T')[0]);
      }
    }
  }, [watch('paymentTermId'), watch('issueDate'), paymentTerms, setValue, isEditing]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return watch('closureId') !== '';
      case 2: return watch('issueDate') !== '' && watch('dueDate') !== '';
      case 3: return true;
      default: return true;
    }
  };

  const canGoNext = validateStep(currentStep);
  const canSubmit = validateStep(1) && validateStep(2) && validateStep(3);

  const steps: InvoiceFormStep[] = getInvoiceFormSteps().map(step => ({
    ...step,
    isCompleted: step.id < currentStep || (step.id === currentStep && validateStep(step.id)),
    hasError: false,
  }));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <InvoiceFormStep3 selectedClosureId={selectedClosureId} isEditing={isEditing} currentInvoice={invoice ? { id: invoice.id, closureId: invoice.closureId } : undefined} canEditClosure={editableFields.canEditClosure} subtotal={subtotal} vat={vat} total={total} showSummary={!!selectedClosure} onClosureChange={(v) => setValue('closureId', v)} errors={{ closureId: errors.closureId?.message }} />;
      case 2:
        return <InvoiceFormStep2 issueDate={watch('issueDate')} dueDate={watch('dueDate')} paymentDate={watch('paymentDate') || ''} paymentTermId={watch('paymentTermId') || ''} status={watch('status')} canEditDates={editableFields.canEditDates} canEditPaymentDate={editableFields.canEditPaymentDate} paymentTerms={paymentTerms} loadingTerms={loadingTerms} onIssueDateChange={(v) => setValue('issueDate', v)} onDueDateChange={(v) => setValue('dueDate', v)} onPaymentDateChange={(v) => setValue('paymentDate', v)} onPaymentTermIdChange={(v) => setValue('paymentTermId', v)} errors={{ issueDate: errors.issueDate?.message, dueDate: errors.dueDate?.message, paymentDate: errors.paymentDate?.message }} />;
      case 3:
        return <InvoiceFormStep1 status={watch('status')} numeroFiscal={watch('numeroFiscal') || ''} canEditStatus={editableFields.canEditStatus} canEditNumeroFiscal={editableFields.canEditNumeroFiscal} onStatusChange={(v) => setValue('status', v)} onNumeroFiscalChange={(v) => setValue('numeroFiscal', v)} errors={{ status: errors.status?.message, numeroFiscal: errors.numeroFiscal?.message }} />;
      default: return null;
    }
  };

  return (
    <Card className="bg-card border max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditing ? 'Editar Factura' : 'Nueva Factura'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-white/80 hover:text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              <div className="lg:col-span-1 space-y-4">
                <InvoiceFormStepNavigation steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />
                <InvoiceSummaryPanel status={watch('status')} numeroFiscal={watch('numeroFiscal') || ''} issueDate={watch('issueDate')} dueDate={watch('dueDate')} paymentDate={watch('paymentDate') || ''} clientName={selectedClosure?.clientName || ''} closureFolio={selectedClosure?.folio || ''} subtotal={subtotal} vat={vat} total={total} isEditing={isEditing} />
              </div>
              <div className="lg:col-span-2">{renderStepContent()}</div>
            </div>
          </div>

          <div className="border-t bg-card p-4 flex-shrink-0 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)} disabled={currentStep === 1} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={() => canGoNext && setCurrentStep(currentStep + 1)} disabled={!canGoNext} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit(handleFormSubmit)} disabled={!canSubmit || isSubmitting || isLoading} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 min-w-[140px]">
                    <Save className="h-4 w-4" />
                    {isSubmitting || isLoading ? 'Guardando...' : `${isEditing ? 'Actualizar' : 'Crear'} Factura`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
