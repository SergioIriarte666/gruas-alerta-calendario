import { businessClock } from '@/utils/businessClock';
import { useMemo, useState } from 'react';
import { Invoice } from '@/types';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, User, Calendar, Building2, Archive } from 'lucide-react';
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

interface DepartmentGroup {
  department: string;
  invoices: Invoice[];
  totalAmount: number;
  count: number;
  months: MonthGroup[];
}

interface ClientGroup {
  clientRut: string;
  clientName: string;
  invoices: Invoice[];
  totalAmount: number;
  count: number;
  departmentGroups: DepartmentGroup[];
  hasMultipleDepartments: boolean;
}

const getClientTheme = (name: string) => {
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

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Pagada', className: 'border-success/30 bg-success/10 text-success' },
    sent: { label: 'Enviada', className: 'border-info/30 bg-info/10 text-info' },
    overdue: { label: 'Vencida', className: 'border-danger/30 bg-danger/10 text-danger' },
    draft: { label: 'Borrador', className: 'border-border/70 bg-muted/40 text-muted-foreground' },
    cancelled: { label: 'Anulada', className: 'border-warning/30 bg-warning/10 text-warning line-through' },
  };
  const s = map[status] || { label: status, className: 'border-border/70 bg-muted/40 text-muted-foreground' };
  return <Badge className={s.className}>{s.label}</Badge>;
};

