import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, 
  MapPin, 
  Calendar, 
  User, 
  Truck, 
  FileText, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertTriangle,
  X,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCancelInventoryMovement, type InventoryMovement } from '@/hooks/useInventory';
import { MovementEditModal } from './MovementEditModal';

interface MovementDetailsModalProps {
  movement: InventoryMovement;
  onClose: () => void;
  onRefresh?: () => void;
}

export const MovementDetailsModal: React.FC<MovementDetailsModalProps> = ({ 
  movement, 
  onClose,
  onRefresh 
}) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const cancelMovement = useCancelInventoryMovement();

  const handleCancelMovement = async () => {
    try {
      await cancelMovement.mutateAsync(movement.id);
      setShowCancelDialog(false);
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error cancelling movement:', error);
    }
  };

  const handleEditSuccess = () => {
    onRefresh?.();
  };
  const getMovementBadge = (type: string) => {
    const badges = {
      entry: { variant: 'default' as const, label: 'Entrada', icon: TrendingUp, color: 'text-green-600' },
      exit: { variant: 'destructive' as const, label: 'Salida', icon: TrendingDown, color: 'text-red-600' },
      transfer: { variant: 'secondary' as const, label: 'Transferencia', icon: ArrowUpDown, color: 'text-blue-600' },
      adjustment: { variant: 'outline' as const, label: 'Ajuste', icon: AlertTriangle, color: 'text-yellow-600' },
    };
    
    const config = badges[type as keyof typeof badges] || badges.adjustment;
    const Icon = config.icon;
    
    return {
      badge: (
        <Badge variant={config.variant} className="flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      ),
      color: config.color
    };
  };

  const { badge, color } = getMovementBadge(movement.movement_type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Detalles del Movimiento</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(movement.movement_date), 'dd \'de\' MMMM \'de\' yyyy \'a las\' HH:mm', { locale: es })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Movement Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Información del Movimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tipo:</span>
              {badge}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cantidad:</span>
              <div className="flex items-center gap-1">
                <span className={cn("font-medium text-lg", color)}>
                  {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity}
                </span>
                <span className="text-sm text-muted-foreground">
                  {movement.item?.unit_of_measure || 'unidades'}
                </span>
              </div>
            </div>

            {movement.unit_cost && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Costo Unitario:</span>
                <span className="font-medium">${movement.unit_cost.toLocaleString()}</span>
              </div>
            )}

            {movement.total_cost && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Costo Total:</span>
                <span className="font-semibold text-lg">${movement.total_cost.toLocaleString()}</span>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fecha del Movimiento:</span>
              </div>
              <p className="text-sm ml-6">
                {format(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ubicación:</span>
              </div>
              <p className="text-sm ml-6">
                {movement.location?.name}
                {movement.location?.code && (
                  <span className="text-muted-foreground"> ({movement.location.code})</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-lg">{movement.item?.name}</h4>
              {movement.item?.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {movement.item.description}
                </p>
              )}
            </div>

            {movement.item?.category && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Categoría:</span>
                <Badge variant="outline">{movement.item.category.name}</Badge>
              </div>
            )}

            {movement.item?.sku && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SKU:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {movement.item.sku}
                </code>
              </div>
            )}

            {movement.batch_number && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Lote/Serie:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {movement.batch_number}
                </code>
              </div>
            )}

            {movement.expiration_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vencimiento:</span>
                <span className="text-sm">
                  {format(new Date(movement.expiration_date), 'dd/MM/yyyy')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Information */}
      {(movement.supplier || movement.crane || movement.reference_document || movement.reason || movement.observations) && (
        <Card>
          <CardHeader>
            <CardTitle>Información Adicional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {movement.supplier && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Proveedor:</span>
                </div>
                <p className="text-sm ml-6">{movement.supplier.name}</p>
              </div>
            )}

            {movement.crane && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Grúa:</span>
                </div>
                <p className="text-sm ml-6">{movement.crane.license_plate}</p>
              </div>
            )}

            {movement.reference_document && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Documento de Referencia:</span>
                </div>
                <code className="text-sm bg-muted px-2 py-1 rounded ml-6">
                  {movement.reference_document}
                </code>
              </div>
            )}

            {movement.reason && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Motivo:</span>
                </div>
                <p className="text-sm ml-6">{movement.reason}</p>
              </div>
            )}

            {movement.observations && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Observaciones:</span>
                </div>
                <p className="text-sm ml-6 whitespace-pre-wrap">{movement.observations}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        {movement.status === 'active' && (
          <>
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setShowCancelDialog(true)}
            >
              Anular Movimiento
            </Button>
          </>
        )}
      </div>

      {/* Edit Movement Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Movimiento</DialogTitle>
          </DialogHeader>
          <MovementEditModal 
            movement={movement}
            onClose={() => setShowEditModal(false)}
            onSuccess={handleEditSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Cancel Movement Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará el movimiento de inventario. Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelMovement}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMovement.isPending}
            >
              {cancelMovement.isPending ? 'Anulando...' : 'Anular Movimiento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};