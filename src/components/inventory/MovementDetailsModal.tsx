import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Truck, 
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertTriangle,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCancelInventoryMovement, type InventoryMovement } from '@/hooks/useInventory';
import { MovementEditModal } from './MovementEditModal';
import { useInventoryMovementChangeHistory } from '@/hooks/useChangeHistory';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import { Clock } from 'lucide-react';
import { createLogger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';


const logger = createLogger("MovementDetailsModal");
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
  const { data: intercompanyAdjustment } = useQuery({
    queryKey: ['inventory-movement-intercompany-adjustment', movement.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intercompany_adjustments')
        .select('amount, direction')
        .eq('reference', `inv_movement:${movement.id}`)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const handleCancelMovement = async () => {
    try {
      await cancelMovement.mutateAsync(movement.id);
      setShowCancelDialog(false);
      onRefresh?.();
      onClose();
    } catch (error) {
      logger.error('Error cancelling movement:', error);
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
          <Icon className="size-3" />
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
          <Package className="size-6 text-primary" />
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
              <Package className="size-4" />
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

            {intercompanyAdjustment && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cuenta intercompañía:</span>
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                  Intercompañía ${Number(intercompanyAdjustment.amount || 0).toLocaleString('es-CL')}
                </Badge>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fecha del Movimiento:</span>
              </div>
              <p className="text-sm ml-6">
                {format(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{movement.movement_type === 'transfer' ? 'Ubicación origen:' : 'Ubicación:'}</span>
              </div>
              <p className="text-sm ml-6">
                {movement.location?.name}
                {movement.location?.code && (
                  <span className="text-muted-foreground"> ({movement.location.code})</span>
                )}
              </p>
            </div>

            {movement.movement_type === 'transfer' && movement.destination_location && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ubicación destino:</span>
                </div>
                <p className="text-sm ml-6">
                  {movement.destination_location.name}
                  {movement.destination_location.code && (
                    <span className="text-muted-foreground"> ({movement.destination_location.code})</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" />
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
      {(movement.supplier || movement.crane || movement.reference_document || movement.supplier_invoice_id || movement.supplier_invoice_item_id || movement.reason || movement.observations) && (
        <Card>
          <CardHeader>
            <CardTitle>Información Adicional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {movement.supplier && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Proveedor:</span>
                </div>
                <p className="text-sm ml-6">{movement.supplier.name}</p>
              </div>
            )}

            {movement.crane && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Grúa:</span>
                </div>
                <p className="text-sm ml-6">{movement.crane.license_plate}</p>
              </div>
            )}

            {movement.reference_document && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Documento de Referencia:</span>
                </div>
                <code className="text-sm bg-muted px-2 py-1 rounded ml-6">
                  {movement.reference_document}
                </code>
              </div>
            )}

            {(movement.supplier_invoice_id || movement.supplier_invoice_item_id) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Trazabilidad de Factura:</span>
                </div>
                <div className="ml-6 space-y-1 text-sm">
                  {movement.supplier_invoice_id && (
                    <p>Factura de proveedor vinculada</p>
                  )}
                  {movement.supplier_invoice_item_id && (
                    <p>Linea de factura vinculada al movimiento</p>
                  )}
                </div>
              </div>
            )}

            {movement.reason && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Motivo:</span>
                </div>
                <p className="text-sm ml-6">{movement.reason}</p>
              </div>
            )}

            {movement.observations && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
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
      </div>

      {/* Change history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-primary" />
            Historial de cambios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MovementHistorySection movementId={movement.id} />
        </CardContent>
      </Card>

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
              <Edit className="size-4 mr-2" />
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
        <DialogContent className="inventory-dialog max-w-4xl max-h-[90vh]">
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

const MovementHistorySection: React.FC<{ movementId: string }> = ({ movementId }) => {
  const { data, isLoading } = useInventoryMovementChangeHistory(movementId);
  return <ChangeHistoryPanel changes={data || []} isLoading={isLoading} />;
};