const buildMonthGroups = (invoices: Invoice[]): MonthGroup[] => {
  const monthMap = new Map<string, MonthGroup>();
  invoices.forEach(inv => {
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
  return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
};

// Shared month+invoice rendering
const MonthSection = ({
  month,
  monthKey,
  isExpanded,
  onToggle,
  onEdit,
}: {
  month: MonthGroup;
  monthKey: string;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  onEdit: (inv: Invoice) => void;
}) => (
  <Collapsible open={isExpanded} onOpenChange={() => onToggle(monthKey)}>
    <CollapsibleTrigger asChild>
      <div className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-accent/30 transition-colors border-b last:border-b-0">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm capitalize">{month.label}</span>
          <span className="text-xs text-muted-foreground">({month.invoices.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary">{formatCurrency(month.total)}</span>
          {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
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
              <p className="text-xs text-muted-foreground mb-1 truncate" title={inv.productServiceDescription}>
                {inv.productServiceDescription}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {businessClock.format(inv.issueDate, 'dd/MM/yyyy')}
              </p>
              <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)}</p>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

export const HistoricalSalesPipelineView = ({ invoices, onEdit, onDelete: _onDelete }: HistoricalSalesPipelineViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set(['all']));
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const search = searchTerm.toLowerCase();
    return invoices.filter(inv =>
      inv.client?.name?.toLowerCase().includes(search) ||
      inv.folio.toLowerCase().includes(search) ||
      inv.numeroFiscal?.toLowerCase().includes(search) ||
      inv.productServiceDescription.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);

  const clientGroups = useMemo(() => {
    const groupsMap = new Map<string, ClientGroup>();

    filteredInvoices.forEach(inv => {
      const clientRut = inv.client?.rut || 'no_client';
      const clientName = inv.client?.name ? toTitleCase(inv.client.name) : 'Sin Cliente';

      if (!groupsMap.has(clientRut)) {
        groupsMap.set(clientRut, {
          clientRut,
          clientName,
          invoices: [],
          totalAmount: 0,
          count: 0,
          departmentGroups: [],
          hasMultipleDepartments: false,
        });
      }

      const group = groupsMap.get(clientRut)!;
      group.invoices.push(inv);
      group.totalAmount += inv.total;
      group.count += 1;
    });

    // Build department sub-groups
    groupsMap.forEach(group => {
      const deptMap = new Map<string, DepartmentGroup>();

      group.invoices.forEach(inv => {
        const dept = inv.folio.startsWith('HIST-') ? 'Importado' : (inv.client?.department || 'General');
        if (!deptMap.has(dept)) {
          deptMap.set(dept, { department: dept, invoices: [], totalAmount: 0, count: 0, months: [] });
        }
        const d = deptMap.get(dept)!;
        d.invoices.push(inv);
        d.totalAmount += inv.total;
        d.count += 1;
      });

      // Build months within each department
      deptMap.forEach(dg => {
        dg.months = buildMonthGroups(dg.invoices);
      });

      group.departmentGroups = Array.from(deptMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
      group.hasMultipleDepartments = group.departmentGroups.length > 1;
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices]);

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  };
  const toggleDepartment = (key: string) => {
    setExpandedDepartments(prev => {
      const s = new Set(prev);
      if (s.has(key)) {
        s.delete(key);
      } else {
        s.add(key);
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
    const clients = new Set(['all', ...clientGroups.map(g => g.clientRut)]);
    const depts = new Set<string>();
    const months = new Set<string>();
    clientGroups.forEach(g => {
      g.departmentGroups.forEach(dg => {
        const deptKey = `${g.clientRut}-${dg.department}`;
        depts.add(deptKey);
        dg.months.forEach(m => months.add(`${deptKey}-${m.key}`));
      });
    });
    setExpandedClients(clients);
    setExpandedDepartments(depts);
    setExpandedMonths(months);
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedDepartments(new Set());
    setExpandedMonths(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Search & controls */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
        <span className="font-semibold text-primary">
          Total: {formatCurrency(filteredInvoices.reduce((s, i) => s + i.total, 0))}
        </span>
      </div>

      {/* Client groups */}
      <div className="space-y-4">
        {clientGroups.map(group => {
          const isExpanded = expandedClients.has(group.clientRut);
          const theme = group.clientRut === 'no_client'
            ? {
                border: 'border-t-border/70',
                iconWrapper: 'bg-muted/40',
                icon: 'text-muted-foreground',
                pill: 'bg-muted/50 text-muted-foreground',
              }
            : getClientTheme(group.clientName);

          return (
            <Collapsible key={group.clientRut} open={isExpanded} onOpenChange={() => toggleClient(group.clientRut)}>
              <div className={`overflow-hidden rounded-lg border border-border/70 border-t-4 bg-card ${theme.border}`}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${theme.iconWrapper}`}>
                        <User className={`size-5 ${theme.icon}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.clientName}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${theme.pill}`}>
                            {group.count}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(group.totalAmount)}
                          <span className="text-muted-foreground font-normal">
                            {' · '}
                            {group.hasMultipleDepartments
                              ? `${group.departmentGroups.length} departamentos`
                              : `${group.departmentGroups[0]?.months.length || 0} ${(group.departmentGroups[0]?.months.length || 0) === 1 ? 'mes' : 'meses'}`
                            }
                          </span>
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="size-5 text-muted-foreground" /> : <ChevronRight className="size-5 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    {group.hasMultipleDepartments ? (
                      // Render department level
                      group.departmentGroups.map(dg => {
                        const deptKey = `${group.clientRut}-${dg.department}`;
                        const isDeptExpanded = expandedDepartments.has(deptKey);

                        return (
                          <Collapsible key={deptKey} open={isDeptExpanded} onOpenChange={() => toggleDepartment(deptKey)}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-accent/40 transition-colors border-b last:border-b-0">
                                <div className="flex items-center gap-2">
                                  {dg.department === 'Importado' ? (
                                    <Archive className="size-4 text-muted-foreground" />
                                  ) : (
                                    <Building2 className="size-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium text-sm">{dg.department}</span>
                                  <span className="text-xs text-muted-foreground">({dg.count})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-primary">{formatCurrency(dg.totalAmount)}</span>
                                  {isDeptExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-4 border-l-2 border-muted ml-5">
                                {dg.months.map(month => {
                                  const monthKey = `${deptKey}-${month.key}`;
                                  return (
                                    <MonthSection
                                      key={monthKey}
                                      month={month}
                                      monthKey={monthKey}
                                      isExpanded={expandedMonths.has(monthKey)}
                                      onToggle={toggleMonth}
                                      onEdit={onEdit}
                                    />
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    ) : (
                      // Single department: skip department level, render months directly
                      group.departmentGroups[0]?.months.map(month => {
                        const monthKey = `${group.clientRut}-${month.key}`;
                        return (
                          <MonthSection
                            key={monthKey}
                            month={month}
                            monthKey={monthKey}
                            isExpanded={expandedMonths.has(monthKey)}
                            onToggle={toggleMonth}
                            onEdit={onEdit}
                          />
                        );
                      })
                    )}
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
