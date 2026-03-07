import { useMemo, useState } from 'react';
import { Invoice } from '@/types';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, User, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoricalSalesPipelineViewProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
}

interface MonthGroup {
  key: string;
  label: string;
  invoices: Invoice[];
  total: number;
}

interface ClientGroup {
  clientRut: string;
  clientName: string;
  departments: string[];
  invoices: Invoice[];
  totalAmount: number;
  count: number;
  months: MonthGroup[];
}

const getClientColor = (name: string) => {
  const colors = [
    '#8b5cf6', '#3b82f6', '#a855f7', '#f59e0b',
    '#ef4444', '#06b6d4', '#ec4899', '#7c3aed',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Pagada', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    sent: { label: 'Enviada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    overdue: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground line-through' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <Badge className={s.className}>{s.label}</Badge>;
};

export const HistoricalSalesPipelineView = ({ invoices, onEdit, onDelete }: HistoricalSalesPipelineViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set(['all']));
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const search = searchTerm.toLowerCase();
    return invoices.filter(inv =>
      inv.client?.name?.toLowerCase().includes(search) ||
      inv.folio.toLowerCase().includes(search) ||
      inv.numeroFiscal?.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);

  const clientGroups = useMemo(() => {
    const groupsMap = new Map<string, ClientGroup>();

    filteredInvoices.forEach(inv => {
      const clientRut = inv.client?.rut || 'no_client';
      const clientName = inv.client?.name ? toTitleCase(inv.client.name) : 'Sin Cliente';
      const department = inv.client?.department || '';

      if (!groupsMap.has(clientRut)) {
        groupsMap.set(clientRut, {
          clientRut,
          clientName,
          departments: [],
          invoices: [],
          totalAmount: 0,
          count: 0,
          months: [],
        });
      }

      const group = groupsMap.get(clientRut)!;
      group.invoices.push(inv);
      group.totalAmount += inv.total;
      group.count += 1;
      if (department && department !== 'General' && !group.departments.includes(department)) {
        group.departments.push(department);
      }
    });

    // Sub-group by month
    groupsMap.forEach(group => {
      const monthMap = new Map<string, MonthGroup>();
      group.invoices.forEach(inv => {
        const date = parseISO(inv.issueDate);
        const key = format(date, 'yyyy-MM');
        const label = format(date, 'MMMM yyyy', { locale: es });

        if (!monthMap.has(key)) {
          monthMap.set(key, { key, label, invoices: [], total: 0 });
        }
        const m = monthMap.get(key)!;
        m.invoices.push(inv);
        m.total += inv.total;
      });

      group.months = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices]);

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const expandAll = () => {
    const allKeys = new Set(['all', ...clientGroups.map(g => g.clientRut)]);
    clientGroups.forEach(g => g.months.forEach(m => allKeys.add(`${g.clientRut}-${m.key}`)));
    setExpandedClients(allKeys);
    setExpandedMonths(allKeys);
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedMonths(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Search & controls */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, folio o N° fiscal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>Expandir todo</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar todo</Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredInvoices.length} facturas en {clientGroups.length} clientes</span>
        <span className="font-semibold text-violet-600 dark:text-violet-400">
          Total: {formatCurrency(filteredInvoices.reduce((s, i) => s + i.total, 0))}
        </span>
      </div>

      {/* Client groups */}
      <div className="space-y-4">
        {clientGroups.map(group => {
          const isExpanded = expandedClients.has(group.clientRut);
          const color = group.clientRut === 'no_client' ? '#9ca3af' : getClientColor(group.clientName);

          return (
            <Collapsible key={group.clientRut} open={isExpanded} onOpenChange={() => toggleClient(group.clientRut)}>
              <div className="bg-card border rounded-lg overflow-hidden" style={{ borderTopWidth: '3px', borderTopColor: color }}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                        <User className="h-5 w-5" style={{ color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.clientName}</h3>
                          {group.departments.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({group.departments.join(', ')})
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}20`, color }}>
                            {group.count}
                          </span>
                        </div>
                        <p className="text-sm text-violet-600 dark:text-violet-400 font-semibold">
                          {formatCurrency(group.totalAmount)} <span className="text-muted-foreground font-normal">· {group.months.length} {group.months.length === 1 ? 'mes' : 'meses'}</span>
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    {group.months.map(month => {
                      const monthKey = `${group.clientRut}-${month.key}`;
                      const isMonthExpanded = expandedMonths.has(monthKey);

                      return (
                        <Collapsible key={monthKey} open={isMonthExpanded} onOpenChange={() => toggleMonth(monthKey)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-accent/30 transition-colors border-b last:border-b-0">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm capitalize">{month.label}</span>
                                <span className="text-xs text-muted-foreground">({month.invoices.length})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(month.total)}</span>
                                {isMonthExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="px-6 py-4 bg-accent/10">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {month.invoices.map(inv => (
                                  <div
                                    key={inv.id}
                                    className="bg-card border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                                    onClick={() => onEdit(inv)}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-mono text-sm font-semibold text-foreground">{inv.folio}</span>
                                      {getStatusBadge(inv.status)}
                                    </div>
                                    {inv.numeroFiscal && (
                                      <p className="text-xs text-muted-foreground mb-1">N° Fiscal: {inv.numeroFiscal}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {format(parseISO(inv.issueDate), 'dd/MM/yyyy')}
                                    </p>
                                    <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{formatCurrency(inv.total)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {clientGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No se encontraron facturas</p>
          </div>
        )}
      </div>
    </div>
  );
};
