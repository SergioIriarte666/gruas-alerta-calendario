import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePickerInput from '@/components/common/DatePickerInput';
import { CreditCard, Banknote } from 'lucide-react';

interface XMLPaymentConfigProps {
  paymentType: 'credit' | 'paid';
  onPaymentTypeChange: (type: 'credit' | 'paid') => void;
  creditDays: number;
  onCreditDaysChange: (days: number) => void;
  paidDate: string;
  onPaidDateChange: (date: string) => void;
  onApplyToAll: () => void;
  selectedCount: number;
  idPrefix?: string;
}

const XMLPaymentConfig: React.FC<XMLPaymentConfigProps> = ({
  paymentType,
  onPaymentTypeChange,
  creditDays,
  onCreditDaysChange,
  paidDate,
  onPaidDateChange,
  onApplyToAll,
  selectedCount,
  idPrefix = 'xml-payment',
}) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        Tipo de Pago
      </h4>

      <RadioGroup
        value={paymentType}
        onValueChange={(value) => onPaymentTypeChange(value as 'credit' | 'paid')}
        className="flex gap-6"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="credit" id={`${idPrefix}-credit`} />
          <Label htmlFor={`${idPrefix}-credit`} className="text-sm cursor-pointer">
            A Crédito (Pendiente)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paid" id={`${idPrefix}-paid`} />
          <Label htmlFor={`${idPrefix}-paid`} className="text-sm cursor-pointer">
            Contado / Ya Pagado
          </Label>
        </div>
      </RadioGroup>

      {/* Crédito: días de vencimiento */}
      {paymentType === 'credit' && (
        <div className="space-y-2 pl-6 border-l-2 border-muted">
          <label className="text-sm text-muted-foreground block">
            Días hasta vencimiento
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={creditDays === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCreditDaysChange(30)}
              className="w-12"
            >
              30
            </Button>
            <Input
              type="number"
              value={creditDays}
              onChange={(e) => onCreditDaysChange(parseInt(e.target.value) || 30)}
              className="w-20"
              min={1}
              max={365}
            />
            <span className="text-sm text-muted-foreground">días</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onApplyToAll}
              disabled={selectedCount === 0}
            >
              Aplicar a todos
            </Button>
          </div>
        </div>
      )}

      {/* Contado: fecha de pago */}
      {paymentType === 'paid' && (
        <div className="space-y-2 pl-6 border-l-2 border-green-200">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Banknote className="w-4 h-4 text-green-600" />
            Fecha de pago (por defecto: fecha de emisión del XML)
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <DatePickerInput
              value={paidDate}
              onChange={onPaidDateChange}
              placeholder="Fecha del XML"
              className="w-[200px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onApplyToAll}
              disabled={selectedCount === 0}
            >
              Aplicar a todos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Los documentos se importarán con estado "Pagado" y la fecha indicada.
          </p>
        </div>
      )}
    </div>
  );
};

export default XMLPaymentConfig;
