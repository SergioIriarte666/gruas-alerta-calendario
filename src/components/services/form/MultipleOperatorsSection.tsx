import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { Operator } from '@/types';
import { ServiceOperator } from '@/types/serviceDetails';

interface MultipleOperatorsSectionProps {
  operators: ServiceOperator[];
  onOperatorsChange: (operators: ServiceOperator[]) => void;
  availableOperators: Operator[];
  operatorRequired?: boolean;
  disabled?: boolean;
  hasValidationError?: boolean;
  validationMessage?: string;
}
export const MultipleOperatorsSection = ({
  operators,
  onOperatorsChange,
  availableOperators,
  operatorRequired = false,
  disabled = false,
  hasValidationError = false,
  validationMessage
}: MultipleOperatorsSectionProps) => {
  const [nextId, setNextId] = useState(1);
  const addOperator = () => {
    const newOperator: ServiceOperator = {
      id: `temp-${nextId}`,
      operatorId: '',
      commission: 0,
      role: 'Principal',
      hours: 8
    };
    onOperatorsChange([...operators, newOperator]);
    setNextId(nextId + 1);
  };
  const removeOperator = (id: string) => {
    onOperatorsChange(operators.filter(op => op.id !== id));
  };
  const isExempt = (operatorId?: string) => {
    if (!operatorId) return false;
    const op = availableOperators.find(o => o.id === operatorId);
    return !!op?.commissionExempt;
  };
  const updateOperator = (id: string, field: keyof ServiceOperator, value: any) => {
    const updatedOperators = operators.map(op => {
      if (op.id !== id) return op;
      const next: ServiceOperator = { ...op, [field]: value };
      // Si se selecciona un operador exento, forzar comisión = 0
      if (field === 'operatorId' && isExempt(value as string)) {
        next.commission = 0;
      }
      return next;
    });
    onOperatorsChange(updatedOperators);
  };
  const getAvailableOperatorsForSelect = (currentOperatorId?: string) => {
    const usedOperatorIds = operators.filter(op => op.operatorId && op.operatorId !== currentOperatorId).map(op => op.operatorId);
    return availableOperators.filter(op => op.isActive && !usedOperatorIds.includes(op.id));
  };
  const getTotalCommissions = () => {
    return operators.reduce((total, op) => total + (op.commission || 0), 0);
  };
  return <Card className={`${hasValidationError ? 'border-destructive bg-destructive/5' : 'border-border/70 bg-card/80 shadow-sm'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className={`size-5 ${hasValidationError ? 'text-destructive' : 'text-primary'}`} />
          Operadores y Comisiones del Servicio
          {operatorRequired && <span className="text-red-500">*</span>}
          {hasValidationError && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Requerido
            </span>
          )}
        </CardTitle>
        {hasValidationError && validationMessage && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/30 flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {validationMessage}
          </div>
        )}
        {!hasValidationError && (
          <div className="rounded-lg border border-info/20 bg-info/10 p-2 text-sm text-foreground">
            <DollarSign className="mr-1 inline size-4 text-info" />
            <strong>Sistema Simplificado:</strong> Para servicios con un solo operador, la comisión se maneja en el campo principal del servicio.
            Esta sección es para servicios con múltiples operadores.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {operators.map((operator, index) => <div key={operator.id} className="space-y-4 rounded-lg border border-border/70 bg-background/50 p-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium flex items-center gap-2">
                <span className="rounded text-sm bg-primary/10 px-2 py-1 text-primary">
                  Operador {index + 1}
                </span>
                {operator.role && <span className="text-sm text-muted-foreground">({operator.role})</span>}
              </h4>
              {operators.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeOperator(operator.id)} disabled={disabled} className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 hover:text-danger">
                  <Trash2 className="size-4" />
                </Button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Selección de Operador */}
              <div className="space-y-2">
                <Label>Operador *</Label>
                <Select value={operator.operatorId} onValueChange={value => updateOperator(operator.id, 'operatorId', value)} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableOperatorsForSelect(operator.operatorId).map(op => <SelectItem key={op.id} value={op.id}>
                        <span className="flex items-center gap-2">
                          {op.name}
                          {op.commissionExempt && (
                            <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title="Exento de comisiones">
                              E
                            </span>
                          )}
                        </span>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Rol */}
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={operator.role || 'Principal'} onValueChange={value => updateOperator(operator.id, 'role', value)} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Principal">Principal</SelectItem>
                    <SelectItem value="Adicional">Adicional</SelectItem>
                    <SelectItem value="Auxiliar">Auxiliar</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Apoyo">Apoyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Horas */}
              <div className="space-y-2">
                <Label>Horas Trabajadas</Label>
                <Input type="number" value={operator.hours || 8} onChange={e => updateOperator(operator.id, 'hours', Number(e.target.value))} placeholder="8" min="0" step="0.5" disabled={disabled} />
              </div>

              {/* Comisión */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <DollarSign className="size-3 text-success" />
                  Comisión (CLP) {!isExempt(operator.operatorId) && '*'}
                </Label>
                <Input
                  type="number"
                  value={isExempt(operator.operatorId) ? 0 : operator.commission}
                  onChange={e => updateOperator(operator.id, 'commission', Number(e.target.value))}
                  placeholder="150000"
                  min="0"
                  disabled={disabled || isExempt(operator.operatorId)}
                  className="border-border/70 bg-background/60"
                />
                {isExempt(operator.operatorId) && (
                  <p className="text-xs text-primary">Operador exento de comisiones</p>
                )}
              </div>
            </div>
          </div>)}

        {/* Botón para agregar operador */}
        <div className="flex justify-between items-center border-t border-border/70 pt-4">
          <Button type="button" variant="outline" onClick={addOperator} disabled={disabled || operators.length >= 5} className="flex items-center gap-2 border-border/70 bg-background/60">
            <Plus className="size-4" />
            Agregar Operador
          </Button>

          {/* Total de comisiones */}
          <div className="text-right">
            <Label className="text-sm text-muted-foreground">Total Comisiones:</Label>
            <div className="flex items-center gap-1 text-lg font-bold text-success">
              <DollarSign className="size-4" />
              ${getTotalCommissions().toLocaleString('es-CL')} CLP
            </div>
          </div>
        </div>

        {operators.length >= 5 && <p className="text-sm text-muted-foreground">
            Máximo 5 operadores por servicio
          </p>}

        {/* Información importante */}
        
      </CardContent>
    </Card>;
};
