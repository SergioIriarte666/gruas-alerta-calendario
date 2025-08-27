import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Loader2
} from 'lucide-react';
import { useSupplierPayments, getStatusLabel, getStatusColor } from '@/hooks/useSupplierPayments';
import { useSuppliers, getCategoryLabel } from '@/hooks/useSuppliers';
import { PaymentForm } from './PaymentForm';
import { SupplierPaymentExportButton } from './SupplierPaymentExportButton';
import { SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { formatCurrency, cn } from '@/lib/utils';
import { format, isAfter, isBefore, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export const PaymentList: React.FC = () => {
  const { 
    payments, 
    isLoading, 
    deletePayment, 
    markPaymentAsPaid,
    updateOverduePayments,
    isDeleting 
  } = useSupplierPayments();
  
  const { suppliers } = useSuppliers();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dateType, setDateType] = useState<'due_date' | 'created_at' | 'paid_date'>('due_date');
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
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
        let compareDate: Date;
        
        // Determinar qué fecha usar para comparar
        switch (dateType) {
          case 'due_date':
            compareDate = new Date(payment.due_date);
            break;
          case 'created_at':
            compareDate = new Date(payment.created_at);
            break;
          case 'paid_date':
            if (!payment.paid_date) {
              matchesDateRange = false;
              break;
            }
            compareDate = new Date(payment.paid_date);
            break;
          default:
            compareDate = new Date(payment.due_date);
        }

        // Aplicar filtros de fecha si matchesDateRange aún es true
        if (matchesDateRange) {
          if (dateFrom && isBefore(compareDate, dateFrom) && !isSameDay(compareDate, dateFrom)) {
            matchesDateRange = false;
          }
          if (dateTo && isAfter(compareDate, dateTo) && !isSameDay(compareDate, dateTo)) {
            matchesDateRange = false;
          }
        }
      }

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateRange;
    });
  }, [payments, suppliers, searchTerm, selectedStatus, selectedSupplier, dateFrom, dateTo, dateType]);

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
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      setDateFrom(localDate);
    } else {
      setDateFrom(undefined);
    }
  };

  const handleDateToSelect = (date: Date | undefined) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      setDateTo(localDate);
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
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Pagos a Proveedores</h2>
          <p className="text-gray-400">Gestiona los pagos pendientes y realizados</p>
        </div>

        <div className="flex gap-2">
          <SupplierPaymentExportButton 
            payments={filteredPayments}
            suppliers={suppliers}
            filters={{
              searchTerm,
              status: selectedStatus,
              supplierId: selectedSupplier,
              supplierName: getSupplierName(selectedSupplier),
              reportType: 'current',
              dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
              dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
              dateType
            }}
          />
          <Button
            onClick={() => updateOverduePayments()}
            variant="outline"
            className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20"
          >
            <Clock className="h-4 w-4 mr-2" />
            Actualizar Vencidos
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pago
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por descripción, proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all" className="text-white hover:bg-gray-600">
                    Todos los estados
                  </SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem 
                      key={status} 
                      value={status}
                      className="text-white hover:bg-gray-600"
                    >
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Proveedor</label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all" className="text-white hover:bg-gray-600">
                    Todos los proveedores
                  </SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem 
                      key={supplier.id} 
                      value={supplier.id}
                      className="text-white hover:bg-gray-600"
                    >
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Filtros por Fecha</h3>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDateFilters}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Tipo de Fecha</label>
                <Select value={dateType} onValueChange={(value: 'due_date' | 'created_at' | 'paid_date') => setDateType(value)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="due_date" className="text-white hover:bg-gray-600">
                      Fecha de Vencimiento
                    </SelectItem>
                    <SelectItem value="created_at" className="text-white hover:bg-gray-600">
                      Fecha de Creación
                    </SelectItem>
                    <SelectItem value="paid_date" className="text-white hover:bg-gray-600">
                      Fecha de Pago
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">Fecha Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white hover:bg-gray-600",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={handleDateFromSelect}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">Fecha Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white hover:bg-gray-600",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={handleDateToSelect}
                      disabled={(date) => dateFrom ? isBefore(date, dateFrom) : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick Date Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  setDateFrom(today);
                  setDateTo(today);
                }}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - today.getDay());
                  weekStart.setHours(12, 0, 0, 0);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);
                  setDateFrom(weekStart);
                  setDateTo(weekEnd);
                }}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Esta Semana
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
                  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12, 0, 0);
                  setDateFrom(monthStart);
                  setDateTo(monthEnd);
                }}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Este Mes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(today.getDate() - 30);
                  thirtyDaysAgo.setHours(12, 0, 0, 0);
                  today.setHours(12, 0, 0, 0);
                  setDateFrom(thirtyDaysAgo);
                  setDateTo(today);
                }}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Últimos 30 días
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Pagos ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No se encontraron pagos
              </h3>
              <p className="text-gray-400">
                {searchTerm || selectedStatus !== 'all' || selectedSupplier !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza agregando tu primer pago'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Proveedor</TableHead>
                    <TableHead className="text-gray-300">Descripción</TableHead>
                    <TableHead className="text-gray-300">Monto</TableHead>
                    <TableHead className="text-gray-300">Vencimiento</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id} className="border-gray-700">
                      <TableCell>
                         <div className="space-y-1">
                           <div className="font-medium text-white">
                             {suppliers.find(s => s.id === payment.supplier_id)?.name || 'Proveedor no encontrado'}
                           </div>
                           {payment.reference_number && (
                             <div className="text-sm text-gray-400">
                               Ref: {payment.reference_number}
                             </div>
                           )}
                         </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-white">{payment.description}</div>
                          <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                            {getCategoryLabel(payment.category)}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">
                            {formatCurrency(payment.amount)}
                          </div>
                          {payment.paid_amount && payment.paid_amount !== payment.amount && (
                            <div className="text-sm text-green-400">
                              Pagado: {formatCurrency(payment.paid_amount)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-white">
                            {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es })}
                          </div>
                          {payment.paid_date && (
                            <div className="text-sm text-green-400">
                              Pagado: {format(new Date(payment.paid_date), 'dd/MM/yyyy', { locale: es })}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {payment.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment)}
                              className="text-green-400 hover:text-green-300"
                              title="Marcar como pagado"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(payment)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-800 border-gray-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  ¿Eliminar pago?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-300">
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  el pago "{payment.description}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-gray-600 text-gray-300">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(payment.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
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