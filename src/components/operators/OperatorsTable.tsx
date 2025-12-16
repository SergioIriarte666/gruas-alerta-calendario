
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, UserCheck, UserX, Plus, Users, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { Operator } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';

export type OperatorSortField = 'operatorType' | 'name' | 'rut' | 'phone' | 'license' | 'examExpiry' | 'isActive';
export type SortDirection = 'asc' | 'desc';

interface OperatorsTableProps {
  operators: Operator[];
  totalOperators: number;
  onEdit: (operator: Operator) => void;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean, name: string) => void;
  onViewDetails: (operator: Operator) => void;
  onNewOperator: () => void;
  searchTerm: string;
  sortField?: OperatorSortField;
  sortDirection?: SortDirection;
  onSort?: (field: OperatorSortField) => void;
}

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: OperatorSortField; 
  currentSortField?: OperatorSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

export const OperatorsTable = ({
  operators,
  totalOperators,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewOperator,
  searchTerm,
  sortField,
  sortDirection,
  onSort,
}: OperatorsTableProps) => {
  if (operators.length === 0 && searchTerm) {
    return (
      <Card className="bg-card border-border operators-scope">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron operadores</h3>
          <p className="text-muted-foreground mb-4">
            No hay operadores que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewOperator} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (operators.length === 0) {
    return (
      <Card className="bg-card border-border operators-scope">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay operadores registrados</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primer operador al sistema
          </p>
          <Button onClick={onNewOperator} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border operators-scope">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Personal ({totalOperators})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('operatorType')}
                >
                  <div className="flex items-center">
                    Tipo
                    <SortIcon field="operatorType" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('name')}
                >
                  <div className="flex items-center">
                    Nombre
                    <SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('rut')}
                >
                  <div className="flex items-center">
                    RUT
                    <SortIcon field="rut" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('phone')}
                >
                  <div className="flex items-center">
                    Teléfono
                    <SortIcon field="phone" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('license')}
                >
                  <div className="flex items-center">
                    Licencia/Dpto
                    <SortIcon field="license" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('examExpiry')}
                >
                  <div className="flex items-center">
                    Vencimiento/Cargo
                    <SortIcon field="examExpiry" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('isActive')}
                >
                  <div className="flex items-center">
                    Estado
                    <SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.id} className="border-b hover:bg-accent">
                  <td className="py-3 px-4">
                    <Badge 
                      variant={operator.operatorType === 'crane_operator' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {operator.operatorType === 'crane_operator' ? '🏗️ Operador' : '📋 Administrativo'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-foreground font-medium">{operator.name}</td>
                  <td className="py-3 px-4 text-foreground">{operator.rut}</td>
                  <td className="py-3 px-4 text-foreground">{operator.phone}</td>
                  <td className="py-3 px-4 text-foreground">
                    {operator.operatorType === 'crane_operator' 
                      ? operator.licenseNumber || '-' 
                      : operator.department || '-'}
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {operator.operatorType === 'crane_operator'
                      ? formatForDisplay(operator.examExpiry || '')
                      : operator.position || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={operator.isActive ? "default" : "secondary"}
                      className={operator.isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                      }
                    >
                      {operator.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(operator)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(operator)}
                        className="text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(operator.id, operator.isActive, operator.name)}
                        className={`border ${
                          operator.isActive 
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/50' 
                            : 'text-green-400 hover:text-green-300 hover:bg-green-400/10 border-green-400/50'
                        }`}
                        title={operator.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {operator.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(operator.id, operator.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
