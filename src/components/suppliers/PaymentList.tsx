import React, { useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard, 
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown
} from 'lucide-react';
import { useSupplierPayments, getStatusLabel, getStatusColor } from '@/hooks/useSupplierPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { useCostCategories } from '@/hooks/useCostCategories';
import { resolveSupplierPaymentCategoryLabel } from '@/utils/suppliers/resolveSupplierPaymentCategory';
import { PaymentForm } from './PaymentForm';
import { SupplierPaymentExportButton } from './SupplierPaymentExportButton';
import { SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  getCurrentChileDate, 
  parseFromDatabase, 
  formatForInput, 
  formatForDisplay,
  getCurrentMonthRange,
  getCurrentWeekRange
} from '@/utils/timezoneUtils';

type PaymentSortField = 'supplier' | 'description' | 'referenceNumber' | 'amount' | 'dueDate' | 'createdAt' | 'paidDate' | 'status';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: PaymentSortField; 
  currentSortField?: PaymentSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

export const PaymentList: React.FC = () => {
  const isMobile = useIsMobile();
  const { 
    payments, 
    isLoading, 
    deletePayment, 
    markPaymentAsPaid,
    updateOverduePayments,
    isDeleting 
  } = useSupplierPayments();
  
  const { suppliers } = useSuppliers();
  const { categories: supplierCategories = [] } = useSupplierCategoryManager();
  const { data: costCategories = [] } = useCostCategories();

  const exportCategories = useMemo(
    () => [
      ...supplierCategories,
      ...costCategories.map((c) => ({ id: c.id, label: c.name })),
    ],
    [supplierCategories, costCategories]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dateType, setDateType] = useState<'due_date' | 'created_at' | 'paid_date'>('due_date');
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [sortField, setSortField] = useState<PaymentSortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const handleSort = (field: PaymentSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedPayments = useMemo(() => {
    const filtered = payments.filter(payment => {
      const supplier = suppliers.find(s => s.id === payment.supplier_id);
      const supplierName = supplier?.name || '';
      
      // Filtros existentes
      const matchesSearch = payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (payment.reference_number && payment.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
      const matchesSupplier = selectedSupplier === 'all' || payment.supplier_id === selectedSupplier;

      // Filtros de fecha
      let matchesDateRange = true;
      if (dateFrom || dateTo) {
        let compareDateString: string;
        
        // Determinar qué fecha usar para comparar
        switch (dateType) {
          case 'due_date':
            compareDateString = formatForInput(parseFromDatabase(payment.due_date));
            break;
          case 'created_at':
            compareDateString = formatForInput(parseFromDatabase(payment.created_at));
            break;
          case 'paid_date':
            if (!payment.paid_date) {
              matchesDateRange = false;
              break;
            }
            compareDateString = formatForInput(parseFromDatabase(payment.paid_date));
            break;
          default:
            compareDateString = formatForInput(parseFromDatabase(payment.due_date));
        }

        // Aplicar filtros de fecha si matchesDateRange aún es true
        if (matchesDateRange) {
          const dateFromString = dateFrom ? formatForInput(dateFrom) : '';
          const dateToString = dateTo ? formatForInput(dateTo) : '';
          
          if (dateFromString && compareDateString < dateFromString) {
            matchesDateRange = false;
          }
          if (dateToString && compareDateString > dateToString) {
            matchesDateRange = false;
          }
        }
      }

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateRange;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'supplier':
          const supplierA = suppliers.find(s => s.id === a.supplier_id)?.name || '';
          const supplierB = suppliers.find(s => s.id === b.supplier_id)?.name || '';
          comparison = supplierA.localeCompare(supplierB);
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'referenceNumber':
          const refA = a.reference_number || '';
          const refB = b.reference_number || '';
          comparison = refA.localeCompare(refB);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'dueDate':
          comparison = parseFromDatabase(a.due_date).getTime() - parseFromDatabase(b.due_date).getTime();
          break;
        case 'createdAt':
          comparison = parseFromDatabase(a.created_at).getTime() - parseFromDatabase(b.created_at).getTime();
          break;
        case 'paidDate':
          const paidA = a.paid_date ? parseFromDatabase(a.paid_date).getTime() : 0;
          const paidB = b.paid_date ? parseFromDatabase(b.paid_date).getTime() : 0;
          comparison = paidA - paidB;
          break;
        case 'status':
          const statusOrder = { overdue: 0, pending: 1, paid: 2, cancelled: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [payments, suppliers, searchTerm, selectedStatus, selectedSupplier, dateFrom, dateTo, dateType, sortField, sortDirection]);

  const handleEdit = (payment: SupplierPayment) => {
    setEditingPayment(payment);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPayment(null);
  };

  const handleDelete = (id: string) => {
    deletePayment(id);
  };

  const handleMarkAsPaid = (payment: SupplierPayment) => {
    // Por ahora, simplemente marcar como pagado sin detalles de piezas
    // Los detalles de piezas se pasan desde el formulario de edición
    markPaymentAsPaid({ 
      id: payment.id, 
      paid_amount: payment.amount 
    });
  };

  const getSupplierName = (supplierId: string) => {
    if (supplierId === 'all') return undefined;
    return suppliers.find(s => s.id === supplierId)?.name || 'Proveedor no encontrado';
  };

  const handleDateFromSelect = (date: Date | undefined) => {
    if (date) {
      // Normalizar la fecha seleccionada a medianoche en zona horaria Chile
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      setDateFrom(normalizedDate);
    } else {
      setDateFrom(undefined);
    }
  };

  const handleDateToSelect = (date: Date | undefined) => {
    if (date) {
      // Normalizar la fecha seleccionada a medianoche en zona horaria Chile
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      setDateTo(normalizedDate);
    } else {
      setDateTo(undefined);
    }
  };

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const getDateTypeLabel = (type: 'due_date' | 'created_at' | 'paid_date') => {
    switch (type) {
      case 'due_date': return 'Fecha de Vencimiento';
      case 'created_at': return 'Fecha de Creación';
      case 'paid_date': return 'Fecha de Pago';
      default: return 'Fecha de Vencimiento';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 suppliers-scope">
      {/* Header and Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pagos a Proveedores</h2>
          <p className="text-muted-foreground">Gestiona los pagos pendientes y realizados</p>
        </div>

        <div className="flex gap-2">
          <SupplierPaymentExportButton
            payments={filteredAndSortedPayments}
            suppliers={suppliers}
            categories={exportCategories}
            filters={{
              searchTerm,
              status: selectedStatus,
              supplierId: selectedSupplier,
              supplierName: getSupplierName(selectedSupplier),
              reportType: 'current',
              dateFrom: dateFrom ? formatForInput(dateFrom) : undefined,
              dateTo: dateTo ? formatForInput(dateTo) : undefined,
              dateType
            }}
          />
          <Button
            onClick={() => updateOverduePayments()}
            variant="outline"
          >
            <Clock className="h-4 w-4 mr-2" />
            Actualizar Vencidos
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pago
          </Button>
        </div>
      </div>

      {/* Unified Filters */}
      <Collapsible defaultOpen>
        <Card className="bg-card border">
          <CardContent className="p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full mb-3">
              <h3 className="text-sm font-medium text-foreground">Filtros</h3>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Search */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Descripción, proveedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Estado</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Supplier */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Proveedor</label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Type */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Tipo Fecha</label>
                  <Select value={dateType} onValueChange={(value: 'due_date' | 'created_at' | 'paid_date') => setDateType(value)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due_date">Vencimiento</SelectItem>
                      <SelectItem value="created_at">Creación</SelectItem>
                      <SelectItem value="paid_date">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <DatePickerInput
                    value={dateFrom ? formatForInput(dateFrom) : ''}
                    onChange={(val) => {
                      if (val) {
                        const parts = val.split('-');
                        setDateFrom(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0));
                      } else {
                        setDateFrom(undefined);
                      }
                    }}
                    placeholder="Desde"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <DatePickerInput
                    value={dateTo ? formatForInput(dateTo) : ''}
                    onChange={(val) => {
                      if (val) {
                        const parts = val.split('-');
                        setDateTo(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59));
                      } else {
                        setDateTo(undefined);
                      }
                    }}
                    placeholder="Hasta"
                  />
                </div>
              </div>

              {/* Quick Presets + Clear */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground mr-1">Rápido:</span>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const today = getCurrentChileDate();
                  setDateFrom(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0));
                  setDateTo(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));
                }}>Hoy</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const { start, end } = getCurrentWeekRange();
                  setDateFrom(start);
                  setDateTo(end);
                }}>Semana</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const { start, end } = getCurrentMonthRange();
                  setDateFrom(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
                  setDateTo(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
                }}>Mes</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => {
                  const today = getCurrentChileDate();
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(today.getDate() - 30);
                  thirtyDaysAgo.setHours(0, 0, 0, 0);
                  today.setHours(23, 59, 59, 999);
                  setDateFrom(thirtyDaysAgo);
                  setDateTo(today);
                }}>30 días</Button>
                {(dateFrom || dateTo || searchTerm || selectedStatus !== 'all' || selectedSupplier !== 'all') && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-destructive ml-auto" onClick={() => {
                    clearDateFilters();
                    setSearchTerm('');
                    setSelectedStatus('all');
                    setSelectedSupplier('all');
                  }}>
                    <X className="h-3 w-3 mr-1" />
                    Limpiar todo
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Results */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Pagos ({filteredAndSortedPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No se encontraron pagos
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedStatus !== 'all' || selectedSupplier !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza agregando tu primer pago'
                }
              </p>
            </div>
          ) : isMobile ? (
              <div className="space-y-3">
                {filteredAndSortedPayments.map((payment) => {
                  const supplierName = suppliers.find(s => s.id === payment.supplier_id)?.name || 'No encontrado';
                  return (
                    <Card key={payment.id} className="bg-card border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{supplierName}</p>
                            <p className="text-xs text-muted-foreground truncate">{payment.description}</p>
                            {payment.reference_number && (
                              <p className="text-xs text-muted-foreground">Ref: {payment.reference_number}</p>
                            )}
                          </div>
                          <Badge className={`${getStatusColor(payment.status)} text-black shrink-0 ml-2`}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-foreground">{formatCurrency(payment.amount)}</span>
                          <span className="text-xs text-muted-foreground">Vence: {formatForDisplay(parseFromDatabase(payment.due_date))}</span>
                        </div>

                        {payment.paid_date && (
                          <div className="text-xs text-violet-600">
                            Pagado: {formatForDisplay(parseFromDatabase(payment.paid_date))}
                          </div>
                        )}

                        {payment.category && (
                          <Badge variant="outline" className="text-xs">
                            {resolveSupplierPaymentCategoryLabel(payment.category, {
                              supplierCategories, costCategories, fallback: 'Sin categoría',
                            })}
                          </Badge>
                        )}

                        <div className="flex items-center justify-end gap-1 pt-1 border-t">
                          {payment.status === 'pending' && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkAsPaid(payment)} className="text-primary" title="Marcar como pagado">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)} className="text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">¿Eliminar pago?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer. Se eliminará permanentemente el pago "{payment.description}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border">
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('supplier')}>
                      <div className="flex items-center">Proveedor<SortIcon field="supplier" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('description')}>
                      <div className="flex items-center">Descripción<SortIcon field="description" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('amount')}>
                      <div className="flex items-center">Monto<SortIcon field="amount" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('dueDate')}>
                      <div className="flex items-center">Vencimiento<SortIcon field="dueDate" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('paidDate')}>
                      <div className="flex items-center">Fecha de Pago<SortIcon field="paidDate" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center">Estado<SortIcon field="status" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedPayments.map((payment) => (
                    <TableRow key={payment.id} className="border">
                      <TableCell>
                         <div className="space-y-1">
                           <div className="font-medium text-foreground">
                             {suppliers.find(s => s.id === payment.supplier_id)?.name || 'Proveedor no encontrado'}
                           </div>
                           {payment.reference_number && (
                             <div className="text-sm text-muted-foreground">Ref: {payment.reference_number}</div>
                           )}
                         </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-foreground">{payment.description}</div>
                          {payment.category && (
                            <Badge variant="outline">
                              {resolveSupplierPaymentCategoryLabel(payment.category, { supplierCategories, costCategories, fallback: 'Sin categoría' })}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{formatCurrency(payment.amount)}</div>
                          {payment.paid_amount && payment.paid_amount !== payment.amount && (
                            <div className="text-sm text-primary">Pagado: {formatCurrency(payment.paid_amount)}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><div className="text-foreground">{formatForDisplay(parseFromDatabase(payment.due_date))}</div></TableCell>
                      <TableCell>
                        {payment.paid_date ? (
                          <div className="text-violet-600">{formatForDisplay(parseFromDatabase(payment.paid_date))}</div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(payment.status)} text-black`}>{getStatusLabel(payment.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {payment.status === 'pending' && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkAsPaid(payment)} className="text-primary hover:text-primary/80" title="Marcar como pagado">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)} className="text-primary hover:text-primary/80">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">¿Eliminar pago?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer. Se eliminará permanentemente el pago "{payment.description}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border text-muted-foreground">Cancelar</AlertDialogCancel>
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
            )
          }
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showForm && (
        <PaymentForm
          payment={editingPayment || undefined}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};