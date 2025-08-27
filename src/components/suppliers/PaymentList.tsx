import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Calendar,
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
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
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
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const supplier = suppliers.find(s => s.id === payment.supplier_id);
      const supplierName = supplier?.name || '';
      
      const matchesSearch = payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (payment.reference_number && payment.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
      const matchesSupplier = selectedSupplier === 'all' || payment.supplier_id === selectedSupplier;

      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [payments, suppliers, searchTerm, selectedStatus, selectedSupplier]);

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
    markPaymentAsPaid({ 
      id: payment.id, 
      paid_amount: payment.amount 
    });
  };

  const getSupplierName = (supplierId: string) => {
    if (supplierId === 'all') return undefined;
    return suppliers.find(s => s.id === supplierId)?.name || 'Proveedor no encontrado';
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
              reportType: 'current'
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