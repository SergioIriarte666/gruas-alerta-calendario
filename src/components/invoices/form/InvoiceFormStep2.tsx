import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Calendar, CreditCard } from 'lucide-react';

interface PaymentTerm {
  id: string;
  name: string;
  days: number;
}

interface InvoiceFormStep2Props {
  issueDate: string;
  dueDate: string;
  paymentDate: string;
  paymentTermId: string;
  status: string;
  canEditDates: boolean;
  canEditPaymentDate: boolean;
  paymentTerms: PaymentTerm[];
  loadingTerms: boolean;
  onIssueDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPaymentDateChange: (value: string) => void;
  onPaymentTermIdChange: (value: string) => void;
  errors: {
    issueDate?: string;
    dueDate?: string;
    paymentDate?: string;
    paymentTermId?: string;
  };
}

export const InvoiceFormStep2 = ({ 
  issueDate,
  dueDate,
  paymentDate,
  paymentTermId,
  status,
  canEditDates,
  canEditPaymentDate,
  paymentTerms,
  loadingTerms,
  onIssueDateChange,
  onDueDateChange,
  onPaymentDateChange,
  onPaymentTermIdChange,
  errors 
}: InvoiceFormStep2Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Condiciones de Pago"
        icon={<CreditCard className="size-5" />}
        color="orange"
        hasError={!!errors.paymentTermId}
      >
        <div className="space-y-2">
          <Label htmlFor="paymentTermId" className="text-foreground">Condición de Pago (Opcional)</Label>
          <Select 
            onValueChange={onPaymentTermIdChange}
            value={paymentTermId || ''}
            disabled={!canEditDates || loadingTerms}
          >
            <SelectTrigger className="bg-background disabled:opacity-50 disabled:cursor-not-allowed">
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              {paymentTerms.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.name}
                  {term.days > 0 && ` (${term.days} días)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.paymentTermId && (
            <p className="text-sm text-destructive">{errors.paymentTermId}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Auto-calcula fecha de vencimiento según los días
          </p>
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Fechas"
        icon={<Calendar className="size-5" />}
        color="cyan"
        hasError={!!errors.issueDate || !!errors.dueDate}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="issueDate" className="text-foreground">Fecha de Emisión</Label>
            <DatePickerInput
              id="issueDate"
              value={issueDate}
              onChange={onIssueDateChange}
              disabled={!canEditDates}
              placeholder="Seleccionar fecha"
            />
            {errors.issueDate && (
              <p className="text-sm text-destructive">{errors.issueDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate" className="text-foreground">Fecha de Vencimiento</Label>
            <DatePickerInput
              id="dueDate"
              value={dueDate}
              onChange={onDueDateChange}
              disabled={!canEditDates}
              placeholder="Seleccionar fecha"
            />
            {errors.dueDate && (
              <p className="text-sm text-destructive">{errors.dueDate}</p>
            )}
          </div>
        </div>
      </ColoredSectionCard>

      {status === 'paid' && (
        <ColoredSectionCard
          title="Fecha de Pago"
          icon={<Calendar className="size-5" />}
          color="green"
          required
          hasError={!!errors.paymentDate}
        >
          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="text-foreground">Fecha de Pago</Label>
            <DatePickerInput
              id="paymentDate"
              value={paymentDate}
              onChange={onPaymentDateChange}
              disabled={!canEditPaymentDate}
              placeholder="Seleccionar fecha"
            />
            {errors.paymentDate && (
              <p className="text-sm text-destructive">{errors.paymentDate}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Fecha en que se recibió el pago
            </p>
          </div>
        </ColoredSectionCard>
      )}
    </div>
  );
};
