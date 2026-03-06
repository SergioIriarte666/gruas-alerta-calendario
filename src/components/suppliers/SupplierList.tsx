import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  Check,
  Star
} from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCategories } from '@/hooks/useCostCategories';
import { SupplierForm } from './SupplierForm';
import { SupplierDetailModal } from './SupplierDetailModal';
import { BatchEditSuppliersModal } from './BatchEditSuppliersModal';
import { SupplierWithStats } from '@/types/suppliers';
import { formatCurrency, cn } from '@/lib/utils';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { toast } from 'sonner';

type SupplierSortField = 'name' | 'rut' | 'contactName' | 'category' | 'email' | 'phone' | 'isActive' | 'rating';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: SupplierSortField; 
  currentSortField?: SupplierSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

// Helper to extract rating
const getRating = (notes?: string) => {
  if (!notes) return 0;
  const match = notes.match(/^Calificación: (?:⭐)+ \((\d)\/5\)/);
  return match ? parseInt(match[1]) : 0;
};

export const SupplierList: React.FC = () => {
  const isMobile = useIsMobile();
  const { 
    suppliers, 
    isLoading, 
    deleteSupplier, 
    toggleSupplierStatus, 
    isDeleting 
  } = useSuppliers();

  const { data: costCategoriesData = [], isLoading: categoriesLoading } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithStats | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithStats | null>(null);
  const [sortField, setSortField] = useState<SupplierSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAndSortedSuppliers.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectId = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const selectedSuppliers = useMemo(() => 
    suppliers.filter(s => selectedIds.includes(s.id)),
    [suppliers, selectedIds]
  );

  const confirmDelete = (id: string) => {
    setSupplierToDelete(id);
    setIsBatchDelete(false);
    setDeleteDialogOpen(true);
  };

  const confirmBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBatchDelete(true);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (isBatchDelete) {
        // Implement batch delete logic here - iterating for now as deleteSupplier might be single
        // Ideally useSuppliers should expose a deleteSuppliers (plural) or we loop
        await Promise.all(selectedIds.map(id => deleteSupplier(id)));
        toast.success(`${selectedIds.length} proveedores eliminados`);
        setSelectedIds([]);
      } else if (supplierToDelete) {
        await deleteSupplier(supplierToDelete);
        toast.success('Proveedor eliminado correctamente');
      }
    } catch (error) {
      console.error('Error deleting supplier(s):', error);
      toast.error('Error al eliminar proveedor(s)');
    } finally {
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      setIsBatchDelete(false);
    }
  };

  const handleSort = (field: SupplierSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedSuppliers = useMemo(() => {
    const filtered = suppliers.filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          supplier.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || supplier.category === selectedCategory;
      
      const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && supplier.is_active) ||
                          (statusFilter === 'inactive' && !supplier.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rut':
          comparison = a.rut.localeCompare(b.rut);
          break;
        case 'contactName':
          const contactA = a.contact_name || '';
          const contactB = b.contact_name || '';
          comparison = contactA.localeCompare(contactB);
          break;
        case 'category':
          const catA = getCategoryLabel(activeCategories || [], a.category);
          const catB = getCategoryLabel(activeCategories || [], b.category);
          comparison = catA.localeCompare(catB);
          break;
        case 'email':
          const emailA = a.email || '';
          const emailB = b.email || '';
          comparison = emailA.localeCompare(emailB);
          break;
        case 'phone':
          const phoneA = a.phone || '';
          const phoneB = b.phone || '';
          comparison = phoneA.localeCompare(phoneB);
          break;
        case 'isActive':
          comparison = (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
          break;
        case 'rating':
          const ratingA = getRating(a.notes || '');
          const ratingB = getRating(b.notes || '');
          comparison = ratingA - ratingB;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [suppliers, searchTerm, selectedCategory, statusFilter, sortField, sortDirection, activeCategories]);

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

        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(true)}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>
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
            Proveedores ({filteredAndSortedSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedSuppliers.length === 0 ? (
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
          ) : isMobile ? (
              <div className="space-y-3">
                {filteredAndSortedSuppliers.map((supplier) => (
                  <Card key={supplier.id} className="bg-card border cursor-pointer" onClick={() => setSelectedSupplier(supplier)}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{supplier.rut}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(supplier); }}
                          className="p-0 h-auto shrink-0"
                        >
                          {supplier.is_active ? (
                            <div className="flex items-center text-green-800">
                              <ToggleRight className="h-4 w-4 mr-1" />
                              <span className="text-xs">Activo</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-muted-foreground">
                              <ToggleLeft className="h-4 w-4 mr-1" />
                              <span className="text-xs">Inactivo</span>
                            </div>
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(activeCategories || [], supplier.category)}
                        </Badge>
                        {supplier.contact_name && (
                          <span className="text-xs text-muted-foreground">{supplier.contact_name}</span>
                        )}
                      </div>

                      {(supplier.email || supplier.phone) && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {supplier.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</div>}
                          {supplier.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</div>}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(supplier)} className="text-primary"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)} className="text-blue-400"><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); confirmDelete(supplier.id); }} className="text-red-400"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.length > 0 && selectedIds.length === filteredAndSortedSuppliers.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center">Proveedor<SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('contactName')}>
                      <div className="flex items-center">Contacto<SortIcon field="contactName" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('category')}>
                      <div className="flex items-center">Categoría<SortIcon field="category" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('rating')}>
                      <div className="flex items-center">Calif.<SortIcon field="rating" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Pagos</TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('isActive')}>
                      <div className="flex items-center">Estado<SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} /></div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredAndSortedSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedSupplier(supplier)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(supplier.id)}
                          onCheckedChange={(checked) => handleSelectId(supplier.id, !!checked)}
                          aria-label={`Seleccionar ${supplier.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{supplier.name}</div>
                          <div className="text-sm text-muted-foreground">{supplier.rut}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.email && <div className="flex items-center text-sm text-foreground"><Mail className="h-3 w-3 mr-1" />{supplier.email}</div>}
                          {supplier.phone && <div className="flex items-center text-sm text-foreground"><Phone className="h-3 w-3 mr-1" />{supplier.phone}</div>}
                          {supplier.contact_name && <div className="text-sm text-foreground font-medium">{supplier.contact_name}</div>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{getCategoryLabel(activeCategories || [], supplier.category)}</Badge></TableCell>
                      <TableCell>
                        {(() => {
                          const rating = getRating(supplier.notes || '');
                          if (rating === 0) return <span className="text-xs text-muted-foreground">-</span>;
                          return (
                            <div className="flex items-center" title={`${rating}/5`}>
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="ml-1 text-xs">{rating}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell><div className="text-sm text-foreground">0 pagos</div></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(supplier)} className="p-0 h-auto">
                          {supplier.is_active ? (
                            <div className="flex items-center text-green-800"><ToggleRight className="h-4 w-4 mr-1" />Activo</div>
                          ) : (
                            <div className="flex items-center text-muted-foreground"><ToggleLeft className="h-4 w-4 mr-1" />Inactivo</div>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(supplier)} className="text-primary hover:text-primary/80" title="Ver detalles"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)} className="text-blue-400 hover:text-blue-300"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); confirmDelete(supplier.id); }} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
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

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-foreground text-background px-4 py-3 rounded-full shadow-xl flex items-center gap-4 border border-border/10">
            <div className="flex items-center gap-2 px-2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                {selectedIds.length}
              </span>
              <span className="font-medium text-sm whitespace-nowrap">seleccionados</span>
            </div>
            
            <div className="h-4 w-px bg-background/20" />
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 gap-2"
              onClick={() => setIsBatchEditOpen(true)}
            >
              <Edit2 className="h-4 w-4" />
              Editar Lote
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-2"
              onClick={confirmBatchDelete}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-background hover:bg-background/20 hover:text-background rounded-full ml-1"
              onClick={() => setSelectedIds([])}
              title="Cancelar selección"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Modals */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchDelete
                ? `Estás a punto de eliminar ${selectedIds.length} proveedores. Esta acción no se puede deshacer.`
                : 'Estás a punto de eliminar este proveedor. Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm && (
        <SupplierForm 
          onClose={handleCloseForm} 
          supplier={editingSupplier || undefined}
        />
      )}
      
      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          isOpen={!!selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onEdit={() => {
            setSelectedSupplier(null);
            handleEdit(selectedSupplier);
          }}
        />
      )}

      <BatchEditSuppliersModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedSuppliers={selectedSuppliers}
        activeCategories={activeCategories}
      />
    </div>
  );
};