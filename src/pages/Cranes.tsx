
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CraneForm } from '@/components/cranes/CraneForm';
import { useCranes } from '@/hooks/useCranes';
import { Crane } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { CranesHeader } from '@/components/cranes/CranesHeader';
import { CranesFilters } from '@/components/cranes/CranesFilters';
import { CranesTable } from '@/components/cranes/CranesTable';

const Cranes = () => {
  const { cranes, loading, createCrane, updateCrane, deleteCrane, toggleCraneStatus } = useCranes();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredCranes = cranes.filter(crane =>
    crane.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crane.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crane.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCranes.length / ITEMS_PER_PAGE);
  const paginatedCranes = filteredCranes.slice(
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
    // For now, just edit the crane - can be extended later
    handleEdit(crane);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-tms-dark p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Cargando grúas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tms-dark p-6">
      <div className="space-y-6">
        <CranesHeader onNewCrane={handleCreate} />

        <CranesFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

        <CranesTable
          cranes={paginatedCranes}
          totalCranes={filteredCranes.length}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onViewDetails={handleViewDetails}
          onNewCrane={handleCreate}
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
            setEditingCrane(undefined);
          }
        }}>
          <DialogContent className="bg-tms-dark border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
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
    </div>
  );
};

export default Cranes;
