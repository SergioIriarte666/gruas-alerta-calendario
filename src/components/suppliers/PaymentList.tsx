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
  Building2, 
  Mail, 
  Phone, 
  MapPin,
  ToggleLeft,
  ToggleRight,
  Loader2
} from 'lucide-react';
import { useSuppliers, getCategoryLabel } from '@/hooks/useSuppliers';
import { SupplierForm } from './SupplierForm';
import { Supplier, SupplierCategory } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';

export const SupplierList: React.FC = () => {
  const { 
    suppliers, 
    isLoading, 
    deleteSupplier, 
    toggleSupplierStatus, 
    isDeleting 
  } = useSuppliers();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const categories: SupplierCategory[] = [
    'combustible',
    'mantenimiento',
    'seguros', 
    'peajes',
    'salarios',
    'administrativos',
    'impuestos',
    'comision_operador',
    'otros'
  ];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          supplier.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || supplier.category === selectedCategory;
      
      const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && supplier.is_active) ||
                          (statusFilter === 'inactive' && !supplier.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [suppliers, searchTerm, selectedCategory, statusFilter]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleDelete = (id: string) => {
    deleteSupplier(id);
  };

  const handleToggleStatus = (supplier: Supplier) => {
    toggleSupplierStatus({ id: supplier.id, is_active: !supplier.is_active });
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
      {/* Header and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Proveedores</h2>
          <p className="text-gray-400">Gestiona los proveedores del sistema</p>
        </div>

        <Button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
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
                  placeholder="Buscar por nombre, RUT o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Categoría</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all" className="text-white hover:bg-gray-600">
                    Todas las categorías
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem 
                      key={category} 
                      value={category}
                      className="text-white hover:bg-gray-600"
                    >
                      {getCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all" className="text-white hover:bg-gray-600">
                    Todos
                  </SelectItem>
                  <SelectItem value="active" className="text-white hover:bg-gray-600">
                    Activos
                  </SelectItem>
                  <SelectItem value="inactive" className="text-white hover:bg-gray-600">
                    Inactivos
                  </SelectItem>
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
            Proveedores ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No se encontraron proveedores
              </h3>
              <p className="text-gray-400">
                {searchTerm || selectedCategory !== 'all' || statusFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza agregando tu primer proveedor'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Proveedor</TableHead>
                    <TableHead className="text-gray-300">Contacto</TableHead>
                    <TableHead className="text-gray-300">Categoría</TableHead>
                    <TableHead className="text-gray-300">Pagos</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-gray-700">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">{supplier.name}</div>
                          <div className="text-sm text-gray-400">{supplier.rut}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.email && (
                            <div className="flex items-center text-sm text-gray-300">
                              <Mail className="h-3 w-3 mr-1" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center text-sm text-gray-300">
                              <Phone className="h-3 w-3 mr-1" />
                              {supplier.phone}
                            </div>
                          )}
                          {supplier.contact_name && (
                            <div className="text-sm text-gray-400">
                              {supplier.contact_name}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                          {getCategoryLabel(supplier.category)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-white">
                            {supplier.total_payments || 0} pagos
                          </div>
                          {(supplier.pending_amount || 0) > 0 && (
                            <div className="text-sm text-yellow-400">
                              Pendiente: {formatCurrency(supplier.pending_amount || 0)}
                            </div>
                          )}
                          {(supplier.overdue_count || 0) > 0 && (
                            <div className="text-sm text-red-400">
                              {supplier.overdue_count} vencidos
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(supplier)}
                          className="p-0 h-auto"
                        >
                          {supplier.is_active ? (
                            <div className="flex items-center text-green-400">
                              <ToggleRight className="h-4 w-4 mr-1" />
                              Activo
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-400">
                              <ToggleLeft className="h-4 w-4 mr-1" />
                              Inactivo
                            </div>
                          )}
                        </Button>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
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
                                  ¿Eliminar proveedor?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-300">
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  el proveedor "{supplier.name}" del sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-gray-600 text-gray-300">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(supplier.id)}
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
        <SupplierForm
          supplier={editingSupplier || undefined}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};