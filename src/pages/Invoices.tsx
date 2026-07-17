import { useLocation } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { usePagedInvoices } from '@/hooks/invoices/useInvoiceData';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Invoice } from '@/types';
import { useBatchProgress } from '@/components/ui/batch-progress-modal';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InvoicesPageContent } from '@/components/invoices/InvoicesPageContent';
import { useInvoicesPageState } from '@/hooks/invoices/useInvoicesPageState';
import { useInvoicesPageActions } from '@/hooks/invoices/useInvoicesPageActions';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

interface InvoicesFormScreenProps {
  formState: {
    editingInvoice: Invoice | null;
    preselectedClosureId: string | null;
  };
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const InvoicesFormScreen = ({
  formState,
  onSubmit,
  onCancel,
}: InvoicesFormScreenProps) => (
  <div className="invoices-concept space-y-6">
    <PageHeader
      title={formState.editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
      description="Completa los datos de facturación y vuelve al listado cuando termines."
    />
    <ErrorBoundary name="InvoiceForm">
      <InvoiceForm
        invoice={formState.editingInvoice}
        preselectedClosureId={formState.preselectedClosureId}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    </ErrorBoundary>
  </div>
);

const InvoicesLoadingState = () => (
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

const Invoices = () => {
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice, markAsPaid, getInvoiceWithDetails, refetch } = useInvoices({ excludeHistorical: true });
  const isMobile = useIsMobile();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusFromQuery = queryParams.get('status');
  const tabFromQuery = queryParams.get('tab') || 'invoices';
  const navigationState = location.state as { preselectedClosureId?: string } | null;
  const preselectedClosureIdFromNavigation = navigationState?.preselectedClosureId ?? null;

  const batchProgress = useBatchProgress();
  const ITEMS_PER_PAGE = 10;
  const {
    viewState,
    formState,
    deleteDialogState,
    pendingDeleteIdRef,
    clearSelection,
    handleSearchChange,
    handleStatusFilterChange,
    handlePageChange,
    openCreateInvoiceForm,
    openEditInvoiceForm,
    closeInvoiceForm,
    openProtectedDeleteDialog,
    closeProtectedDeleteDialog,
    setDeletePassword,
    setDeleteError,
    setDeleteVerifying,
    handleSort,
    setActiveTab,
    setExportModalOpen,
    setMarkAsPaidInvoice,
    setSelectedInvoiceIds,
    toggleInvoiceSelection,
  } = useInvoicesPageState(statusFromQuery, tabFromQuery, preselectedClosureIdFromNavigation);

  const {
    data: pagedData,
  } = usePagedInvoices(viewState.currentPage, ITEMS_PER_PAGE, {
    searchTerm: viewState.debouncedSearch,
    statusFilter: viewState.statusFilter,
    sortField: viewState.sortField,
    sortDirection: viewState.sortDirection,
  });
  const paginatedInvoices = pagedData?.invoices || [];
  const totalPages = pagedData
    ? Math.max(1, Math.ceil(pagedData.total / ITEMS_PER_PAGE))
    : 1;
  const {
    filteredInvoices,
    selectedInvoices,
    handleCreateInvoice,
    handleUpdateInvoice,
    handleDeleteInvoice,
    handleConfirmProtectedDelete,
    handleMarkAsPaid,
    handleConfirmMarkAsPaid,
    handleEditInvoice,
    handleRefresh,
    handleInvoiceToggle,
    handleSelectAllToggle,
    handleBatchMarkAsPaid,
    handleBatchDelete,
    handleBatchExport,
  } = useInvoicesPageActions({
    invoices,
    paginatedInvoices,
    selectedInvoiceIds: viewState.selectedInvoiceIds,
    formState,
    deleteDialogState,
    pendingDeleteIdRef,
    batchProgress,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    refetch,
    closeInvoiceForm,
    openEditInvoiceForm,
    openProtectedDeleteDialog,
    closeProtectedDeleteDialog,
    clearSelection,
    setDeleteError,
    setDeleteVerifying,
    setMarkAsPaidInvoice,
    setSelectedInvoiceIds,
    toggleInvoiceSelection,
  });

  const handleClearSelection = () => clearSelection();

  if (formState.showForm) {
    return (
      <InvoicesFormScreen
        formState={formState}
        onSubmit={formState.editingInvoice ? handleUpdateInvoice : handleCreateInvoice}
        onCancel={closeInvoiceForm}
      />
    );
  }

  if (loading) {
    return <InvoicesLoadingState />;
  }

  return (
    <div className="invoices-concept pb-6">
    <InvoicesPageContent
      activeTab={viewState.activeTab}
      onActiveTabChange={setActiveTab}
      invoices={invoices}
      paginatedInvoices={paginatedInvoices}
      filteredInvoices={filteredInvoices}
      selectedInvoices={selectedInvoices}
      selectedInvoiceIds={viewState.selectedInvoiceIds}
      isMobile={isMobile}
      searchTerm={viewState.searchTerm}
      statusFilter={viewState.statusFilter}
      sortField={viewState.sortField}
      sortDirection={viewState.sortDirection}
      currentPage={viewState.currentPage}
      totalPages={totalPages}
      exportModalOpen={viewState.exportModalOpen}
      markAsPaidInvoice={viewState.markAsPaidInvoice}
      deleteDialogState={deleteDialogState}
      batchProgressState={batchProgress.state}
      onBatchProgressClose={batchProgress.close}
      onCreateInvoice={() => openCreateInvoiceForm()}
      onOpenExportModal={() => setExportModalOpen(true)}
      onSearchChange={handleSearchChange}
      onStatusFilterChange={handleStatusFilterChange}
      onBatchMarkAsPaid={handleBatchMarkAsPaid}
      onBatchDelete={handleBatchDelete}
      onBatchExport={handleBatchExport}
      onClearSelection={handleClearSelection}
      onEditInvoice={handleEditInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      onMarkAsPaid={handleMarkAsPaid}
      onRefresh={handleRefresh}
      onSort={handleSort}
      onInvoiceToggle={handleInvoiceToggle}
      onSelectAllToggle={handleSelectAllToggle}
      onPageChange={handlePageChange}
      getInvoiceWithDetails={getInvoiceWithDetails}
      onExportModalOpenChange={setExportModalOpen}
      onMarkAsPaidModalClose={() => setMarkAsPaidInvoice(null)}
      onConfirmMarkAsPaid={handleConfirmMarkAsPaid}
      onDeleteDialogOpenChange={(open) => {
        if (!open) {
          closeProtectedDeleteDialog();
        }
      }}
      onDeleteDialogPasswordChange={setDeletePassword}
      onConfirmProtectedDelete={handleConfirmProtectedDelete}
      onCancelProtectedDelete={closeProtectedDeleteDialog}
    />
    </div>
  );
};

export default Invoices;
