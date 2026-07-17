import { Invoice } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoicesListTabContent } from '@/components/invoices/InvoicesListTabContent';
import { InvoicesPipelineView } from '@/components/invoices/InvoicesPipelineView';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { PaymentReconciliation } from '@/components/invoices/PaymentReconciliation';
import { InvoiceCancellationsHistory } from '@/components/invoices/InvoiceCancellationsHistory';
import InvoiceExportModal from '@/components/invoices/InvoiceExportModal';
import { BatchProgressModal } from '@/components/ui/batch-progress-modal';
import { MarkAsPaidModal } from '@/components/invoices/MarkAsPaidModal';
import { SectionCard } from '@/components/ui/section-card';
import {
  InvoicesProtectedDeleteDialog,
  InvoicesProtectedDeleteDialogState,
} from '@/components/invoices/InvoicesProtectedDeleteDialog';

interface InvoicesPageContentProps {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  invoices: Invoice[];
  paginatedInvoices: Invoice[];
  filteredInvoices: Invoice[];
  selectedInvoices: Invoice[];
  selectedInvoiceIds: string[];
  isMobile: boolean;
  searchTerm: string;
  statusFilter: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  totalPages: number;
  exportModalOpen: boolean;
  markAsPaidInvoice: Invoice | null;
  deleteDialogState: InvoicesProtectedDeleteDialogState;
  batchProgressState: any;
  onBatchProgressClose: () => void;
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onBatchMarkAsPaid: (invoiceIds: string[]) => Promise<void>;
  onBatchDelete: (invoiceIds: string[]) => Promise<void>;
  onBatchExport: (invoiceIds: string[]) => Promise<void>;
  onClearSelection: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
  onMarkAsPaid: (invoiceId: string) => void;
  onRefresh: () => void;
  onSort: (field: string) => void;
  onInvoiceToggle: (invoiceId: string, checked: boolean) => void;
  onSelectAllToggle: (checked: boolean) => void;
  onPageChange: (page: number) => void;
  getInvoiceWithDetails: any;
  onExportModalOpenChange: (open: boolean) => void;
  onMarkAsPaidModalClose: () => void;
  onConfirmMarkAsPaid: (invoiceId: string, paymentDate: string) => Promise<void>;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDeleteDialogPasswordChange: (password: string) => void;
  onConfirmProtectedDelete: () => void;
  onCancelProtectedDelete: () => void;
}

export const InvoicesPageContent = ({
  activeTab,
  onActiveTabChange,
  invoices,
  paginatedInvoices,
  filteredInvoices,
  selectedInvoices,
  selectedInvoiceIds,
  isMobile,
  searchTerm,
  statusFilter,
  sortField,
  sortDirection,
  currentPage,
  totalPages,
  exportModalOpen,
  markAsPaidInvoice,
  deleteDialogState,
  batchProgressState,
  onBatchProgressClose,
  onCreateInvoice,
  onOpenExportModal,
  onSearchChange,
  onStatusFilterChange,
  onBatchMarkAsPaid,
  onBatchDelete,
  onBatchExport,
  onClearSelection,
  onEditInvoice,
  onDeleteInvoice,
  onMarkAsPaid,
  onRefresh,
  onSort,
  onInvoiceToggle,
  onSelectAllToggle,
  onPageChange,
  getInvoiceWithDetails,
  onExportModalOpenChange,
  onMarkAsPaidModalClose,
  onConfirmMarkAsPaid,
  onDeleteDialogOpenChange,
  onDeleteDialogPasswordChange,
  onConfirmProtectedDelete,
  onCancelProtectedDelete,
}: InvoicesPageContentProps) => {
  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={onActiveTabChange}
        className="w-full"
      >
        <SectionCard flush className="finance-panel border-border/70 bg-card/80 shadow-sm" contentClassName="p-2">
          <TabsList className="finance-tabs w-full gap-1 lg:grid lg:grid-cols-5">
            <TabsTrigger value="invoices" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="hidden sm:inline">Facturas</span>
              <span className="sm:hidden">Fact.</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Alertas
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="hidden sm:inline">Conciliación</span>
              <span className="sm:hidden">Conc.</span>
            </TabsTrigger>
            <TabsTrigger value="cancellations" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="hidden sm:inline">Anulaciones</span>
              <span className="sm:hidden">Anul.</span>
            </TabsTrigger>
          </TabsList>
        </SectionCard>

        <TabsContent value="invoices">
          <InvoicesListTabContent
            invoices={invoices}
            paginatedInvoices={paginatedInvoices}
            selectedInvoices={selectedInvoices}
            selectedInvoiceIds={selectedInvoiceIds}
            isMobile={isMobile}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            sortField={sortField}
            sortDirection={sortDirection}
            currentPage={currentPage}
            totalPages={totalPages}
            onCreateInvoice={onCreateInvoice}
            onOpenExportModal={onOpenExportModal}
            onSearchChange={onSearchChange}
            onStatusFilterChange={onStatusFilterChange}
            onBatchMarkAsPaid={onBatchMarkAsPaid}
            onBatchDelete={onBatchDelete}
            onBatchExport={onBatchExport}
            onClearSelection={onClearSelection}
            onEditInvoice={onEditInvoice}
            onDeleteInvoice={onDeleteInvoice}
            onMarkAsPaid={onMarkAsPaid}
            onRefresh={onRefresh}
            onSort={onSort}
            onInvoiceToggle={onInvoiceToggle}
            onSelectAllToggle={onSelectAllToggle}
            onPageChange={onPageChange}
            getInvoiceWithDetails={getInvoiceWithDetails}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          <InvoicesPipelineView
            invoices={invoices}
            loading={false}
            onEdit={onEditInvoice}
            onDelete={onDeleteInvoice}
            onMarkAsPaid={onMarkAsPaid}
            onView={onEditInvoice}
            getInvoiceWithDetails={getInvoiceWithDetails}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <InvoiceAlertsDashboard />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentReconciliation onClose={() => onActiveTabChange('invoices')} />
        </TabsContent>

        <TabsContent value="cancellations">
          <InvoiceCancellationsHistory />
        </TabsContent>

      </Tabs>

      <InvoiceExportModal
        open={exportModalOpen}
        onOpenChange={onExportModalOpenChange}
        initialInvoices={filteredInvoices}
      />

      <BatchProgressModal
        state={batchProgressState}
        onClose={onBatchProgressClose}
      />

      <MarkAsPaidModal
        invoice={markAsPaidInvoice}
        isOpen={!!markAsPaidInvoice}
        onClose={onMarkAsPaidModalClose}
        onConfirm={onConfirmMarkAsPaid}
      />

      <InvoicesProtectedDeleteDialog
        state={deleteDialogState}
        onOpenChange={onDeleteDialogOpenChange}
        onPasswordChange={onDeleteDialogPasswordChange}
        onConfirm={onConfirmProtectedDelete}
        onCancel={onCancelProtectedDelete}
      />
    </div>
  );
};
