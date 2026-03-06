import { useMemo, useState } from 'react';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, Truck, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoricalPurchasesPipelineViewProps {
  invoices: SupplierInvoiceWithDetails[];
  onEdit: (invoice: SupplierInvoiceWithDetails) => void;
  onDelete: (id: string) => void;
}

interface MonthGroup {
  key: string;
  label: string;
  invoices: SupplierInvoiceWithDetails[];
  total: number;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  invoices: SupplierInvoiceWithDetails[];
  totalAmount: number;
  count: number;
  months: MonthGroup[];
}

const getSupplierColor = (name: string) => {
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

const getStatusBadge = (status: string | null) => {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Pagada', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    overdue: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    partial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  const s = map[status || ''] || { label: status || 'N/A', className: 'bg-muted text-muted-foreground' };
  return <Badge className={s.className}>{s.label}</Badge>;
};

export const HistoricalPurchasesPipelineView = ({ invoices, onEdit, onDelete }: HistoricalPurchasesPipelineViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set(['all']));
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const search = searchTerm.toLowerCase();
    return invoices.filter(inv =>
      inv.supplier?.name?.toLowerCase().includes(search) ||
      inv.invoice_number.toLowerCase().includes(search) ||
      inv.description?.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);

  const supplierGroups = useMemo(() => {
    const groupsMap = new Map<string, SupplierGroup>();

    filteredInvoices.forEach(inv => {
      const supplierId = inv.supplier_id || 'no_supplier';
      const supplierName = inv.supplier?.name ? toTitleCase(inv.supplier.name) : 'Sin Proveedor';

      if (!groupsMap.has(supplierId)) {
        groupsMap.set(supplierId, {
          supplierId,
          supplierName,
          invoices: [],
          totalAmount: 0,
          count: 0,
          months: [],
        });
      }

      const group = groupsMap.get(supplierId)!;
      group.invoices.push(inv);
      group.totalAmount += inv.amount;
      group.count += 1;
    });

    groupsMap.forEach(group => {
      const monthMap = new Map<string, MonthGroup>();
      group.invoices.forEach(inv => {
        const date = parseISO(inv.issue_date);
        const key = format(date, 'yyyy-MM');
        const label = format(date, 'MMMM yyyy', { locale: es });

        if (!monthMap.has(key)) {
          monthMap.set(key, { key, label, invoices: [], total: 0 });
        }
        const m = monthMap.get(key)!;
        m.invoices.push(inv);
        m.total += inv.amount;
      });

      group.months = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices]);

  const toggleSupplier = (id: string) => {
    setExpandedSuppliers(prev => {
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
    const allKeys = new Set(['all', ...supplierGroups.map(g => g.supplierId)]);
    supplierGroups.forEach(g => g.months.forEach(m => allKeys.add(`${g.supplierId}-${m.key}`)));
    setExpandedSuppliers(allKeys);
    setExpandedMonths(allKeys);
  };

  const collapseAll = () => {
    setExpandedSuppliers(new Set());
    setExpandedMonths(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por proveedor, N° factura o descripción..."
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

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredInvoices.length} facturas en {supplierGroups.length} proveedores</span>
        <span className="font-semibold text-primary">
          Total: {formatCurrency(filteredInvoices.reduce((s, i) => s + i.amount, 0))}
        </span>
      </div>

      <div className="space-y-4">
        {supplierGroups.map(group => {
          const isExpanded = expandedSuppliers.has(group.supplierId);
          const color = group.supplierId === 'no_supplier' ? '#9ca3af' : getSupplierColor(group.supplierName);

          return (
            <Collapsible key={group.supplierId} open={isExpanded} onOpenChange={() => toggleSupplier(group.supplierId)}>
              <div className="bg-card border rounded-lg overflow-hidden" style={{ borderTopWidth: '3px', borderTopColor: color }}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                        <Truck className="h-5 w-5" style={{ color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.supplierName}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}20`, color }}>
                            {group.count}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(group.totalAmount)} · {group.months.length} {group.months.length === 1 ? 'mes' : 'meses'}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    {group.months.map(month => {
                      const monthKey = `${group.supplierId}-${month.key}`;
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
                                <span className="text-sm font-semibold text-primary">{formatCurrency(month.total)}</span>
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
                                      <span className="font-mono text-sm font-semibold text-foreground">{inv.invoice_number}</span>
                                      {getStatusBadge(inv.status)}
                                    </div>
                                    {inv.description && (
                                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{inv.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {format(parseISO(inv.issue_date), 'dd/MM/yyyy')}
                                    </p>
                                    <p className="text-sm font-bold text-primary">{formatCurrency(inv.amount)}</p>
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

        {supplierGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No se encontraron facturas</p>
          </div>
        )}
      </div>
    </div>
  );
};
