
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, UserCheck, UserX, Plus, Users } from 'lucide-react';
import { Operator } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OperatorsTableProps {
  operators: Operator[];
  totalOperators: number;
  onEdit: (operator: Operator) => void;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean, name: string) => void;
  onNewOperator: () => void;
  searchTerm: string;
}

export const OperatorsTable = ({
  operators,
  totalOperators,
  onEdit,
  onDelete,
  onToggleStatus,
  onNewOperator,
  searchTerm,
}: OperatorsTableProps) => {
  if (operators.length === 0 && searchTerm) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No se encontraron operadores</h3>
          <p className="text-gray-400 mb-4">
            No hay operadores que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewOperator} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (operators.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay operadores registrados</h3>
          <p className="text-gray-400 mb-4">
            Comienza agregando tu primer operador al sistema
          </p>
          <Button onClick={onNewOperator} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Operadores ({totalOperators})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-white">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-white">RUT</th>
                <th className="text-left py-3 px-4 font-medium text-white">Teléfono</th>
                <th className="text-left py-3 px-4 font-medium text-white">Licencia</th>
                <th className="text-left py-3 px-4 font-medium text-white">Vencimiento</th>
                <th className="text-left py-3 px-4 font-medium text-white">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.id} className="border-b border-gray-800 hover:bg-white/5">
                  <td className="py-3 px-4 text-white font-medium">{operator.name}</td>
                  <td className="py-3 px-4 text-white">{operator.rut}</td>
                  <td className="py-3 px-4 text-white">{operator.phone}</td>
                  <td className="py-3 px-4 text-white">{operator.licenseNumber}</td>
                  <td className="py-3 px-4 text-white">
                    {format(new Date(operator.examExpiry), 'dd/MM/yyyy', { locale: es })}
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={operator.isActive ? "default" : "secondary"}
                      className={operator.isActive 
                        ? "bg-tms-green text-black" 
                        : "bg-gray-600 text-white"
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
                        onClick={() => onEdit(operator)}
                        className="text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
                        title="Editar operador"
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
                        title={operator.isActive ? 'Desactivar operador' : 'Activar operador'}
                      >
                        {operator.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(operator.id, operator.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
                        title="Eliminar operador"
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
