
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crane, Operator } from '@/types';

interface ResourceSectionProps {
  craneId: string;
  onCraneChange: (craneId: string) => void;
  cranes: Crane[];
  operatorId: string;
  onOperatorChange: (operatorId: string) => void;
  operators: Operator[];
  disabled?: boolean;
}

export const ResourceSection = ({
  craneId,
  onCraneChange,
  cranes,
  operatorId,
  onOperatorChange,
  operators,
  disabled = false
}: ResourceSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Grúa */}
      <div className="space-y-2">
        <Label htmlFor="crane">Grúa</Label>
        <Select value={craneId} onValueChange={onCraneChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar grúa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {cranes.filter(c => c.isActive).map((crane) => (
              <SelectItem key={crane.id} value={crane.id}>
                {crane.licensePlate} - {crane.brand} {crane.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operador */}
      <div className="space-y-2">
        <Label htmlFor="operator">Operador</Label>
        <Select value={operatorId} onValueChange={onOperatorChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar operador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {operators.filter(o => o.isActive).map((operator) => (
              <SelectItem key={operator.id} value={operator.id}>
                {operator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
