import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice, InvoiceStatus } from '@/types';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useInvoiceFormData } from '@/hooks/invoices/useInvoiceFormData';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { ChevronLeft, ChevronRight, Save, X, Receipt } from 'lucide-react';
import { InvoiceFormStepNavigation, getInvoiceFormSteps, InvoiceFormStep } from './form/InvoiceFormStepNavigation';
import { InvoiceSummaryPanel } from './form/InvoiceSummaryPanel';
import { InvoiceFormStep1 } from './form/InvoiceFormStep1';
import { InvoiceFormStep2 } from './form/InvoiceFormStep2';
import { InvoiceFormStep3 } from './form/InvoiceFormStep3';

import { toLocalDateString, getTodayLocal, safeParseDateOnly } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { addDays } from 'date-fns';

const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const),
  paymentTermId: z.string().optional(),
  paymentDate: z.string().optional(),
  numeroFiscal: z.string().optional(),
  productServiceDescription: z.string().trim().min(10, 'Debe tener al menos 10 caracteres').max(500, 'Debe tener máximo 500 caracteres')
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
  const { closures, loading: closuresLoading } = useClosuresForInvoices({ includeInvoiced: isEditing });
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
        issueDate: invoice.issueDate || getTodayLocal(),
        dueDate: invoice.dueDate || toLocalDateString(addDays(businessClock.todayDate(), 30)),
        status: invoice.status || 'draft' as InvoiceStatus,
        paymentTermId: invoice.paymentTermId || undefined,
        paymentDate: invoice.paymentDate || '',
        numeroFiscal: invoice.numeroFiscal || ''
      } : {
        closureId: preselectedClosureId || '',
        issueDate: getTodayLocal(),
        dueDate: toLocalDateString(addDays(businessClock.todayDate(), 30)),
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
    canEditClosure: true, canEditDates: true, canEditNumeroFiscal: true, canEditStatus: true, canEditPaymentDate: true
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

  const watchedPaymentTermId = watch('paymentTermId');
  const watchedIssueDate = watch('issueDate');
  
  useEffect(() => {
    if (watchedPaymentTermId && watchedIssueDate && !isEditing) {
      const term = paymentTerms.find(t => t.id === watchedPaymentTermId);
      if (term && term.days >= 0) {
        const dueDate = safeParseDateOnly(watchedIssueDate);
        dueDate.setDate(dueDate.getDate() + term.days);
        setValue('dueDate', toLocalDateString(dueDate));
      }
    }
  }, [watchedPaymentTermId, watchedIssueDate, paymentTerms, setValue, isEditing]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return watch('closureId') !== '';
      case 2: return watch('issueDate') !== '' && watch('dueDate') !== '';
      case 3: {
        const desc = (watch('productServiceDescription') || '').trim();
        return desc.length >= 10 && desc.length <= 500;
      }
      default: return true;
    }
  };

  const canGoNext = validateStep(currentStep);
  const canSubmit = validateStep(1) && validateStep(2) && validateStep(3);

  const handleStatusChange = useCallback((status: InvoiceStatus) => {
    setValue('status', status);
    if (status === 'paid' && !watch('paymentDate')) {
      setValue('paymentDate', watch('issueDate') || getTodayLocal());
    }
  }, [setValue, watch]);

  const steps: InvoiceFormStep[] = getInvoiceFormSteps().map(step => ({
    ...step,
    isCompleted: step.id < currentStep || (step.id === currentStep && validateStep(step.id)),
    hasError: false,
  }));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <InvoiceFormStep3 selectedClosureId={selectedClosureId} isEditing={isEditing} currentInvoice={invoice ? { id: invoice.id, closureId: invoice.closureId } : undefined} canEditClosure={editableFields.canEditClosure} subtotal={subtotal} vat={vat} total={total} showSummary={!!selectedClosure} onClosureChange={(v) => setValue('closureId', v)} errors={{ closureId: errors.closureId?.message }} closures={closures} loading={closuresLoading} />;
      case 2:
        return <InvoiceFormStep2 issueDate={watch('issueDate')} dueDate={watch('dueDate')} paymentDate={watch('paymentDate') || ''} paymentTermId={watch('paymentTermId') || ''} status={watch('status')} canEditDates={editableFields.canEditDates} canEditPaymentDate={editableFields.canEditPaymentDate} paymentTerms={paymentTerms} loadingTerms={loadingTerms} onIssueDateChange={(v) => setValue('issueDate', v)} onDueDateChange={(v) => setValue('dueDate', v)} onPaymentDateChange={(v) => setValue('paymentDate', v)} onPaymentTermIdChange={(v) => setValue('paymentTermId', v)} errors={{ issueDate: errors.issueDate?.message, dueDate: errors.dueDate?.message, paymentDate: errors.paymentDate?.message }} />;
      case 3:
        return <InvoiceFormStep1 status={watch('status')} numeroFiscal={watch('numeroFiscal') || ''} productServiceDescription={watch('productServiceDescription') || ''} canEditStatus={editableFields.canEditStatus} canEditNumeroFiscal={editableFields.canEditNumeroFiscal} onStatusChange={handleStatusChange} onNumeroFiscalChange={(v: string) => setValue('numeroFiscal', v)} onProductServiceDescriptionChange={(v: string) => setValue('productServiceDescription', v)} errors={{ status: errors.status?.message, numeroFiscal: errors.numeroFiscal?.message, productServiceDescription: errors.productServiceDescription?.message } as any} />;
      default: return null;
    }
  };

  return (
    <Card className="flex max-h-[90vh] flex-col overflow-hidden border-border/70 bg-card">
      <CardHeader className="flex-shrink-0 border-b border-border/70 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="size-5 text-primary" />
            {isEditing ? 'Editar Factura' : 'Nueva Factura'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="size-4" />
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

          <div className="sticky bottom-0 flex-shrink-0 border-t border-border/70 bg-card p-4 shadow-md">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)} disabled={currentStep === 1} className="gap-2 border-border/70 bg-background/60">
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="border-border/70 bg-background/60" onClick={onCancel}>Cancelar</Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={() => setCurrentStep(prev => Math.min(prev + 1, 3))} disabled={!canGoNext} className="gap-2">
                    Siguiente <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit(handleFormSubmit)} disabled={!canSubmit || isSubmitting || isLoading} className="min-w-36 gap-2">
                    <Save className="size-4" />
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
