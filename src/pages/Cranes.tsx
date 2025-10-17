
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CraneForm } from '@/components/cranes/CraneForm';
import { CraneDetailsModal } from '@/components/cranes/CraneDetailsModal';
import { useCranes } from '@/hooks/useCranes';
import { Crane } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { CranesHeader } from '@/components/cranes/CranesHeader';
import { CranesFilters } from '@/components/cranes/CranesFilters';
import { CranesTable, CraneSortField, SortDirection } from '@/components/cranes/CranesTable';
import { parseFromDatabase } from '@/utils/timezoneUtils';


const Cranes = () => {
  const { cranes, loading, createCrane, updateCrane, deleteCrane, toggleCraneStatus } = useCranes();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | undefined>();
  const [selectedCrane, setSelectedCrane] = useState<Crane | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<CraneSortField>('licensePlate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const ITEMS_PER_PAGE = 10;

  const handleSort = (field: CraneSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedCranes = useMemo(() => {
    const filtered = cranes.filter(crane =>
      (crane.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      crane.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crane.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'licensePlate':
          comparison = (a.licensePlate || '').localeCompare(b.licensePlate || '');
          break;
        case 'brand':
          const brandA = `${a.brand} ${a.model}`;
          const brandB = `${b.brand} ${b.model}`;
          comparison = brandA.localeCompare(brandB);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'technicalReviewExpiry':
          comparison = parseFromDatabase(a.technicalReviewExpiry).getTime() - parseFromDatabase(b.technicalReviewExpiry).getTime();
          break;
        case 'insuranceExpiry':
          comparison = parseFromDatabase(a.insuranceExpiry).getTime() - parseFromDatabase(b.insuranceExpiry).getTime();
          break;
        case 'circulationPermitExpiry':
          comparison = parseFromDatabase(a.circulationPermitExpiry).getTime() - parseFromDatabase(b.circulationPermitExpiry).getTime();
          break;
        case 'isActive':
          comparison = (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [cranes, searchTerm, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedCranes.length / ITEMS_PER_PAGE);
  const paginatedCranes = filteredAndSortedCranes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreate = () => {
    setEditingCrane(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (crane: Crane) => {
    setEditingCrane(crane);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCrane) {
      updateCrane(editingCrane.id, data);
    } else {
      createCrane(data);
    }
    setIsDialogOpen(false);
    setEditingCrane(undefined);
  };

  const handleDelete = (crane: Crane) => {
    if (window.confirm(`¿Está seguro de eliminar la grúa "${crane.licensePlate}"?`)) {
      deleteCrane(crane.id);
    }
  };

  const handleToggleStatus = (crane: Crane) => {
    const action = crane.isActive ? 'desactivar' : 'activar';
    if (window.confirm(`¿Está seguro de ${action} la grúa "${crane.licensePlate}"?`)) {
      toggleCraneStatus(crane.id);
    }
  };

  const handleViewDetails = (crane: Crane) => {
    setSelectedCrane(crane);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedCrane(undefined);
  };

  const handleEditFromDetails = (crane: Crane) => {
    setIsDetailsModalOpen(false);
    setEditingCrane(crane);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando grúas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 cranes-scope">
      <CranesHeader onNewCrane={handleCreate} />

      <CranesFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <CranesTable
        cranes={paginatedCranes}
        totalCranes={filteredAndSortedCranes.length}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onViewDetails={handleViewDetails}
        onNewCrane={handleCreate}
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

      <CraneDetailsModal
        crane={selectedCrane}
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        onEdit={handleEditFromDetails}
      />

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setEditingCrane(undefined);
        }
      }}>
        <DialogContent className="bg-card border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingCrane ? 'Editar Grúa' : 'Nueva Grúa'}
            </DialogTitle>
          </DialogHeader>
          <CraneForm
            crane={editingCrane}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingCrane(undefined);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cranes;
