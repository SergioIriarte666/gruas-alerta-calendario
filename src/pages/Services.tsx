import React, { useMemo, useState } from 'react';
import { useServicesPage } from '@/hooks/services/useServicesPage';
import { useServicesPendingExport } from '@/hooks/services/useServicesPendingExport';
import { ServicesHeader } from '@/components/services/ServicesHeader';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { ServicesTable } from '@/components/services/ServicesTable';
import { ServicesMobileView } from '@/components/services/ServicesMobileView';
import { ServicesPipelineView } from '@/components/services/ServicesPipelineView';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { ServiceBatchActionBar } from '@/components/services/ServiceBatchActionBar';
import { ServiceBatchUpdateModal } from '@/components/services/ServiceBatchUpdateModal';
import { AppPagination } from '@/components/shared/AppPagination';
import { Skeleton } from '@/components/ui/skeleton';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { prepareServiceForDuplication } from '@/utils/serviceHelpers';
import { ServiceDeleteConfirmDialog } from '@/components/services/ServiceDeleteConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

type ViewMode = 'table' | 'pipeline';

const Services = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchDuplicating, setIsBatchDuplicating] = useState(false);
  const [isBatchDeletePasswordOpen, setIsBatchDeletePasswordOpen] = useState(false);
  const [batchDeletePassword, setBatchDeletePassword] = useState('');
  const [batchDeleteVerifying, setBatchDeleteVerifying] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');
  const batchProgress = useBatchProgress();
  
  const {
    // State
    services,
    loading,
    selectedService,
    isFormOpen,
    isDetailsOpen,
    isCSVUploadOpen,
    editingService,
    searchTerm,
    statusFilter,
    currentPage,
    refreshing,
    hasAdvancedFilters,
    isAdmin,
    filteredServices,
    totalPages,
    paginatedServices,
    ITEMS_PER_PAGE,
    prefilledData,
    fromCalendarEvent,
    sortField,
    sortDirection,
    
    // Batch selection state
    selectedServiceIds,
    selectedServicesTotal,
    isBatchClosing,
    serviceToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    
    // Setters
    setIsCSVUploadOpen,
    setIsFormOpen,
    setIsDetailsOpen,
    setSearchTerm,
    setStatusFilter,
    setCurrentPage,
    setSelectedServiceIds,
    
    // Handlers
    handleAdvancedFiltersChange,
    handleRefresh,
    handleCreateService,
    handleUpdateService,
    handleFormOpenChange,
    handleCloseService,
    handleBatchCloseServices,
    handleClearSelection,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleConfirmDelete,
    deleteServiceDirect,
    handleCSVSuccess,
    handleSort,
    handleDuplicateService,
  } = useServicesPage();

  const { 
    handleExportPendingServices, 
    isExporting: isExportingPending, 
    pendingServicesCount 
  } = useServicesPendingExport(services);

  const isMobile = useIsMobile();

  // Calculate selected services data
  const selectedServicesData = useMemo(() => {
    return services.filter(s => selectedServiceIds.has(s.id));
  }, [services, selectedServiceIds]);

  // Check if batch delete is allowed (no invoiced services)
  const canBatchDelete = useMemo(() => {
    return selectedServicesData.every(s => s.status !== 'invoiced');
  }, [selectedServicesData]);

  // Batch delete handler
  const handleBatchDeleteServices = async () => {
    const count = selectedServiceIds.size;
    if (count === 0) return;

    if (!canBatchDelete) {
      toast.error('No se pueden eliminar servicios facturados');
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar ${count} servicio${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setBatchDeletePassword('');
    setBatchDeleteError('');
    setIsBatchDeletePasswordOpen(true);
  };

  const runBatchDelete = async () => {
    const count = selectedServiceIds.size;
    if (count === 0) return;

    setIsBatchDeleting(true);
    batchProgress.start('Eliminando Servicios', count);
    let successCount = 0;
    let errorCount = 0;

    try {
      const serviceIdArray = Array.from(selectedServiceIds);
      for (let i = 0; i < serviceIdArray.length; i++) {
        const serviceId = serviceIdArray[i];
        try {
          const service = services.find(s => s.id === serviceId);
          if (service) {
            batchProgress.update(i + 1, service.folio);
            await deleteServiceDirect(service);
            successCount++;
          }
        } catch (err) {
          console.error(`Error deleting service ${serviceId}:`, err);
          errorCount++;
        }
      }

      handleClearSelection();
      
      if (errorCount === 0) {
        batchProgress.complete();
      } else {
        batchProgress.error(`${errorCount} servicio(s) con error`);
      }
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchDeletePasswordConfirm = async () => {
    if (!batchDeletePassword.trim()) {
      setBatchDeleteError('Ingrese su contraseña');
      return;
    }

    setBatchDeleteVerifying(true);
    setBatchDeleteError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No se pudo obtener el email del usuario');

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: batchDeletePassword,
      });

      if (error) {
        setBatchDeleteError('Contraseña incorrecta');
        setBatchDeleteVerifying(false);
        return;
      }

      setIsBatchDeletePasswordOpen(false);
      await runBatchDelete();
    } catch {
      setBatchDeleteError('Error al verificar contraseña');
    } finally {
      setBatchDeleteVerifying(false);
    }
  };

  // Batch duplicate handler
  const handleBatchDuplicateServices = async () => {
    const count = selectedServiceIds.size;
    if (count === 0) return;

    const confirmed = window.confirm(
      `¿Deseas duplicar ${count} servicio${count > 1 ? 's' : ''}? Se crearán copias con nuevo folio.`
    );

    if (!confirmed) return;

    setIsBatchDuplicating(true);
    batchProgress.start('Duplicando Servicios', 1);
    let successCount = 0;

    try {
      const serviceIdArray = Array.from(selectedServiceIds);
      for (let i = 0; i < serviceIdArray.length; i++) {
        const serviceId = serviceIdArray[i];
        const service = services.find(s => s.id === serviceId);
        if (service) {
          batchProgress.update(1, service.folio);
          handleDuplicateService(service);
          successCount++;
          break;
        }
      }

      handleClearSelection();
      batchProgress.complete();
      
      if (count > 1) {
        toast.info(`Se ha preparado el primer servicio para duplicación. Para duplicar múltiples servicios, repita el proceso.`);
      }
    } finally {
      setIsBatchDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6 bg-white">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="services-scope container mx-auto py-6 space-y-6 bg-white min-h-screen">
      {/* Batch Action Bar - show when services are selected */}
      {selectedServiceIds.size > 0 && (
        <ServiceBatchActionBar
          selectedCount={selectedServiceIds.size}
          totalAmount={selectedServicesTotal}
          onBatchClose={handleBatchCloseServices}
          onBatchUpdate={() => setIsBatchUpdateOpen(true)}
          onBatchDelete={handleBatchDeleteServices}
          onBatchDuplicate={handleBatchDuplicateServices}
          onClearSelection={handleClearSelection}
          isProcessing={isBatchClosing || isBatchDeleting || isBatchDuplicating}
          canDelete={canBatchDelete}
        />
      )}

      <ServicesHeader 
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={() => setIsFormOpen(true)}
        onExportPending={handleExportPendingServices}
        isExportingPending={isExportingPending}
        pendingServicesCount={pendingServicesCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'table' && (
        <>
          <ServiceFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            onAdvancedFiltersChange={handleAdvancedFiltersChange}
          />

          {isMobile ? (
            <ServicesMobileView
              services={paginatedServices}
              hasInitialServices={services.length > 0}
              onViewDetails={handleViewDetails}
              onEdit={isAdmin ? handleEdit : undefined}
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleCloseService}
              onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ) : (
            <ServicesTable
              services={paginatedServices}
              hasInitialServices={services.length > 0}
              onViewDetails={handleViewDetails}
              onEdit={isAdmin ? handleEdit : undefined}
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleCloseService}
              onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              selectedServices={selectedServiceIds}
              onSelectionChange={setSelectedServiceIds}
            />
          )}

          {totalPages > 1 && (
            <AppPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      <ServiceDeleteConfirmDialog
        service={serviceToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirmDelete={handleConfirmDelete}
      />

      <Dialog open={isBatchDeletePasswordOpen} onOpenChange={setIsBatchDeletePasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar servicios</DialogTitle>
            <DialogDescription>
              Ingrese su contraseña para confirmar la eliminación por lotes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="batch-delete-password">Contraseña</Label>
            <Input
              id="batch-delete-password"
              type="password"
              value={batchDeletePassword}
              onChange={(e) => {
                setBatchDeletePassword(e.target.value);
                setBatchDeleteError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleBatchDeletePasswordConfirm()}
              placeholder="Contraseña"
              disabled={batchDeleteVerifying || isBatchDeleting}
            />
            {batchDeleteError && <p className="text-xs text-destructive">{batchDeleteError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsBatchDeletePasswordOpen(false)} disabled={batchDeleteVerifying || isBatchDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDeletePasswordConfirm}
              disabled={batchDeleteVerifying || isBatchDeleting || !batchDeletePassword.trim()}
            >
              {batchDeleteVerifying ? 'Verificando...' : `Eliminar ${selectedServiceIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === 'pipeline' && (
        <ServicesPipelineView
          services={filteredServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewDetails}
          onEdit={isAdmin ? handleEdit : undefined}
          onDelete={isAdmin ? (id: string) => {
            const service = services.find(s => s.id === id);
            if (service) handleDelete(service);
          } : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
        />
      )}

      <ServicesDialogs
        isCSVUploadOpen={isCSVUploadOpen}
        onCSVUploadClose={() => setIsCSVUploadOpen(false)}
        onCSVSuccess={handleCSVSuccess}
        isFormOpen={isFormOpen}
        onFormOpenChange={handleFormOpenChange}
        editingService={editingService}
        prefilledData={prefilledData}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={selectedService}
        isDetailsOpen={isDetailsOpen}
        onDetailsClose={() => setIsDetailsOpen(false)}
        fromCalendarEvent={fromCalendarEvent}
        onDuplicate={handleDuplicateService}
      />

      {/* Batch Update Modal */}
      <ServiceBatchUpdateModal
        open={isBatchUpdateOpen}
        onOpenChange={setIsBatchUpdateOpen}
        selectedServices={selectedServicesData}
        onSuccess={() => {
          handleClearSelection();
          handleRefresh();
        }}
      />

      {/* Batch Progress Modal */}
      <BatchProgressModal
        state={batchProgress.state}
        onClose={batchProgress.close}
      />
    </div>
  );
};

export default Services;
