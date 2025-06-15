
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorForm } from '@/components/operators/OperatorForm';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useOperatorMutations } from '@/hooks/operators/useOperatorMutations';
import { Operator } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { OperatorsHeader } from '@/components/operators/OperatorsHeader';
import { OperatorsFilters } from '@/components/operators/OperatorsFilters';
import { OperatorsTable } from '@/components/operators/OperatorsTable';

const Operators = () => {
  const { data: operatorsData, isLoading: loading } = useOperatorsData();
  const { createOperator, updateOperator, deleteOperator, toggleOperatorStatus } = useOperatorMutations();
  
  const operators = operatorsData || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredOperators = operators.filter(operator =>
    operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    operator.rut.includes(searchTerm) ||
    operator.phone.includes(searchTerm) ||
    operator.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOperators.length / ITEMS_PER_PAGE);
  const paginatedOperators = filteredOperators.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
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
      updateOperator({ id: editingOperator.id, operatorData: data });
    } else {
      createOperator(data);
    }
    setIsDialogOpen(false);
    setEditingOperator(undefined);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de eliminar al operador "${name}"?`)) {
      deleteOperator(id);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean, name: string) => {
    const action = currentStatus ? 'desactivar' : 'activar';
    if (window.confirm(`¿Está seguro de ${action} al operador "${name}"?`)) {
      toggleOperatorStatus(id);
    }
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
      <OperatorsHeader onNewOperator={handleCreate} />

      <OperatorsFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <OperatorsTable
        operators={paginatedOperators}
        totalOperators={filteredOperators.length}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onNewOperator={handleCreate}
        searchTerm={searchTerm}
      />

      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setEditingOperator(undefined);
        }
      }}>
        <DialogContent className="bg-tms-dark border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingOperator ? 'Editar Operador' : 'Nuevo Operador'}
            </DialogTitle>
          </DialogHeader>
          <OperatorForm
            operator={editingOperator}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingOperator(undefined);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Operators;
