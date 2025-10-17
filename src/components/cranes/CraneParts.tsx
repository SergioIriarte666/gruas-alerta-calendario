
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  User, 
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Receipt,
  Tags,
  ArrowDown,
  Package2
} from 'lucide-react';
import { useCraneParts, useCranePartsStats, useDeleteCranePart, type EnhancedCranePart } from '@/hooks/useCraneParts';
import { PartsForm } from './forms/PartsForm';
import { PartsTraceabilityDashboard } from './PartsTraceabilityDashboard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crane } from '@/types';
import { toast } from 'sonner';
import { formatForDisplayLong } from '@/utils/timezoneUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CranePartsDataMigration } from './CranePartsDataMigration';

interface CranePartsProps {
  crane: Crane;
}

export const CraneParts = ({ crane }: CranePartsProps) => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<EnhancedCranePart | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partToDelete, setPartToDelete] = useState<EnhancedCranePart | null>(null);

  const { data: parts = [], isLoading } = useCraneParts(crane.id);
  const { data: stats } = useCranePartsStats(crane.id);
  const deleteMutation = useDeleteCranePart();

  const handleEdit = (part: EnhancedCranePart) => {
    // Solo permitir edición de piezas creadas directamente
    if (part.origin !== 'direct') {
      const originText = part.origin === 'cost' ? 'costos de mantenimiento' : 'consumos de inventario';
      toast.error(`Las piezas creadas desde ${originText} no se pueden editar aquí.`);
      return;
    }
    setEditingPart(part);
    setIsFormOpen(true);
  };

  const handleDelete = (part: EnhancedCranePart) => {
    // Solo permitir eliminación de piezas creadas directamente
    if (part.origin !== 'direct') {
      const originText = part.origin === 'cost' ? 'costos de mantenimiento' : 'consumos de inventario';
      toast.error(`Las piezas creadas desde ${originText} no se pueden eliminar aquí.`);
      return;
    }
    setPartToDelete(part);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (partToDelete && partToDelete.origin === 'direct') {
      await deleteMutation.mutateAsync(partToDelete.id);
      setDeleteDialogOpen(false);
      setPartToDelete(null);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPart(null);
  };

  const handleViewInCosts = (costId: string) => {
    navigate(`/costs?costId=${costId}`);
  };

  const handleViewInInventory = () => {
    navigate('/inventory');
  };

  const getOriginBadge = (part: EnhancedCranePart) => {
    switch (part.origin) {
      case 'direct':
        return (
          <Badge 
            variant="secondary"
            className="bg-green-500/20 text-black border-green-500/30"
          >
            <Package className="w-3 h-3 mr-1" />
            Directo
          </Badge>
        );
      case 'cost':
        return (
          <Badge 
            variant="default"
            className="bg-blue-500/20 text-blue-300 border-blue-500/30"
          >
            <Receipt className="w-3 h-3 mr-1" />
            Desde Costo
          </Badge>
        );
      case 'consumption':
        return (
          <Badge 
            variant="secondary"
            className="bg-orange-500/20 text-orange-300 border-orange-500/30"
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            Consumo
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">Cargando piezas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Registros</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalParts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Comprado</p>
                  <p className="text-2xl font-bold text-green-400">+${stats.totalValue.toLocaleString('es-CL')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Consumido</p>
                  <p className="text-2xl font-bold text-red-400">-${stats.totalConsumed?.toLocaleString('es-CL') || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Balance Neto</p>
                  <p className="text-2xl font-bold text-blue-400">${stats.netValue?.toLocaleString('es-CL') || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Últimos 30 días</p>
                  <p className="text-2xl font-bold text-foreground">{stats.recentParts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Migration Tools */}
      <CranePartsDataMigration crane={crane} />

      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Historial de Piezas, Repuestos y Consumos</h3>
          <p className="text-gray-400">Gestión completa de piezas para la grúa {crane.licensePlate}</p>
        </div>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Pieza
        </Button>
      </div>

      {/* Parts List */}
      {parts.length === 0 ? (
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay registros</h3>
            <p className="text-gray-400 text-center mb-6">
              Comienza agregando las primeras piezas y repuestos para esta grúa.
            </p>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primera Pieza
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {parts.map((part) => (
            <Card key={part.id} className="bg-white/5 border-tms-green/30 hover:bg-white/10 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Origin Badge and Part Name */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-semibold text-white">{part.part_name}</h4>
                          {getOriginBadge(part)}
                        </div>
                        
                        {/* Additional info based on origin */}
                        {part.origin === 'cost' && part.cost_description && (
                          <p className="text-sm text-blue-300 mb-2">
                            Descripción del costo: {part.cost_description}
                          </p>
                        )}
                        
                        {part.origin === 'consumption' && part.consumption_details && (
                          <div className="text-sm text-orange-300 mb-2 space-y-1">
                            <p>Producto de inventario: {part.consumption_details.inventory_item_name}</p>
                            {part.consumption_details.operator_name && (
                              <p>Operador: {part.consumption_details.operator_name}</p>
                            )}
                            {part.consumption_details.reference_document && (
                              <p>Referencia: {part.consumption_details.reference_document}</p>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-medium ${
                            part.origin === 'consumption' ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {part.origin === 'consumption' ? '-' : '+'}{part.quantity} {part.origin === 'consumption' ? '(consumido)' : '(instalado)'}
                          </span>
                          {part.unit_price > 0 && (
                            <span className="text-sm text-gray-400">
                              Unitario: ${part.unit_price.toLocaleString('es-CL')}
                            </span>
                          )}
                          <Badge 
                            variant="secondary" 
                            className={`${
                              part.origin === 'consumption' 
                                ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                                : 'bg-green-500/20 text-green-300 border-green-500/30'
                            }`}
                          >
                            {part.origin === 'consumption' ? '-' : '+'}${part.total_value.toLocaleString('es-CL')}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Supplier and Date */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{part.supplier}</span>
                      </div>
                      {part.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{part.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatForDisplayLong(part.date)}</span>
                      </div>
                      {part.kilometraje && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>{part.kilometraje.toLocaleString('es-CL')} km</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {part.notes && (
                      <p className="text-sm text-gray-400 bg-white/5 p-3 rounded-md">
                        {part.notes}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {part.origin === 'direct' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(part)}
                          className="border-tms-green/50 text-tms-green hover:bg-tms-green/10"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(part)}
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {part.origin === 'cost' && part.cost_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewInCosts(part.cost_id!)}
                        className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                      >
                        <Receipt className="w-3 h-3 mr-1" />
                        Ver en Costos
                      </Button>
                    )}
                    {part.origin === 'consumption' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewInInventory}
                        className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
                      >
                        <Package2 className="w-3 h-3 mr-1" />
                        Ver en Inventario
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Traceability Dashboard */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-tms-green" />
            Trazabilidad e Integración con Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PartsTraceabilityDashboard craneId={crane.id} />
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <PartsForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        craneId={crane.id}
        editingPart={editingPart}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-black border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar pieza?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Esta acción eliminará permanentemente la pieza "{partToDelete?.part_name}" y su costo asociado.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
