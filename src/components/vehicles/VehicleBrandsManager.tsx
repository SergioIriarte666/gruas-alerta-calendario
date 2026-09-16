import { businessClock } from '@/utils/businessClock';
import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useVehicleBrands } from '@/hooks/useVehicleBrands';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VehicleFilters } from './VehicleFilters';
import { SectionCard } from '@/components/ui/section-card';

type SortField = 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface VehicleBrandsManagerProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const VehicleBrandsManager: React.FC<VehicleBrandsManagerProps> = ({ searchTerm, setSearchTerm }) => {
  const { brands, loading, createBrand, updateBrand, deleteBrand, isCreating, isUpdating, isDeleting } = useVehicleBrands();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    
    createBrand({ name: formData.name.trim() });
    setFormData({ name: '' });
    setIsCreateDialogOpen(false);
  };

  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!formData.name.trim() || !editingBrand) return;
    
    updateBrand({ id: editingBrand.id, name: formData.name.trim() });
    setFormData({ name: '' });
    setEditingBrand(null);
    setIsEditDialogOpen(false);
  };

  const handleDelete = (brandId: string) => {
    deleteBrand(brandId);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 size-4 opacity-50" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 size-4" /> : 
      <ArrowDown className="ml-2 size-4" />;
  };

  const sortedBrands = useMemo(() => {
    let filtered = brands;
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = brands.filter(brand => 
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    if (!sortField) return filtered;
    
    return [...filtered].sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [brands, sortField, sortDirection, searchTerm]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <VehicleFilters 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        placeholder="Buscar por nombre de marca..."
      />
      
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Marcas de Vehículos</h2>
            <Badge variant="secondary" className="rounded-full">
              {sortedBrands.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Mantiene ordenado el catálogo base de marcas disponibles para el sistema.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="dashboard-report-button">
              <Plus className="size-4 mr-2" />
              Nueva Marca
            </Button>
          </DialogTrigger>
          <DialogContent className="resources-dialog">
            <DialogHeader>
              <DialogTitle>Crear Nueva Marca</DialogTitle>
              <DialogDescription>
                Agrega una nueva marca de vehículo al sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la Marca</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="Ej: Toyota, Ford, Chevrolet..."
                />
              </div>
              <div className="flex justify-end gap-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.name.trim() || isCreating}
                >
                  {isCreating ? 'Creando...' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SectionCard flush className="resources-panel border-border/70 bg-card/80 shadow-sm">
        <div className="overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors" 
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Nombre
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors" 
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center">
                  Fecha de Creación
                  <SortIcon field="created_at" />
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBrands.map((brand) => (
              <TableRow key={brand.id} className="hover:bg-accent/40">
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell>
                  {businessClock.dateLabel(brand.created_at, 'es-CL')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(brand)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar marca?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará la marca "{brand.name}" del sistema.
                            Los modelos asociados también se verán afectados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(brand.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedBrands.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  {searchTerm.trim() ? 'No se encontraron resultados para tu búsqueda' : 'No hay marcas registradas'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </SectionCard>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="resources-dialog">
          <DialogHeader>
            <DialogTitle>Editar Marca</DialogTitle>
            <DialogDescription>
              Modifica los datos de la marca de vehículo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nombre de la Marca</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="Ej: Toyota, Ford, Chevrolet..."
              />
            </div>
            <div className="flex justify-end gap-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!formData.name.trim() || isUpdating}
              >
                {isUpdating ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
