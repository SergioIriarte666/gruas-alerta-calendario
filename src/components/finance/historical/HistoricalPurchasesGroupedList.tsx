import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Search, Truck } from 'lucide-react';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { HistoricalPurchasesTable, PurchaseSortConfig, PurchaseSortKey } from './HistoricalPurchasesTable';

interface HistoricalPurchasesGroupedListProps {
  invoices: SupplierInvoiceWithDetails[];
  invoiceItemsMap?: Record<string, string[]>;
  sortConfig: PurchaseSortConfig;
  onSort: (key: PurchaseSortKey) => void;
  onEdit: (invoice: SupplierInvoiceWithDetails) => void;
  onDelete?: (id: string) => void;
  onReceiveInventory?: (invoice: SupplierInvoiceWithDetails) => void;
  selectedIds?: string[];
  onSelectId?: (id: string, checked: boolean) => void;
  onSelectAll?: (ids: string[], checked: boolean) => void;
}

export const HistoricalPurchasesGroupedList = ({
  invoices,
  invoiceItemsMap,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  onReceiveInventory,
  selectedIds,
  onSelectId,
  onSelectAll,
}: HistoricalPurchasesGroupedListProps) => {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [groupSearchTerms, setGroupSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('historical-purchases-expanded-groups');
    if (saved) {
      try {
        setExpandedGroups(JSON.parse(saved));
      } catch {
        setExpandedGroups([]);
      }
    }
  }, []);

  const handleExpansionChange = (value: string[]) => {
    setExpandedGroups(value);
    localStorage.setItem('historical-purchases-expanded-groups', JSON.stringify(value));
  };

  const handleGroupSearch = (groupId: string, term: string) => {
    setGroupSearchTerms(prev => ({
      ...prev,
      [groupId]: term,
    }));
  };

  const grouped = useMemo(() => {
    return invoices.reduce((acc, invoice) => {
      const supplierId = invoice.supplier_id || 'no_supplier';
      const supplierName = invoice.supplier?.name || 'Proveedor Desconocido';
      if (!acc[supplierId]) {
        acc[supplierId] = { supplierName, invoices: [] as SupplierInvoiceWithDetails[] };
      }
      acc[supplierId].invoices.push(invoice);
      return acc;
    }, {} as Record<string, { supplierName: string; invoices: SupplierInvoiceWithDetails[] }>);
  }, [invoices]);

  const sortedGroupIds = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const nameA = (grouped[a]?.supplierName || '').toLowerCase();
      const nameB = (grouped[b]?.supplierName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [grouped]);

  if (sortedGroupIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
        <Truck className="mx-auto size-12 opacity-20 mb-3" />
        <p className="text-lg font-medium">No se encontraron resultados para agrupar.</p>
        <p className="text-sm">Intenta ajustar los filtros.</p>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      className="w-full space-y-4"
      value={expandedGroups}
      onValueChange={handleExpansionChange}
    >
      {sortedGroupIds.map((supplierId) => {
        const group = grouped[supplierId];
        const allSupplierInvoices = group.invoices;
        const searchTerm = groupSearchTerms[supplierId] || '';

        const filteredSupplierInvoices = allSupplierInvoices.filter((inv) => {
          if (!searchTerm) return true;
          const lowerTerm = searchTerm.toLowerCase();
          return (
            inv.invoice_number.toLowerCase().includes(lowerTerm) ||
            (inv.product_service_description || inv.description || '').toLowerCase().includes(lowerTerm) ||
            String(inv.amount).includes(lowerTerm) ||
            String(inv.status || '').toLowerCase().includes(lowerTerm)
          );
        });

        const totalAmount = allSupplierInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        return (
          <AccordionItem
            key={supplierId}
            value={supplierId}
            className="border rounded-lg bg-card shadow-sm overflow-hidden"
          >
            <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 transition-colors [&[data-state=open]]:bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full pr-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Truck className="size-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-lg truncate">
                      {toTitleCase(group.supplierName)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {allSupplierInvoices.length} facturas registradas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground ml-14 sm:ml-0">
                  <div className="flex flex-col sm:items-end min-w-24">
                    <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground/70">Total Comprado</span>
                    <span className="font-bold text-foreground text-lg">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-6 px-6 pt-2">
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Filtrar documentos..."
                      className="pl-9 bg-background"
                      value={searchTerm}
                      onChange={(e) => handleGroupSearch(supplierId, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {filteredSupplierInvoices.length > 0 ? (
                  <HistoricalPurchasesTable
                    invoices={filteredSupplierInvoices}
                    invoiceItemsMap={invoiceItemsMap}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReceiveInventory={onReceiveInventory}
                    hideSupplierColumn
                    selectedIds={selectedIds}
                    onSelectId={onSelectId}
                    onSelectAll={onSelectAll}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                    No se encontraron facturas con "{searchTerm}" para este proveedor.
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
