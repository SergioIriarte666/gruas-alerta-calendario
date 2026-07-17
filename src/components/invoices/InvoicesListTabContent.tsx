import { Invoice } from '@/types';
import InvoicesHeader from '@/components/invoices/InvoicesHeader';
import InvoicesStats from '@/components/invoices/InvoicesStats';
import InvoicesSearch from '@/components/invoices/InvoicesSearch';
import { InvoicesMobileView } from '@/components/invoices/InvoicesMobileView';
import InvoicesTable from '@/components/invoices/InvoicesTable';
import InvoiceBatchActions from '@/components/invoices/InvoiceBatchActions';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import { AppPagination } from '@/components/shared/AppPagination';

const INVOICE_STATUS_MAP: { [key: string]: string } = {
  all: 'Todas',
  draft: 'Borrador',
  sent: 'Enviada',
  due_this_week: 'Vence esta semana',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
};

interface InvoicesListTabContentProps {
  invoices: Invoice[];
  paginatedInvoices: Invoice[];
  selectedInvoices: Invoice[];
  selectedInvoiceIds: string[];
  isMobile: boolean;
  searchTerm: string;
  statusFilter: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  totalPages: number;
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
}

export const InvoicesListTabContent = ({
  invoices,
  paginatedInvoices,
  selectedInvoices,
  selectedInvoiceIds,
  isMobile,
  searchTerm,
  statusFilter,
  sortField,
  sortDirection,
  currentPage,
  totalPages,
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
}: InvoicesListTabContentProps) => {
  return (
    <div className="space-y-6">
      <InvoicesHeader
        onCreateInvoice={onCreateInvoice}
        onOpenExportModal={onOpenExportModal}
      />

      <InvoicesStats invoices={invoices.filter((invoice) => !invoice.folio.startsWith('HIST-'))} />

      <SectionCard
        className="finance-filter-panel border-border/70 bg-card/80 shadow-sm"
        contentClassName="space-y-4"
        title="Búsqueda y Estado"
        description="Filtra por cliente, folio, número fiscal o prioridad de cobranza."
      >
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-center gap-4`}>
          <div className="flex-grow w-full">
            <InvoicesSearch
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
            />
          </div>
          <div className="overflow-x-auto w-full">
            <div className="flex items-center gap-x-1 rounded-xl border border-border/70 bg-background/70 p-1 whitespace-nowrap">
              {Object.entries(INVOICE_STATUS_MAP).map(([statusKey, statusValue]) => (
                <Button
                  key={statusKey}
                  variant="ghost"
                  size="sm"
                  onClick={() => onStatusFilterChange(statusKey)}
                  className={cn(
                    'capitalize rounded-lg px-3 py-1 text-sm text-muted-foreground hover:text-foreground flex-shrink-0',
                    statusFilter === statusKey && 'bg-primary text-primary-foreground hover:text-primary-foreground'
                  )}
                >
                  {statusValue}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {selectedInvoiceIds.length > 0 && (
        <InvoiceBatchActions
          selectedInvoices={selectedInvoices}
          onMarkAsPaid={onBatchMarkAsPaid}
          onDelete={onBatchDelete}
          onExport={onBatchExport}
          onClearSelection={onClearSelection}
        />
      )}

      {isMobile ? (
        <InvoicesMobileView
          invoices={paginatedInvoices}
          onEdit={onEditInvoice}
          onDelete={onDeleteInvoice}
          onMarkAsPaid={onMarkAsPaid}
          getInvoiceWithDetails={getInvoiceWithDetails}
          onRefresh={onRefresh}
        />
      ) : (
        <InvoicesTable
          invoices={paginatedInvoices}
          onEdit={onEditInvoice}
          onDelete={onDeleteInvoice}
          onMarkAsPaid={onMarkAsPaid}
          getInvoiceWithDetails={getInvoiceWithDetails}
          onRefresh={onRefresh}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
          selectedInvoiceIds={selectedInvoiceIds}
          onInvoiceToggle={onInvoiceToggle}
          onSelectAllToggle={onSelectAllToggle}
        />
      )}

      {totalPages > 1 && (
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
