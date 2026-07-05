
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorForm } from '@/components/operators/OperatorForm';
import { OperatorDetailsModal } from '@/components/operators/OperatorDetailsModal';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useOperatorMutations } from '@/hooks/operators/useOperatorMutations';
import { useOperatorDocumentAlerts } from '@/hooks/operators/useOperatorDocuments';
import { Operator } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { OperatorsHeader } from '@/components/operators/OperatorsHeader';
import { OperatorsFilters } from '@/components/operators/OperatorsFilters';
import { OperatorsTable, OperatorSortField, SortDirection } from '@/components/operators/OperatorsTable';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { MetricCard } from '@/components/ui/metric-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Briefcase, IdCard, ShieldCheck, UserCog } from 'lucide-react';

const Operators = () => {
  const { data: operatorsData, isLoading: loading } = useOperatorsData();
  const { createOperator, updateOperator, deleteOperator, toggleOperatorStatus } = useOperatorMutations();
  const { data: operatorsWithDocumentAlerts } = useOperatorDocumentAlerts();
  
  const operators = operatorsData || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | undefined>();
  const [selectedOperatorForDetails, setSelectedOperatorForDetails] = useState<Operator | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | 'crane_operator' | 'administrative'>('all');
  const [sortField, setSortField] = useState<OperatorSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'toggle'; operator: Operator } | null>(null);
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
        case 'license': {
          const licenseA = a.operatorType === 'crane_operator' ? (a.licenseNumber || '') : (a.department || '');
          const licenseB = b.operatorType === 'crane_operator' ? (b.licenseNumber || '') : (b.department || '');
          comparison = licenseA.localeCompare(licenseB);
          break;
        }
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

  const operatorMetrics = useMemo(() => {
    const active = operators.filter((operator) => operator.isActive).length;
    const craneOperators = operators.filter((operator) => operator.operatorType === 'crane_operator').length;
    const administrative = operators.filter((operator) => operator.operatorType === 'administrative').length;
    const withLicense = operators.filter((operator) => operator.licenseNumber).length;

    return { active, craneOperators, administrative, withLicense };
  }, [operators]);

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

  const handleDelete = (id: string) => {
    const operator = operators.find((item) => item.id === id);
    if (operator) setPendingAction({ type: 'delete', operator });
  };

  const handleToggleStatus = (id: string) => {
    const operator = operators.find((item) => item.id === id);
    if (operator) setPendingAction({ type: 'toggle', operator });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OperatorsHeader onNewOperator={handleCreate} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Activos" value={operatorMetrics.active} description="Operadores disponibles" icon={ShieldCheck} tone="success" />
        <MetricCard title="De Grúa" value={operatorMetrics.craneOperators} description="Personal operativo" icon={UserCog} tone="primary" />
        <MetricCard title="Administrativos" value={operatorMetrics.administrative} description="Soporte y gestión" icon={Briefcase} tone="info" />
        <MetricCard title="Con Licencia" value={operatorMetrics.withLicense} description="Registros de licencia cargados" icon={IdCard} tone="warning" />
      </div>

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
        onViewDetails={setSelectedOperatorForDetails}
        onNewOperator={handleCreate}
        searchTerm={searchTerm}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        operatorsWithDocumentAlerts={operatorsWithDocumentAlerts}
      />

      <OperatorDetailsModal
        operator={selectedOperatorForDetails}
        isOpen={!!selectedOperatorForDetails}
        onClose={() => setSelectedOperatorForDetails(null)}
      />

      {totalPages > 1 && (
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setEditingOperator(undefined);
        }
      }}>
        <DialogContent className="max-w-2xl border-border/70 bg-card">
          <DialogHeader className="-mx-6 -mt-6 border-b border-border/70 bg-muted/20 px-6 py-4">
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

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent className="border-border/70 bg-popover/95">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'delete' ? 'Eliminar operador' : `${pendingAction?.operator.isActive ? 'Desactivar' : 'Activar'} operador`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'delete'
                ? `Se eliminará el registro de "${pendingAction.operator.name}". Esta acción no se puede deshacer.`
                : `Se ${pendingAction?.operator.isActive ? 'desactivará' : 'activará'} a "${pendingAction?.operator.name}" en el sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction?.type === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.type === 'delete') {
                  deleteOperator(pendingAction.operator.id);
                } else {
                  toggleOperatorStatus(pendingAction.operator.id);
                }
                setPendingAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Operators;
