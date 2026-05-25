import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { CreditCard, Calendar } from 'lucide-react';
import { PaymentTerm } from '@/types';

interface XMLPaymentConfigProps {
  paymentTerms: PaymentTerm[];
  loadingTerms?: boolean;
  paymentTermId: string;
  onPaymentTermIdChange: (id: string) => void;
  issueDate: string;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  onApplyToAll: () => void;
  selectedCount: number;
}

const XMLPaymentConfig: React.FC<XMLPaymentConfigProps> = ({
  paymentTerms,
  loadingTerms = false,
  paymentTermId,
  onPaymentTermIdChange,
  issueDate,
  dueDate,
  onDueDateChange,
  onApplyToAll,
  selectedCount,
}) => {
  return (
    <div className="space-y-4">
      {/* Condición de Pago */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CreditCard className="size-4" />
          Condición de Pago (Opcional)
        </Label>
        <Select
          value={paymentTermId}
          onValueChange={onPaymentTermIdChange}
          disabled={loadingTerms}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Seleccionar condición de pago'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin condición (manual)</SelectItem>
            {paymentTerms.map((term) => (
              <SelectItem key={term.id} value={term.id}>
                {term.name} ({term.days} días)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Auto-calcula la fecha de vencimiento según los días configurados
        </p>
      </div>

      {/* Fechas */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="size-4" />
          Fechas
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Fecha de Emisión</label>
            <DatePickerInput
              value={issueDate}
              onChange={() => {}}
              disabled
              className="w-full opacity-70"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Fecha de Vencimiento</label>
            <DatePickerInput
              value={dueDate}
              onChange={onDueDateChange}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Aplicar a todos */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyToAll}
          disabled={selectedCount === 0}
        >
          Aplicar a todos los seleccionados ({selectedCount})
        </Button>
      </div>
    </div>
  );
};

export default XMLPaymentConfig;
