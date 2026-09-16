import { businessClock } from '@/utils/businessClock';
import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, LayoutList, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useVehicleModels } from '@/hooks/useVehicleModels';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VehicleFilters } from './VehicleFilters';
import { VehicleModelsPipelineView } from './VehicleModelsPipelineView';
import { SectionCard } from '@/components/ui/section-card';

type SortField = 'name' | 'created_at' | 'brand';
type SortDirection = 'asc' | 'desc';

interface VehicleModelsManagerProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const VehicleModelsManager: React.FC<VehicleModelsManagerProps> = ({ searchTerm, setSearchTerm }) => {
  const { brands } = useVehicleBrands();
  const { models, loading, createModel, updateModel, deleteModel, isCreating, isUpdating, isDeleting } = useVehicleModels();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', brand_id: '' });
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.brand_id) return;
    
    createModel({ 
      name: formData.name.trim(),
      brand_id: formData.brand_id
    });
    setFormData({ name: '', brand_id: '' });
    setIsCreateDialogOpen(false);
  };

  const handleEdit = (model: any) => {
    setEditingModel(model);
    setFormData({ 
      name: model.name,
      brand_id: model.brand_id
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!formData.name.trim() || !formData.brand_id || !editingModel) return;
    
    updateModel({ 
      id: editingModel.id, 
      name: formData.name.trim(),
      brand_id: formData.brand_id
    });
    setFormData({ name: '', brand_id: '' });
    setEditingModel(null);
    setIsEditDialogOpen(false);
  };

  const handleDelete = (modelId: string) => {
    deleteModel(modelId);
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

  const sortedModels = useMemo(() => {
    let filtered = models;
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = models.filter(model => 
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.vehicle_brands?.name.toLowerCase().includes(searchTerm.toLowerCase())
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
        case 'brand':
          aValue = a.vehicle_brands?.name?.toLowerCase() || '';
          bValue = b.vehicle_brands?.name?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [models, sortField, sortDirection, searchTerm]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <VehicleFilters 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        placeholder="Buscar por marca o modelo..."
      />
      
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Modelos de Vehículos</h2>
            <Badge variant="secondary" className="rounded-full">
              {sortedModels.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Alterna entre una vista agrupada por marca o una tabla compacta para administración rápida.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as 'table' | 'grouped')}
            className="rounded-xl border border-border/70 bg-background/70 p-1"
          >
            <ToggleGroupItem value="grouped" aria-label="Vista agrupada" className="rounded-lg text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <LayoutGrid className="size-4 mr-2" />
              Agrupada
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Vista lista" className="rounded-lg text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <LayoutList className="size-4 mr-2" />
              Lista
            </ToggleGroupItem>
          </ToggleGroup>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="dashboard-report-button">
                <Plus className="size-4 mr-2" />
                Nuevo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="resources-dialog">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Modelo</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo modelo de vehículo al sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  <Select value={formData.brand_id} onValueChange={(value) => setFormData({ ...formData, brand_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Nombre del Modelo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Corolla, F-150, Silverado..."
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
                    disabled={!formData.name.trim() || !formData.brand_id || isCreating}
                  >
                    {isCreating ? 'Creando...' : 'Crear'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === 'grouped' ? (
        <VehicleModelsPipelineView
          models={sortedModels}
          searchTerm={searchTerm}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <SectionCard flush className="resources-panel border-border/70 bg-card/80 shadow-sm">
          <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors" 
                onClick={() => handleSort('brand')}
              >
                <div className="flex items-center">
                  Marca
                  <SortIcon field="brand" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors" 
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Modelo
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
              {sortedModels.map((model) => (
                <TableRow key={model.id} className="hover:bg-accent/40">
                <TableCell>{model.vehicle_brands?.name}</TableCell>
                <TableCell className="font-medium">{model.name}</TableCell>
                <TableCell>
                  {businessClock.dateLabel(model.created_at, 'es-CL')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(model)}
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
                          <AlertDialogTitle>¿Eliminar modelo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará el modelo "{model.name}" de la marca "{model.vehicle_brands?.name}" del sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(model.id)}
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
              {sortedModels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {searchTerm.trim() ? 'No se encontraron resultados para tu búsqueda' : 'No hay modelos registrados'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </SectionCard>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="resources-dialog">
          <DialogHeader>
            <DialogTitle>Editar Modelo</DialogTitle>
            <DialogDescription>
              Modifica los datos del modelo de vehículo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-brand">Marca</Label>
              <Select value={formData.brand_id} onValueChange={(value) => setFormData({ ...formData, brand_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una marca" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-name">Nombre del Modelo</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Corolla, F-150, Silverado..."
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
                disabled={!formData.name.trim() || !formData.brand_id || isUpdating}
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
