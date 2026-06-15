import { useMemo, useState, useCallback } from 'react';
import {
  getCurrentChileDateString,
  getCurrentWeekRange,
  getCurrentMonthRange,
  formatForInput,
} from '@/utils/timezoneUtils';
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
import { ServiceDeleteConfirmDialog } from '@/components/services/ServiceDeleteConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Copy, ShieldAlert, Trash2 } from 'lucide-react';
import { Service } from '@/types';
import { createLogger } from "@/lib/logger";


const logger = createLogger("Services");
type ViewMode = 'table' | 'pipeline';

import { DateFilter } from '@/components/services/ServicesDateFilter';

const getDateRange = (filter: DateFilter) => {
  switch (filter) {
    case 'today': {
      const today = getCurrentChileDateString();
      return { from: today, to: today };
    }
    case 'week': {
      const { start, end } = getCurrentWeekRange();
      return { from: formatForInput(start), to: formatForInput(end) };
    }
    case 'month': {
      const { start, end } = getCurrentMonthRange();
      return { from: formatForInput(start), to: formatForInput(end) };
    }
    case 'all':
    default:
      return { from: '', to: '' };
  }
};

const Services = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [dateFilter, setDateFilter] = useState<DateFilter | 'custom'>('month');
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchDuplicating, setIsBatchDuplicating] = useState(false);
  const [isBatchDeletePasswordOpen, setIsBatchDeletePasswordOpen] = useState(false);
  const [batchDeletePassword, setBatchDeletePassword] = useState('');
  const [batchDeleteVerifying, setBatchDeleteVerifying] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');
  const [serviceToClose, setServiceToClose] = useState<Service | null>(null);
  const [serviceToEditWarning, setServiceToEditWarning] = useState<Service | null>(null);
  const [isBatchCloseConfirmOpen, setIsBatchCloseConfirmOpen] = useState(false);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isBatchDuplicateConfirmOpen, setIsBatchDuplicateConfirmOpen] = useState(false);
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
    isAdmin,
    filteredServices,
    totalPages,
    paginatedServices,
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
    setListDateFrom,
    setListDateTo,
  } = useServicesPage();

  // Separate visual state (button highlight) from actual date values
  // listDateFrom/listDateTo are the real filter values shown in the inputs
  const [localDateFrom, setLocalDateFrom] = useState(() => { const { start } = getCurrentMonthRange(); return formatForInput(start); });
  const [localDateTo,   setLocalDateTo]   = useState(() => { const { end }   = getCurrentMonthRange(); return formatForInput(end);   });

  // When a filter button is clicked: update button state + inputs + hook state
  const handleDateFilterChange = useCallback((filter: DateFilter) => {
    setDateFilter(filter);
    const { from, to } = getDateRange(filter);
    setLocalDateFrom(from);
    setLocalDateTo(to);
    setListDateFrom(from);
    setListDateTo(to);
    setCurrentPage(1);
  }, [setListDateFrom, setListDateTo, setCurrentPage]);

  // When user edits an input manually: deactivate button, keep typed value
  const handleManualDateFrom = useCallback((v: string) => {
    setDateFilter('custom');
    setLocalDateFrom(v);
    setListDateFrom(v);
    setCurrentPage(1);
  }, [setListDateFrom, setCurrentPage]);

  const handleManualDateTo = useCallback((v: string) => {
    setDateFilter('custom');
    setLocalDateTo(v);
    setListDateTo(v);
    setCurrentPage(1);
  }, [setListDateTo, setCurrentPage]);

  const listDateFrom = localDateFrom;
  const listDateTo   = localDateTo;

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

  const closeableServices = useMemo(() => {
    return selectedServicesData.filter(
      (service) => service.status === 'pending' || service.status === 'in_progress'
    );
  }, [selectedServicesData]);

  const notCloseableCount = selectedServicesData.length - closeableServices.length;

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
          logger.error(`Error deleting service ${serviceId}:`, err);
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

  const handleRequestCloseService = (service: Service) => {
    if (service.status === 'invoiced') {
      toast.error('No se puede cerrar un servicio que ya está facturado');
      return;
    }

    setServiceToClose(service);
  };

  const handleConfirmCloseService = async () => {
    if (!serviceToClose) return;
    await handleCloseService(serviceToClose);
    setServiceToClose(null);
  };

  const handleRequestEdit = (service: Service) => {
    if (service.status === 'invoiced' && !isAdmin) {
      toast.error('No se puede editar un servicio facturado. Solo los administradores pueden hacerlo');
      return;
    }

    if (service.status === 'invoiced' && isAdmin) {
      setServiceToEditWarning(service);
      return;
    }

    handleEdit(service);
  };

  const handleConfirmEditWarning = () => {
    if (!serviceToEditWarning) return;
    handleEdit(serviceToEditWarning);
    setServiceToEditWarning(null);
  };

  const handleRequestBatchClose = () => {
    if (selectedServiceIds.size === 0) return;

    if (closeableServices.length === 0) {
      toast.error('No hay servicios pendientes o en progreso para cerrar');
      return;
    }

    setIsBatchCloseConfirmOpen(true);
  };

  const handleRequestBatchDelete = () => {
    if (selectedServiceIds.size === 0) return;

    if (!canBatchDelete) {
      toast.error('No se pueden eliminar servicios facturados');
      return;
    }

    setIsBatchDeleteConfirmOpen(true);
  };

  const handleConfirmBatchDelete = async () => {
    setIsBatchDeleteConfirmOpen(false);
    await handleBatchDeleteServices();
  };

  const handleRequestBatchDuplicate = () => {
    if (selectedServiceIds.size === 0) return;
    setIsBatchDuplicateConfirmOpen(true);
  };

  const handleConfirmBatchDuplicate = async () => {
    setIsBatchDuplicateConfirmOpen(false);
    await handleBatchDuplicateServices();
  };

  if (loading) {
    return (
      <div className="space-y-6 text-foreground">
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
    <div className="space-y-6 text-foreground">
      {/* Batch Action Bar - show when services are selected */}
      {selectedServiceIds.size > 0 && (
        <ServiceBatchActionBar
          selectedCount={selectedServiceIds.size}
          totalAmount={selectedServicesTotal}
          onBatchClose={handleRequestBatchClose}
          onBatchUpdate={() => setIsBatchUpdateOpen(true)}
          onBatchDelete={handleRequestBatchDelete}
          onBatchDuplicate={handleRequestBatchDuplicate}
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
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
      />

      {viewMode === 'table' && (
        <>
          <ServiceFilters
            searchTerm={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
            statusFilter={statusFilter}
            onStatusChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
            onAdvancedFiltersChange={handleAdvancedFiltersChange}
            listDateFrom={listDateFrom}
            listDateTo={listDateTo}
            onListDateFromChange={handleManualDateFrom}
            onListDateToChange={handleManualDateTo}
          />

          {isMobile ? (
            <ServicesMobileView
              services={paginatedServices}
              hasInitialServices={services.length > 0}
              onViewDetails={handleViewDetails}
              onEdit={isAdmin ? handleRequestEdit : undefined}
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleRequestCloseService}
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
              onEdit={isAdmin ? handleRequestEdit : undefined}
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleRequestCloseService}
              onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              selectedServices={selectedServiceIds}
              onSelectionChange={setSelectedServiceIds}
              allFilteredIds={filteredServices.map(s => s.id)}
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
        <DialogContent className="sm:max-w-md border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="size-5 text-danger" />
              Eliminar servicios
            </DialogTitle>
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
            <Button variant="outline" className="border-border/70 bg-background/60" onClick={() => setIsBatchDeletePasswordOpen(false)} disabled={batchDeleteVerifying || isBatchDeleting}>
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
          onEdit={isAdmin ? handleRequestEdit : undefined}
          onDelete={isAdmin ? (id: string) => {
            const service = services.find(s => s.id === id);
            if (service) handleDelete(service);
          } : undefined}
          onCloseService={handleRequestCloseService}
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

      <AlertDialog open={!!serviceToClose} onOpenChange={(open) => !open && setServiceToClose(null)}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="size-5 text-success" />
              Cerrar servicio
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceToClose
                ? `Se cerrará el servicio ${serviceToClose.folio} y su estado cambiará a "Completado".`
                : 'Confirma el cierre del servicio.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCloseService}>
              Confirmar cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBatchCloseConfirmOpen} onOpenChange={setIsBatchCloseConfirmOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="size-5 text-success" />
              Cerrar servicios seleccionados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrarán {closeableServices.length} servicio{closeableServices.length === 1 ? '' : 's'}
              {notCloseableCount > 0
                ? ` y ${notCloseableCount} seleccionado${notCloseableCount === 1 ? '' : 's'} quedará${notCloseableCount === 1 ? '' : 'n'} fuera por su estado actual.`
                : '.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsBatchCloseConfirmOpen(false);
                await handleBatchCloseServices();
              }}
            >
              Cerrar seleccionados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBatchDeleteConfirmOpen} onOpenChange={setIsBatchDeleteConfirmOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Trash2 className="size-5 text-danger" />
              Eliminar servicios
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {selectedServiceIds.size} servicio{selectedServiceIds.size === 1 ? '' : 's'}.
              Esta acción no se puede deshacer y luego se solicitará tu contraseña.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBatchDelete}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBatchDuplicateConfirmOpen} onOpenChange={setIsBatchDuplicateConfirmOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Copy className="size-5 text-primary" />
              Duplicar servicios
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se tomará el primer servicio seleccionado y se preparará una copia con nuevo folio para revisión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBatchDuplicate}>
              Preparar duplicación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!serviceToEditWarning} onOpenChange={(open) => !open && setServiceToEditWarning(null)}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-warning" />
              Servicio facturado
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceToEditWarning
                ? `El servicio ${serviceToEditWarning.folio} ya está facturado. Como administrador puedes editarlo, pero los cambios podrían afectar la facturación relacionada.`
                : 'Como administrador puedes continuar bajo tu responsabilidad.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEditWarning}>
              Continuar edición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Services;
