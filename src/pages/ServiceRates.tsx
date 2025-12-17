import React, { useState, useMemo } from 'react';
import { useServiceRates } from '@/hooks/useServiceRates';
import { ServiceRateWithRelations, ServiceRateFormData } from '@/types/serviceRates';
import { ServiceRatesHeader } from '@/components/serviceRates/ServiceRatesHeader';
import { ServiceRatesTable } from '@/components/serviceRates/ServiceRatesTable';
import { ServiceRateForm } from '@/components/serviceRates/ServiceRateForm';
import { ServiceRateDetailsModal } from '@/components/serviceRates/ServiceRateDetailsModal';
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

const ServiceRates: React.FC = () => {
  const { rates, loading, fetchRates, createRate, updateRate, deleteRate, toggleActive } = useServiceRates();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ServiceRateWithRelations | null>(null);

  const filteredRates = useMemo(() => {
    if (!searchTerm.trim()) return rates;
    
    const search = searchTerm.toLowerCase();
    return rates.filter((rate) =>
      rate.client?.name?.toLowerCase().includes(search) ||
      rate.client?.department?.toLowerCase().includes(search) ||
      rate.origin.toLowerCase().includes(search) ||
      rate.destination?.toLowerCase().includes(search) ||
      rate.service_type?.name?.toLowerCase().includes(search)
    );
  }, [rates, searchTerm]);

  const handleAddNew = () => {
    setSelectedRate(null);
    setIsFormOpen(true);
  };

  const handleView = (rate: ServiceRateWithRelations) => {
    setSelectedRate(rate);
    setIsDetailsOpen(true);
  };

  const handleEdit = (rate: ServiceRateWithRelations) => {
    setSelectedRate(rate);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (rate: ServiceRateWithRelations) => {
    setSelectedRate(rate);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedRate) {
      await deleteRate(selectedRate.id);
    }
    setIsDeleteOpen(false);
    setSelectedRate(null);
  };

  const handleFormSubmit = async (data: ServiceRateFormData) => {
    if (selectedRate) {
      await updateRate(selectedRate.id, data);
    } else {
      await createRate(data);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <ServiceRatesHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddNew={handleAddNew}
        onRefresh={fetchRates}
        isLoading={loading}
      />

      <ServiceRatesTable
        rates={filteredRates}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onToggleActive={toggleActive}
      />

      <ServiceRateForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedRate(null);
        }}
        onSubmit={handleFormSubmit}
        rate={selectedRate}
      />

      <ServiceRateDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedRate(null);
        }}
        rate={selectedRate}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarifa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la tarifa para{' '}
              <strong>{selectedRate?.client?.name}</strong> con origen{' '}
              <strong>{selectedRate?.origin}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceRates;
