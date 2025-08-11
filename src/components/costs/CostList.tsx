import React, { useState } from 'react';
import { Cost } from '@/types/costs';
import { CostCard } from './CostCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface CostListProps {
  costs: Cost[];
  onEdit: (cost: Cost) => void;
  onDelete: (cost: Cost) => void;
  onViewDetails?: (cost: Cost) => void;
  loading?: boolean;
  highlightedCostId?: string;
}

export const CostList = ({ costs, onEdit, onDelete, onViewDetails, loading, highlightedCostId }: CostListProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [costToDelete, setCostToDelete] = useState<Cost | null>(null);

  const handleDeleteClick = (cost: Cost) => {
    setCostToDelete(cost);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (costToDelete) {
      onDelete(costToDelete);
      toast.success('Costo eliminado', {
        description: 'El costo se ha eliminado correctamente.'
      });
      setDeleteDialogOpen(false);
      setCostToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCostToDelete(null);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (costs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No hay costos registrados
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Los costos que registres aparecerán aquí organizados por fecha.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {costs.map((cost) => (
          <div
            key={cost.id}
            className={highlightedCostId === cost.id ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''}
          >
            <CostCard
              cost={cost}
              onEdit={onEdit}
              onDelete={handleDeleteClick}
              onViewDetails={onViewDetails}
            />
          </div>
        ))}
      </div>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Costo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este costo? Esta acción no se puede deshacer.
              {costToDelete && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="font-medium">{costToDelete.description}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: 'CLP'
                    }).format(Number(costToDelete.amount))} - {costToDelete.date}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};