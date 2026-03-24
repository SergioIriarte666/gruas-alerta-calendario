import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, Package, CreditCard, Wrench, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/costs';
import { toast } from 'sonner';

interface RelatedData {
  supplierPayments: number;
  inventoryMovements: number;
  craneParts: number;
}

interface CostDeleteConfirmDialogProps {
  cost: Cost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (cost: Cost) => void;
}

export const CostDeleteConfirmDialog = ({ cost, open, onOpenChange, onConfirmDelete }: CostDeleteConfirmDialogProps) => {
  const [relatedData, setRelatedData] = useState<RelatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const hasRelatedData = relatedData && (
    relatedData.supplierPayments > 0 || 
    relatedData.inventoryMovements > 0 || 
    relatedData.craneParts > 0
  );

  useEffect(() => {
    if (open && cost) {
      setPassword('');
      setPasswordError('');
      fetchRelatedData(cost);
    }
  }, [open, cost]);

  const fetchRelatedData = async (cost: Cost) => {
    setLoading(true);
    try {
      const queries: Promise<any>[] = [];

      // Supplier payments linked to this cost
      queries.push(
        supabase.from('supplier_payments' as any)
          .select('id', { count: 'exact', head: true })
          .or(`cost_id.eq.${cost.id}${cost.supplier_payment_id ? `,id.eq.${cost.supplier_payment_id}` : ''}`)
      );

      // Active inventory movements
      queries.push(
        supabase.from('inventory_movements')
          .select('id', { count: 'exact', head: true })
          .eq('cost_id', cost.id)
      );

      // Crane parts
      queries.push(
        supabase.from('crane_parts')
          .select('id', { count: 'exact', head: true })
          .eq('cost_id', cost.id)
      );

      const [payments, movements, parts] = await Promise.all(queries);

      setRelatedData({
        supplierPayments: payments.count || 0,
        inventoryMovements: movements.count || 0,
        craneParts: parts.count || 0,
      });
    } catch (err) {
      console.error('Error fetching related data:', err);
      setRelatedData({ supplierPayments: 0, inventoryMovements: 0, craneParts: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!cost) return;

    if (hasRelatedData) {
      // Require password
      if (!password.trim()) {
        setPasswordError('Ingrese su contraseña');
        return;
      }

      setVerifying(true);
      setPasswordError('');

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('No se pudo obtener el email del usuario');

        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password,
        });

        if (error) {
          setPasswordError('Contraseña incorrecta');
          setVerifying(false);
          return;
        }
      } catch (err) {
        setPasswordError('Error al verificar contraseña');
        setVerifying(false);
        return;
      }

      setVerifying(false);
    }

    onConfirmDelete(cost);
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Eliminar Costo
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {cost && (
          <div className="space-y-4">
            {/* Cost info */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm text-foreground">{cost.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(Number(cost.amount))} — {cost.date}
              </p>
            </div>

            {/* Related data impact */}
            {loading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando datos relacionados...</span>
              </div>
            ) : hasRelatedData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-sm font-medium">Este costo tiene datos relacionados:</span>
                </div>

                <div className="space-y-2 pl-6">
                  {relatedData!.supplierPayments > 0 && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {relatedData!.supplierPayments} pago(s) de proveedor
                      </span>
                      <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                    </div>
                  )}
                  {relatedData!.inventoryMovements > 0 && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {relatedData!.inventoryMovements} movimiento(s) de inventario
                      </span>
                      <Badge variant="destructive" className="text-xs">Se cancelará</Badge>
                    </div>
                  )}
                  {relatedData!.craneParts > 0 && (
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {relatedData!.craneParts} pieza(s) de grúa
                      </span>
                      <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                    </div>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="delete-password" className="text-sm">
                    Ingrese su contraseña para confirmar
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">{passwordError}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este costo no tiene datos relacionados y puede eliminarse directamente.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verifying}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || verifying || (hasRelatedData && !password.trim())}
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
