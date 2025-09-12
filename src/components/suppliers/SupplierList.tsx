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
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { SupplierForm } from './SupplierForm';
import { SupplierWithStats } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';
import { getCategoryLabel } from '@/utils/categoryUtils';

export const SupplierList: React.FC = () => {
  const { 
    suppliers, 
    isLoading, 
    deleteSupplier, 
    toggleSupplierStatus, 
    isDeleting 
  } = useSuppliers();

  const { activeCategories, isLoading: categoriesLoading } = useSupplierCategoryManager();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithStats | null>(null);

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

  const handleEdit = (supplier: SupplierWithStats) => {
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

  const handleToggleStatus = (supplier: SupplierWithStats) => {
    toggleSupplierStatus(supplier.id);
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
      {/* Header and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Proveedores</h2>
          <p className="text-muted-foreground">Gestiona los proveedores del sistema</p>
        </div>

        <Button
          onClick={() => setShowForm(true)}
          variant="default"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, RUT o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-foreground">Categoría</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todas las categorías
                  </SelectItem>
                  {categoriesLoading ? (
                    <SelectItem value="loading" disabled>
                      Cargando categorías...
                    </SelectItem>
                  ) : (
                    activeCategories?.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.name}
                      >
                        {category.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-foreground">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todos
                  </SelectItem>
                  <SelectItem value="active">
                    Activos
                  </SelectItem>
                  <SelectItem value="inactive">
                    Inactivos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Proveedores ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No se encontraron proveedores
              </h3>
              <p className="text-muted-foreground">
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
                  <TableRow className="border">
                    <TableHead className="text-muted-foreground">Proveedor</TableHead>
                    <TableHead className="text-muted-foreground">Contacto</TableHead>
                    <TableHead className="text-muted-foreground">Categoría</TableHead>
                    <TableHead className="text-muted-foreground">Pagos</TableHead>
                    <TableHead className="text-muted-foreground">Estado</TableHead>
                    <TableHead className="text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{supplier.name}</div>
                          <div className="text-sm text-muted-foreground">{supplier.rut}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.email && (
                            <div className="flex items-center text-sm text-foreground">
                              <Mail className="h-3 w-3 mr-1" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center text-sm text-foreground">
                              <Phone className="h-3 w-3 mr-1" />
                              {supplier.phone}
                            </div>
                          )}
                          {supplier.contact_name && (
                            <div className="text-sm text-muted-foreground">
                              {supplier.contact_name}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryLabel(activeCategories || [], supplier.category)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-foreground">
                            0 pagos
                          </div>
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
                            <div className="flex items-center text-green-800">
                              <ToggleRight className="h-4 w-4 mr-1" />
                              Activo
                            </div>
                          ) : (
                            <div className="flex items-center text-muted-foreground">
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