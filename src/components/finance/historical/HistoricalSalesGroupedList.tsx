import { useState, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Calendar } from 'lucide-react';
import { Invoice } from '@/types';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { HistoricalSalesTable, SortConfig, SortKey } from './HistoricalSalesTable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoricalSalesGroupedListProps {
  invoices: Invoice[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  onEdit: (invoice: Invoice) => void;
}

export const HistoricalSalesGroupedList = ({
  invoices,
  sortConfig,
  onSort,
  onEdit,
}: HistoricalSalesGroupedListProps) => {
  // Persistence for expanded groups
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [groupSearchTerms, setGroupSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('historical-sales-expanded-groups');
    if (saved) {
      try {
        setExpandedGroups(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse expanded groups', e);
      }
    }
    
    // Also load expanded months
    const savedMonths = localStorage.getItem('historical-sales-expanded-months');
    if (savedMonths) {
      try {
        setExpandedMonths(JSON.parse(savedMonths));
      } catch (e) {
        console.error('Failed to parse expanded months', e);
      }
    }
  }, []);

  const handleExpansionChange = (value: string[]) => {
    setExpandedGroups(value);
    localStorage.setItem('historical-sales-expanded-groups', JSON.stringify(value));
  };

  const handleMonthExpansionChange = (value: string[]) => {
    setExpandedMonths(value);
    localStorage.setItem('historical-sales-expanded-months', JSON.stringify(value));
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
      <div className="text-center py-8 text-muted-foreground border rounded-md">
        No se encontraron resultados para agrupar.
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
            inv.total.toString().includes(lowerTerm) ||
            inv.status.toLowerCase().includes(lowerTerm)
          );
        });

        const totalAmount = allClientInvoices.reduce((sum, inv) => sum + inv.total, 0);

        // Group by Month inside Client
        const invoicesByMonth = filteredClientInvoices.reduce((acc, invoice) => {
          const date = new Date(invoice.issueDate);
          const monthKey = format(date, 'yyyy-MM'); // Sortable key
          const monthLabel = format(date, 'MMMM yyyy', { locale: es });
          
          if (!acc[monthKey]) {
            acc[monthKey] = {
              label: toTitleCase(monthLabel),
              invoices: [],
              total: 0
            };
          }
          acc[monthKey].invoices.push(invoice);
          acc[monthKey].total += invoice.total;
          return acc;
        }, {} as Record<string, { label: string, invoices: Invoice[], total: number }>);

        // Sort months descending (newest first)
        const sortedMonthKeys = Object.keys(invoicesByMonth).sort().reverse();

        return (
          <AccordionItem 
            key={clientName} 
            value={clientName}
            className="border rounded-lg bg-card"
          >
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4 w-full pr-4">
                <span className="font-semibold text-base truncate flex-1 text-left">
                  {toTitleCase(clientName)}
                </span>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {allClientInvoices.length} facturas
                  </Badge>
                  <span className="font-medium text-foreground">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 px-2">
              <div className="mt-2 space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar facturas en este grupo..."
                    className="pl-9 bg-background"
                    value={searchTerm}
                    onChange={(e) => handleGroupSearch(clientName, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {filteredClientInvoices.length > 0 ? (
                  <Accordion
                    type="multiple"
                    className="w-full space-y-2 mt-4"
                    value={expandedMonths}
                    onValueChange={handleMonthExpansionChange}
                  >
                    {sortedMonthKeys.map((monthKey) => {
                      const { label, invoices: monthInvoices, total: monthTotal } = invoicesByMonth[monthKey];
                      const uniqueMonthKey = `${clientName}-${monthKey}`; // Unique key for persistence

                      return (
                        <AccordionItem 
                          key={uniqueMonthKey} 
                          value={uniqueMonthKey}
                          className="border rounded-md bg-muted/20"
                        >
                          <AccordionTrigger className="px-3 py-2 hover:bg-muted/50 rounded-md text-sm">
                            <div className="flex items-center gap-3 w-full pr-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium flex-1 text-left">
                                {label}
                              </span>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  {monthInvoices.length}
                                </Badge>
                                <span className="font-medium text-xs">
                                  {formatCurrency(monthTotal)}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-3 px-2 bg-background/50">
                            <HistoricalSalesTable
                              invoices={monthInvoices}
                              sortConfig={sortConfig}
                              onSort={onSort}
                              onEdit={onEdit}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron facturas con "{searchTerm}" en este grupo.
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
