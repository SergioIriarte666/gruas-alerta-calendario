import React, { useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, Plus, Edit2, Trash2, CreditCard, CheckCircle,
  Clock, AlertTriangle, X, Loader2, ChevronDown, ChevronRight, Building2
} from 'lucide-react';
import { useSupplierPayments, getStatusLabel, getStatusColor } from '@/hooks/useSupplierPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCategories } from '@/hooks/useCostCategories';
import { resolveSupplierPaymentCategoryLabel } from '@/utils/suppliers/resolveSupplierPaymentCategory';
import { PaymentForm } from './PaymentForm';
import { MarkSupplierPaymentPaidModal } from './MarkSupplierPaymentPaidModal';
import { SupplierPaymentExportButton } from './SupplierPaymentExportButton';
import { SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  getCurrentChileDate, parseFromDatabase, formatForInput, formatForDisplay,
  getCurrentMonthRange, getCurrentWeekRange
} from '@/utils/timezoneUtils';

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  payments: SupplierPayment[];
  total: number;
  pendingAmount: number;
  overdueCount: number;
  hasOverdue: boolean;
}

export const PaymentList: React.FC = () => {
  const isMobile = useIsMobile();
  const { payments, isLoading, deletePayment, markPaymentAsPaid, updateOverduePayments } = useSupplierPayments();
  const { suppliers } = useSuppliers();
  const { data: costCategories = [] } = useCostCategories();

  const exportCategories = useMemo(() => costCategories.map((c) => ({ id: c.id, label: c.name })), [costCategories]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dateType, setDateType] = useState<'due_date' | 'created_at' | 'paid_date'>('due_date');
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [markAsPaidPayment, setMarkAsPaidPayment] = useState<SupplierPayment | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const toggleGroup = (supplierId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const supplier = suppliers.find(s => s.id === payment.supplier_id);
      const supplierName = supplier?.name || '';

      const matchesSearch = payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (payment.reference_number && payment.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
      const matchesSupplier = selectedSupplier === 'all' || payment.supplier_id === selectedSupplier;

      let matchesDateRange = true;
      if (dateFrom || dateTo) {
        let compareDateString: string = '';
        switch (dateType) {
          case 'due_date': compareDateString = formatForInput(parseFromDatabase(payment.due_date)); break;
          case 'created_at': compareDateString = formatForInput(parseFromDatabase(payment.created_at)); break;
          case 'paid_date':
            if (!payment.paid_date) { matchesDateRange = false; break; }
            compareDateString = formatForInput(parseFromDatabase(payment.paid_date)); break;
        }
        if (matchesDateRange) {
          const df = dateFrom ? formatForInput(dateFrom) : '';
          const dt = dateTo ? formatForInput(dateTo) : '';
          if (df && compareDateString < df) matchesDateRange = false;
          if (dt && compareDateString > dt) matchesDateRange = false;
        }
      }

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateRange;
    });
  }, [payments, suppliers, searchTerm, selectedStatus, selectedSupplier, dateFrom, dateTo, dateType]);

  // Group by supplier, sorted: overdue-suppliers first, then by name
  const supplierGroups = useMemo((): SupplierGroup[] => {
    const groupMap = new Map<string, SupplierGroup>();

    filteredPayments.forEach(payment => {
      const sid = payment.supplier_id || 'unknown';
      if (!groupMap.has(sid)) {
        const supplier = suppliers.find(s => s.id === sid);
        groupMap.set(sid, {
          supplierId: sid,
          supplierName: supplier?.name || 'Proveedor no encontrado',
          payments: [],
          total: 0,
          pendingAmount: 0,
          overdueCount: 0,
          hasOverdue: false,
        });
      }
      const g = groupMap.get(sid)!;
      g.payments.push(payment);
      g.total += payment.amount || 0;
      if (payment.status === 'pending') g.pendingAmount += payment.amount || 0;
      if (payment.status === 'overdue') { g.overdueCount++; g.hasOverdue = true; g.pendingAmount += payment.amount || 0; }
    });

    // Sort payments within each group: newest first by due_date
    groupMap.forEach(g => {
      g.payments.sort((a, b) => parseFromDatabase(b.due_date).getTime() - parseFromDatabase(a.due_date).getTime());
    });

    // Sort groups: overdue first, then alphabetically
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      return a.supplierName.localeCompare(b.supplierName, 'es');
    });
  }, [filteredPayments, suppliers]);

  // Auto-expand groups with overdue on first render
  const didAutoExpand = React.useRef(false);
  React.useEffect(() => {
    if (didAutoExpand.current) return;
    if (supplierGroups.length === 0) return;
    const overdueIds = supplierGroups.filter(g => g.hasOverdue).map(g => g.supplierId);
    if (overdueIds.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(overdueIds));
    }
    didAutoExpand.current = true;
  }, [supplierGroups, expandedGroups.size]);

  const handleEdit = (payment: SupplierPayment) => { setEditingPayment(payment); setShowForm(true); };
  const handleCloseForm = () => { setShowForm(false); setEditingPayment(null); };
  const handleDelete = (id: string) => { deletePayment(id); };
  const handleMarkAsPaid = (payment: SupplierPayment) => { setMarkAsPaidPayment(payment); };
  const handleConfirmMarkAsPaid = (payment: SupplierPayment, paymentDate: string) => {
    markPaymentAsPaid({ id: payment.id, paid_amount: payment.amount, paid_date: paymentDate });
  };

  const getSupplierName = (supplierId: string) => {
    if (supplierId === 'all') return undefined;
    return suppliers.find(s => s.id === supplierId)?.name || 'Proveedor no encontrado';
  };

  const clearDateFilters = () => { setDateFrom(undefined); setDateTo(undefined); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pagos a Proveedores</h2>
          <p className="text-muted-foreground">Agrupados por proveedor, con prioridad operativa para vencidos y pendientes.</p>
        </div>
        <div className="flex gap-2">
          <SupplierPaymentExportButton
            payments={filteredPayments}
            suppliers={suppliers}
            categories={exportCategories}
            filters={{
              searchTerm, status: selectedStatus, supplierId: selectedSupplier,
              supplierName: getSupplierName(selectedSupplier), reportType: 'current',
              dateFrom: dateFrom ? formatForInput(dateFrom) : undefined,
              dateTo: dateTo ? formatForInput(dateTo) : undefined, dateType
            }}
          />
          <Button onClick={() => updateOverduePayments()} variant="outline" size="sm" className="border-border/70 bg-card/70">
            <Clock className="size-4 mr-2" />
            Actualizar Vencidos
          </Button>
          <Button onClick={() => setShowForm(true)} variant="default" size="sm">
            <Plus className="size-4 mr-2" />
            Nuevo Pago
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Collapsible defaultOpen>
        <Card className="inventory-panel border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full mb-3">
              <h3 className="text-sm font-medium text-foreground">Filtros</h3>
              <ChevronDown className="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input placeholder="Descripción, proveedor..." value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Estado</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {statusOptions.map((s) => <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Proveedor</label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Tipo Fecha</label>
                  <Select value={dateType} onValueChange={(v: any) => setDateType(v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due_date">Vencimiento</SelectItem>
                      <SelectItem value="created_at">Creación</SelectItem>
                      <SelectItem value="paid_date">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <DatePickerInput value={dateFrom ? formatForInput(dateFrom) : ''} onChange={(val) => {
                    if (val) { const p = val.split('-'); setDateFrom(new Date(+p[0], +p[1]-1, +p[2], 0, 0, 0)); }
                    else setDateFrom(undefined);
                  }} placeholder="Desde" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <DatePickerInput value={dateTo ? formatForInput(dateTo) : ''} onChange={(val) => {
                    if (val) { const p = val.split('-'); setDateTo(new Date(+p[0], +p[1]-1, +p[2], 23, 59, 59)); }
                    else setDateTo(undefined);
                  }} placeholder="Hasta" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground mr-1">Rápido:</span>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const t = getCurrentChileDate(); setDateFrom(new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0));
                  setDateTo(new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59));
                }}>Hoy</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const { start, end } = getCurrentWeekRange(); setDateFrom(start); setDateTo(end);
                }}>Semana</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const { start, end } = getCurrentMonthRange();
                  setDateFrom(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
                  setDateTo(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
                }}>Mes</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const t = getCurrentChileDate(); const d = new Date(t); d.setDate(t.getDate() - 30); d.setHours(0,0,0,0);
                  t.setHours(23,59,59,999); setDateFrom(d); setDateTo(t);
                }}>30 días</Button>
                {(dateFrom || dateTo || searchTerm || selectedStatus !== 'all' || selectedSupplier !== 'all') && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-destructive ml-auto" onClick={() => {
                    clearDateFilters(); setSearchTerm(''); setSelectedStatus('all'); setSelectedSupplier('all');
                  }}><X className="size-3 mr-1" />Limpiar todo</Button>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Grouped Results */}
      {supplierGroups.length === 0 ? (
        <Card className="inventory-panel border bg-card">
          <CardContent className="py-12">
            <div className="text-center">
              <CreditCard className="size-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron pagos</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedStatus !== 'all' || selectedSupplier !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda' : 'Comienza agregando tu primer pago'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">
              {supplierGroups.length} proveedores · {filteredPayments.length} pagos
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpandedGroups(new Set(supplierGroups.map(g => g.supplierId)))}>
                Expandir todo
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpandedGroups(new Set())}>
                Colapsar todo
              </Button>
            </div>
          </div>

          {supplierGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.supplierId);
            return (
              <Card key={group.supplierId} className={cn("bg-card border transition-colors", group.hasOverdue && "border-destructive/40")}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.supplierId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-t-lg text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronDown className="size-4 text-muted-foreground shrink-0" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                    <Building2 className="size-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground truncate">{group.supplierName}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{group.payments.length} pagos</Badge>
                    {group.hasOverdue && (
                      <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs shrink-0">
                        <AlertTriangle className="size-3 mr-1" />{group.overdueCount} vencidos
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    {group.pendingAmount > 0 && (
                      <span className="text-sm font-medium text-warning">
                        Pendiente: {formatCurrency(group.pendingAmount)}
                      </span>
                    )}
                    <span className="text-sm font-bold text-primary">{formatCurrency(group.total)}</span>
                  </div>
                </button>

                {/* Group Content */}
                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4">
                    {isMobile ? (
                      <div className="space-y-2 mt-2">
                        {group.payments.map((payment) => (
                          <div key={payment.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="space-y-0.5 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{payment.description}</p>
                                {payment.reference_number && <p className="text-xs text-muted-foreground">Ref: {payment.reference_number}</p>}
                              </div>
                              <Badge className={`${getStatusColor(payment.status)} shrink-0 ml-2`}>{getStatusLabel(payment.status)}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-bold text-primary">{formatCurrency(payment.amount)}</span>
                              <span className="text-xs text-muted-foreground">Vence: {formatForDisplay(parseFromDatabase(payment.due_date))}</span>
                            </div>
                            {payment.paid_date && <div className="text-xs text-success">Pagado: {formatForDisplay(parseFromDatabase(payment.paid_date))}</div>}
                            <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/50">
                              {(payment.status === 'pending' || payment.status === 'overdue') && (
                                <Button variant="ghost" size="sm" onClick={() => handleMarkAsPaid(payment)} className="text-primary h-7"><CheckCircle className="size-3.5" /></Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)} className="text-primary h-7"><Edit2 className="size-3.5" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive h-7"><Trash2 className="size-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="border-border/70 bg-card">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-foreground">¿Eliminar pago?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">Se eliminará permanentemente "{payment.description}".</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Eliminar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-border/50">
                              <TableHead className="text-muted-foreground text-xs">Descripción</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Ref.</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Monto</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Vencimiento</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Fecha Pago</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Estado</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.payments.map((payment) => (
                              <TableRow key={payment.id} className="border-b border-border/30">
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="text-foreground text-sm">{payment.description}</div>
                                    {payment.category && (
                                      <Badge variant="outline" className="text-xs">
                                        {resolveSupplierPaymentCategoryLabel(payment.category, costCategories, 'Sin categoría')}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{payment.reference_number || '-'}</TableCell>
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-primary">{formatCurrency(payment.amount)}</div>
                                    {payment.status !== 'paid' && payment.paid_amount && payment.paid_amount > 0 && payment.paid_amount !== payment.amount && (
                                      <div className="text-xs text-success">Abonado: {formatCurrency(payment.paid_amount)}</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-foreground">{formatForDisplay(parseFromDatabase(payment.due_date))}</TableCell>
                                <TableCell>
                                  {payment.paid_date
                                    ? <span className="text-sm text-success">{formatForDisplay(parseFromDatabase(payment.paid_date))}</span>
                                    : <span className="text-muted-foreground">-</span>}
                                </TableCell>
                                <TableCell><Badge className={`${getStatusColor(payment.status)}`}>{getStatusLabel(payment.status)}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {(payment.status === 'pending' || payment.status === 'overdue') && (
                                      <Button variant="ghost" size="sm" onClick={() => handleMarkAsPaid(payment)} className="text-primary hover:text-primary/80 size-7 p-0" title="Marcar como pagado">
                                        <CheckCircle className="size-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)} className="text-primary hover:text-primary/80 size-7 p-0">
                                      <Edit2 className="size-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80 size-7 p-0"><Trash2 className="size-4" /></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="border-border/70 bg-card">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="text-foreground">¿Eliminar pago?</AlertDialogTitle>
                                          <AlertDialogDescription className="text-muted-foreground">Se eliminará permanentemente "{payment.description}".</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="border-border/70 bg-background/60 text-foreground">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Eliminar</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showForm && <PaymentForm payment={editingPayment || undefined} onClose={handleCloseForm} />}
      <MarkSupplierPaymentPaidModal payment={markAsPaidPayment} isOpen={!!markAsPaidPayment}
        onClose={() => setMarkAsPaidPayment(null)} onConfirm={handleConfirmMarkAsPaid} />
    </div>
  );
};
