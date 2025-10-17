
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorForm } from '@/components/operators/OperatorForm';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useOperatorMutations } from '@/hooks/operators/useOperatorMutations';
import { Operator } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { OperatorsHeader } from '@/components/operators/OperatorsHeader';
import { OperatorsFilters } from '@/components/operators/OperatorsFilters';
import { OperatorsTable, OperatorSortField, SortDirection } from '@/components/operators/OperatorsTable';
import { parseFromDatabase } from '@/utils/timezoneUtils';

const Operators = () => {
  const { data: operatorsData, isLoading: loading } = useOperatorsData();
  const { createOperator, updateOperator, deleteOperator, toggleOperatorStatus } = useOperatorMutations();
  
  const operators = operatorsData || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | 'crane_operator' | 'administrative'>('all');
  const [sortField, setSortField] = useState<OperatorSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const ITEMS_PER_PAGE = 10;

  const handleSort = (field: OperatorSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedOperators = useMemo(() => {
    const filtered = operators.filter(operator => {
      const matchesSearch = 
        operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        operator.rut.includes(searchTerm) ||
        operator.phone.includes(searchTerm) ||
        (operator.licenseNumber && operator.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === 'all' || operator.operatorType === typeFilter;
      
      return matchesSearch && matchesType;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'operatorType':
          comparison = a.operatorType.localeCompare(b.operatorType);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rut':
          comparison = a.rut.localeCompare(b.rut);
          break;
        case 'phone':
          comparison = a.phone.localeCompare(b.phone);
          break;
        case 'license':
          const licenseA = a.operatorType === 'crane_operator' ? (a.licenseNumber || '') : (a.department || '');
          const licenseB = b.operatorType === 'crane_operator' ? (b.licenseNumber || '') : (b.department || '');
          comparison = licenseA.localeCompare(licenseB);
          break;
        case 'examExpiry':
          if (a.operatorType === 'crane_operator' && b.operatorType === 'crane_operator') {
            const dateA = a.examExpiry ? parseFromDatabase(a.examExpiry).getTime() : 0;
            const dateB = b.examExpiry ? parseFromDatabase(b.examExpiry).getTime() : 0;
            comparison = dateA - dateB;
          } else {
            const posA = a.position || '';
            const posB = b.position || '';
            comparison = posA.localeCompare(posB);
          }
          break;
        case 'isActive':
          comparison = (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [operators, searchTerm, typeFilter, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedOperators.length / ITEMS_PER_PAGE);
  const paginatedOperators = filteredAndSortedOperators.slice(
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
        <div className="text-foreground">Cargando operadores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 operators-scope">
      <OperatorsHeader onNewOperator={handleCreate} />

      <OperatorsFilters 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
      />

      <OperatorsTable
        operators={paginatedOperators}
        totalOperators={filteredAndSortedOperators.length}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onNewOperator={handleCreate}
        searchTerm={searchTerm}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
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
        <DialogContent className="bg-card border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
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
