
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import { Operator } from '@/types';

interface OperatorsTableProps {
  operators: Operator[];
  totalOperators: number;
  onEdit: (operator: Operator) => void;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean, name: string) => void;
  onNewOperator: () => void;
  searchTerm: string;
}

const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'expired', color: 'bg-red-500', text: 'Vencido' };
    if (diffDays <= 7) return { status: 'urgent', color: 'bg-red-500', text: 'Urgente' };
    if (diffDays <= 30) return { status: 'warning', color: 'bg-yellow-500', text: 'Próximo' };
    return { status: 'ok', color: 'bg-green-500', text: 'Vigente' };
};

export const OperatorsTable = ({ operators, totalOperators, onEdit, onDelete, onToggleStatus, onNewOperator, searchTerm }: OperatorsTableProps) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">
          Lista de Operadores ({totalOperators})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalOperators === 0 && !searchTerm ? (
            <div className="text-center py-12 text-gray-400">
                <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-tms-green" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No hay operadores registrados</h3>
                <p className="text-gray-400 mb-6">Comienza agregando tu primer operador</p>
                <Button 
                    onClick={onNewOperator}
                    className="bg-tms-green hover:bg-tms-green-dark text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primer Operador
                </Button>
            </div>
        ) : operators.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No se encontraron operadores para la búsqueda actual.</p>
            </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Nombre</TableHead>
                  <TableHead className="text-gray-300">RUT</TableHead>
                  <TableHead className="text-gray-300">Teléfono</TableHead>
                  <TableHead className="text-gray-300">Licencia</TableHead>
                  <TableHead className="text-gray-300">Examen</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((operator) => {
                  const expiryStatus = getExpiryStatus(operator.examExpiry);
                  return (
                    <TableRow key={operator.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell className="text-white font-medium">
                        {operator.name}
                      </TableCell>
                      <TableCell className="text-gray-300">{operator.rut}</TableCell>
                      <TableCell className="text-gray-300">{operator.phone}</TableCell>
                      <TableCell className="text-gray-300">{operator.licenseNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={`${expiryStatus.color} text-white`}>
                            {expiryStatus.text}
                          </Badge>
                          <span className="text-gray-300 text-sm">
                            {new Date(operator.examExpiry).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={operator.isActive ? 'status-active' : 'status-inactive'}
                        >
                          {operator.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(operator)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(operator.id, operator.isActive, operator.name)}
                            className="text-gray-400 hover:text-white"
                          >
                            {operator.isActive ? 
                              <ToggleRight className="w-4 h-4" /> : 
                              <ToggleLeft className="w-4 h-4" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(operator.id, operator.name)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
