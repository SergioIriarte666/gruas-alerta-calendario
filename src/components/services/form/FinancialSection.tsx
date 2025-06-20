
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FinancialSectionProps {
  value: number;
  onValueChange: (value: number) => void;
  operatorCommission: number;
  onOperatorCommissionChange: (value: number) => void;
  disabled?: boolean;
}

export const FinancialSection = ({
  value,
  onValueChange,
  operatorCommission,
  onOperatorCommissionChange,
  disabled = false
}: FinancialSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Valor del Servicio */}
      <div className="space-y-2">
        <Label htmlFor="value">Valor del Servicio (CLP)</Label>
        <Input
          id="value"
          type="number"
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          placeholder="150000"
          required
          disabled={disabled}
        />
      </div>

      {/* Comisión del Operador */}
      <div className="space-y-2">
        <Label htmlFor="operatorCommission">Comisión Operador (CLP)</Label>
        <Input
          id="operatorCommission"
          type="number"
          value={operatorCommission}
          onChange={(e) => onOperatorCommissionChange(Number(e.target.value))}
          placeholder="15000"
          required
          disabled={disabled}
        />
      </div>
    </div>
  );
};
