import { useState, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import { Invoice } from '@/types';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { HistoricalSalesTable, SortConfig, SortKey } from './HistoricalSalesTable';
import { createLogger } from "@/lib/logger";


const logger = createLogger("HistoricalSalesGroupedList");
interface HistoricalSalesGroupedListProps {
  invoices: Invoice[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
  selectedIds?: string[];
  onSelectId?: (id: string, checked: boolean) => void;
  onSelectAll?: (ids: string[], checked: boolean) => void;
}

export const HistoricalSalesGroupedList = ({
  invoices,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  selectedIds,
  onSelectId,
  onSelectAll,
}: HistoricalSalesGroupedListProps) => {
  // Persistence for expanded groups
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [groupSearchTerms, setGroupSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('historical-sales-expanded-groups');
    if (saved) {
      try {
        setExpandedGroups(JSON.parse(saved));
      } catch (e) {
        logger.error('Failed to parse expanded groups', e);
      }
    }
  }, []);

  const handleExpansionChange = (value: string[]) => {
    setExpandedGroups(value);
    localStorage.setItem('historical-sales-expanded-groups', JSON.stringify(value));
  };

  const handleGroupSearch = (clientName: string, term: string) => {
    setGroupSearchTerms(prev => ({
      ...prev,
      [clientName]: term
    }));
  };

  // Group by client
  const grouped = useMemo(() => {
    return invoices.reduce((acc, invoice) => {
      const clientName = invoice.client?.name || 'Cliente Desconocido';
      if (!acc[clientName]) {
        acc[clientName] = [];
      }
      acc[clientName].push(invoice);
      return acc;
    }, {} as Record<string, Invoice[]>);
  }, [invoices]);

  // Sort groups alphabetically
  const sortedGroupKeys = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  if (sortedGroupKeys.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
        <User className="mx-auto size-12 opacity-20 mb-3" />
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
      {sortedGroupKeys.map((clientName) => {
        const allClientInvoices = grouped[clientName];
        const searchTerm = groupSearchTerms[clientName] || '';
        
        // Filter invoices within group
        const filteredClientInvoices = allClientInvoices.filter(inv => {
          if (!searchTerm) return true;
          const lowerTerm = searchTerm.toLowerCase();
          return (
            inv.folio.toLowerCase().includes(lowerTerm) ||
            inv.numeroFiscal?.toLowerCase().includes(lowerTerm) ||
            inv.productServiceDescription.toLowerCase().includes(lowerTerm) ||
            inv.total.toString().includes(lowerTerm) ||
            inv.status.toLowerCase().includes(lowerTerm)
          );
        });

        const totalAmount = allClientInvoices.reduce((sum, inv) => sum + inv.total, 0);

        return (
          <AccordionItem 
            key={clientName} 
            value={clientName}
            className="border rounded-lg bg-card shadow-sm overflow-hidden"
          >
            <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 transition-colors [&[data-state=open]]:bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full pr-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <User className="size-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-lg truncate">
                      {toTitleCase(clientName)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {allClientInvoices.length} facturas registradas
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground ml-14 sm:ml-0">
                  <div className="flex flex-col sm:items-end min-w-[100px]">
                    <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground/70">Total Facturado</span>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Filtrar documentos..."
                      className="pl-9 bg-background"
                      value={searchTerm}
                      onChange={(e) => handleGroupSearch(clientName, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                {filteredClientInvoices.length > 0 ? (
                  <HistoricalSalesTable
                    invoices={filteredClientInvoices}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    hideClientColumn
                    selectedIds={selectedIds}
                    onSelectId={onSelectId}
                    onSelectAll={(_ids, checked) => onSelectAll?.(filteredClientInvoices.map(i => i.id), checked)}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                    No se encontraron facturas con "{searchTerm}" para este cliente.
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
