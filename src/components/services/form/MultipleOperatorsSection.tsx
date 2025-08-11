import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Users, DollarSign } from 'lucide-react';
import { Operator } from '@/types';
import { ServiceOperator } from '@/types/serviceDetails';
interface MultipleOperatorsSectionProps {
  operators: ServiceOperator[];
  onOperatorsChange: (operators: ServiceOperator[]) => void;
  availableOperators: Operator[];
  operatorRequired?: boolean;
  disabled?: boolean;
}
export const MultipleOperatorsSection = ({
  operators,
  onOperatorsChange,
  availableOperators,
  operatorRequired = false,
  disabled = false
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
  const updateOperator = (id: string, field: keyof ServiceOperator, value: any) => {
    const updatedOperators = operators.map(op => op.id === id ? {
      ...op,
      [field]: value
    } : op);
    console.log('🔄 [MultipleOperatorsSection] updateOperator called:', {
      id,
      field,
      value
    });
    console.log('🔄 [MultipleOperatorsSection] updatedOperators:', updatedOperators);
    onOperatorsChange(updatedOperators);
  };
  const getAvailableOperatorsForSelect = (currentOperatorId?: string) => {
    const usedOperatorIds = operators.filter(op => op.operatorId && op.operatorId !== currentOperatorId).map(op => op.operatorId);
    return availableOperators.filter(op => op.isActive && !usedOperatorIds.includes(op.id));
  };
  const getTotalCommissions = () => {
    return operators.reduce((total, op) => total + (op.commission || 0), 0);
  };
  return <Card className="border-green-200 bg-green-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-600" />
          Operadores y Comisiones del Servicio
          {operatorRequired && <span className="text-red-500">*</span>}
          {!operatorRequired}
        </CardTitle>
        <div className="text-sm text-green-700 bg-green-100 p-2 rounded border">
          <DollarSign className="h-4 w-4 inline mr-1" />
          <strong>Sistema Unificado:</strong> Esta es la única sección donde se gestionan las comisiones de operadores. 
          Las comisiones aquí configuradas son la fuente de verdad para todos los cálculos financieros.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {operators.map((operator, index) => <div key={operator.id} className="border rounded-lg p-4 space-y-4 bg-white shadow-sm">
            <div className="flex justify-between items-center">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                  Operador {index + 1}
                </span>
                {operator.role && <span className="text-sm text-gray-600">({operator.role})</span>}
              </h4>
              {operators.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeOperator(operator.id)} disabled={disabled} className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
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
                        {op.name}
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
                  <DollarSign className="h-3 w-3 text-green-600" />
                  Comisión (CLP) *
                </Label>
                <Input type="number" value={operator.commission} onChange={e => updateOperator(operator.id, 'commission', Number(e.target.value))} placeholder="150000" min="0" disabled={disabled} className="border-green-300 focus:border-green-500" />
              </div>
            </div>
          </div>)}

        {/* Botón para agregar operador */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button type="button" variant="outline" onClick={addOperator} disabled={disabled || operators.length >= 5} className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50">
            <Plus className="h-4 w-4" />
            Agregar Operador
          </Button>

          {/* Total de comisiones */}
          <div className="text-right">
            <Label className="text-sm text-muted-foreground">Total Comisiones:</Label>
            <div className="text-lg font-bold text-green-600 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
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