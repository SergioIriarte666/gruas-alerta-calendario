import { useMemo, useState } from 'react';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, Truck, Calendar, Trash2 } from 'lucide-react';
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

const getSupplierTheme = (name: string) => {
  const themes = [
    {
      border: 'border-t-primary/40',
      iconWrapper: 'bg-primary/10',
      icon: 'text-primary',
      pill: 'bg-primary/10 text-primary',
    },
    {
      border: 'border-t-info/40',
      iconWrapper: 'bg-info/10',
      icon: 'text-info',
      pill: 'bg-info/10 text-info',
    },
    {
      border: 'border-t-success/40',
      iconWrapper: 'bg-success/10',
      icon: 'text-success',
      pill: 'bg-success/10 text-success',
    },
    {
      border: 'border-t-warning/40',
      iconWrapper: 'bg-warning/10',
      icon: 'text-warning',
      pill: 'bg-warning/10 text-warning',
    },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return themes[Math.abs(hash) % themes.length];
};

const getStatusBadge = (status: string | null) => {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Pagada', className: 'border-success/30 bg-success/10 text-success' },
    pending: { label: 'Pendiente', className: 'border-warning/30 bg-warning/10 text-warning' },
    overdue: { label: 'Vencida', className: 'border-danger/30 bg-danger/10 text-danger' },
    partial: { label: 'Parcial', className: 'border-info/30 bg-info/10 text-info' },
  };
  const s = map[status || ''] || { label: status || 'N/A', className: 'border-border/70 bg-muted/40 text-muted-foreground' };
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
      (inv.product_service_description || inv.description || '').toLowerCase().includes(search)
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
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const s = new Set(prev);
      if (s.has(key)) {
        s.delete(key);
      } else {
        s.add(key);
      }
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
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
          const theme = group.supplierId === 'no_supplier'
            ? {
                border: 'border-t-border/70',
                iconWrapper: 'bg-muted/40',
                icon: 'text-muted-foreground',
                pill: 'bg-muted/50 text-muted-foreground',
              }
            : getSupplierTheme(group.supplierName);

          return (
            <Collapsible key={group.supplierId} open={isExpanded} onOpenChange={() => toggleSupplier(group.supplierId)}>
              <div className={`overflow-hidden rounded-lg border border-border/70 border-t-4 bg-card ${theme.border}`}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${theme.iconWrapper}`}>
                        <Truck className={`size-5 ${theme.icon}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.supplierName}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${theme.pill}`}>
                            {group.count}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(group.totalAmount)} <span className="text-muted-foreground font-normal">· {group.months.length} {group.months.length === 1 ? 'mes' : 'meses'}</span>
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="size-5 text-muted-foreground" /> : <ChevronRight className="size-5 text-muted-foreground" />}
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
                                <Calendar className="size-4 text-muted-foreground" />
                                <span className="font-medium text-sm capitalize">{month.label}</span>
                                <span className="text-xs text-muted-foreground">({month.invoices.length})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-primary">{formatCurrency(month.total)}</span>
                                {isMonthExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="px-6 py-4 bg-accent/10">
                              <div className="bg-card border rounded-lg overflow-hidden">
                                {month.invoices.map((inv) => (
                                  <div
                                    key={inv.id}
                                    className="flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-accent/30 transition-colors cursor-pointer"
                                    onClick={() => onEdit(inv)}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold text-foreground">
                                          {inv.invoice_number}
                                        </span>
                                        {getStatusBadge(inv.status)}
                                      </div>
                                      {(inv.product_service_description || inv.description) && (
                                        <div className="text-xs text-muted-foreground truncate">
                                          {inv.product_service_description || inv.description}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <span className="text-xs text-muted-foreground tabular-nums">
                                        {format(parseISO(inv.issue_date), 'dd/MM/yyyy')}
                                      </span>
                                      <span className="text-sm font-semibold text-primary tabular-nums">
                                        {formatCurrency(inv.amount)}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDelete(inv.id);
                                        }}
                                      >
                                        <Trash2 className="size-4 text-muted-foreground" />
                                      </Button>
                                    </div>
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
