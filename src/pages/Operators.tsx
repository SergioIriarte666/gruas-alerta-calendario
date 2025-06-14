
import { useState } from 'react';
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OperatorForm } from '@/components/operators/OperatorForm';
import { useOperators } from '@/hooks/useOperators';
import { Operator } from '@/types';
import { toast } from '@/hooks/use-toast';

const Operators = () => {
  const { operators, loading, createOperator, updateOperator, deleteOperator, toggleOperatorStatus } = useOperators();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | undefined>();

  // Filtrar operadores por término de búsqueda
  const filteredOperators = operators.filter(operator =>
    operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    operator.rut.includes(searchTerm) ||
    operator.phone.includes(searchTerm) ||
    operator.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setEditingOperator(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (operator: Operator) => {
    setEditingOperator(operator);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingOperator) {
      updateOperator(editingOperator.id, data);
      toast({
        title: "Operador actualizado",
        description: "Los datos del operador han sido actualizados exitosamente.",
      });
    } else {
      createOperator(data);
      toast({
        title: "Operador creado",
        description: "El operador ha sido creado exitosamente.",
      });
    }
    setIsDialogOpen(false);
    setEditingOperator(undefined);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de eliminar al operador "${name}"?`)) {
      deleteOperator(id);
      toast({
        title: "Operador eliminado",
        description: "El operador ha sido eliminado exitosamente.",
      });
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean, name: string) => {
    toggleOperatorStatus(id);
    toast({
      title: `Operador ${currentStatus ? 'desactivado' : 'activado'}`,
      description: `${name} ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente.`,
    });
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando operadores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Operadores</h1>
          <p className="text-gray-400 mt-1">Gestión de operadores de grúas</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-tms-green hover:bg-tms-green/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Operador
        </Button>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, RUT, teléfono o licencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">
            Lista de Operadores ({filteredOperators.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              {filteredOperators.map((operator) => {
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
                          onClick={() => handleEdit(operator)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(operator.id, operator.isActive, operator.name)}
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
                          onClick={() => handleDelete(operator.id, operator.name)}
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

          {filteredOperators.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No se encontraron operadores</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-tms-dark border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingOperator ? 'Editar Operador' : 'Nuevo Operador'}
            </DialogTitle>
          </DialogHeader>
          <OperatorForm
            operator={editingOperator}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Operators;
