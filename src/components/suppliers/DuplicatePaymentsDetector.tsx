import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Check, 
  Loader2, 
  Trash2, 
  Copy,
  Calendar,
  DollarSign
} from 'lucide-react';
import { usePaymentDuplicateCheck, DuplicateGroup, DuplicatePayment } from '@/hooks/usePaymentDuplicateCheck';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { parseFromDatabase, formatForDisplay } from '@/utils/timezoneUtils';
import { getStatusLabel, getStatusColor } from '@/hooks/useSupplierPayments';
import { toast } from 'sonner';

type ResolutionAction = 'keep_newest' | 'keep_oldest' | 'cancel_duplicates' | 'ignore';

interface ResolutionChoice {
  groupKey: string;
  action: ResolutionAction;
  keepPaymentId?: string;
}

interface DuplicatePaymentsDetectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicatePaymentsDetector: React.FC<DuplicatePaymentsDetectorProps> = ({
  isOpen,
  onClose
}) => {
  const { findAllDuplicates, deletePayment, cancelPayment } = usePaymentDuplicateCheck();
  const { suppliers } = useSuppliers();
  const queryClient = useQueryClient();
  
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionChoice>>({});

  useEffect(() => {
    if (isOpen) {
      loadDuplicates();
    }
  }, [isOpen]);

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      const groups = await findAllDuplicates(suppliers);
      setDuplicateGroups(groups);
      
      // Initialize default resolutions (ignore all by default)
      const defaultResolutions: Record<string, ResolutionChoice> = {};
      groups.forEach(group => {
        const key = `${group.supplier_id}|${group.reference_number}`;
        defaultResolutions[key] = { groupKey: key, action: 'ignore' };
      });
      setResolutions(defaultResolutions);
    } catch (error) {
      console.error('Error loading duplicates:', error);
      toast.error('Error al cargar los duplicados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionChange = (groupKey: string, action: ResolutionAction, group: DuplicateGroup) => {
    let keepPaymentId: string | undefined;
    
    if (action === 'keep_newest') {
      // Sort by created_at descending, keep the first
      const sorted = [...group.payments].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      keepPaymentId = sorted[0].id;
    } else if (action === 'keep_oldest') {
      // Sort by created_at ascending, keep the first
      const sorted = [...group.payments].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      keepPaymentId = sorted[0].id;
    }

    setResolutions(prev => ({
      ...prev,
      [groupKey]: { groupKey, action, keepPaymentId }
    }));
  };

  const handleApplyResolutions = async () => {
    const actionsToApply = Object.values(resolutions).filter(r => r.action !== 'ignore');
    
    if (actionsToApply.length === 0) {
      toast.info('No hay acciones seleccionadas para aplicar');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const resolution of actionsToApply) {
        const group = duplicateGroups.find(g => 
          `${g.supplier_id}|${g.reference_number}` === resolution.groupKey
        );
        
        if (!group) continue;

        if (resolution.action === 'keep_newest' || resolution.action === 'keep_oldest') {
          // Delete all except the one to keep
          for (const payment of group.payments) {
            if (payment.id !== resolution.keepPaymentId) {
              const success = await deletePayment(payment.id);
              if (success) {
                successCount++;
              } else {
                errorCount++;
              }
            }
          }
        } else if (resolution.action === 'cancel_duplicates') {
          // Cancel all except the oldest one
          const sorted = [...group.payments].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          for (let i = 1; i < sorted.length; i++) {
            const success = await cancelPayment(sorted[i].id);
            if (success) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        }
      }

      // Refresh the payments list
      await queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      
      if (successCount > 0) {
        toast.success(`${successCount} pago(s) procesado(s) correctamente`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} pago(s) no pudieron ser procesados`);
      }

      // Reload duplicates to update the list
      await loadDuplicates();
      
    } catch (error) {
      console.error('Error applying resolutions:', error);
      toast.error('Error al aplicar las resoluciones');
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionLabel = (action: ResolutionAction) => {
    switch (action) {
      case 'keep_newest': return 'Conservar más reciente';
      case 'keep_oldest': return 'Conservar más antiguo';
      case 'cancel_duplicates': return 'Cancelar duplicados';
      case 'ignore': return 'Ignorar';
    }
  };

  const renderPaymentCard = (payment: DuplicatePayment) => (
    <div 
      key={payment.id} 
      className="p-3 bg-muted/50 rounded-lg border border-border space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {formatCurrency(payment.amount)}
          </span>
        </div>
        <Badge className={`${getStatusColor(payment.status)} text-black text-xs`}>
          {getStatusLabel(payment.status)}
        </Badge>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {payment.description}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Vence: {formatForDisplay(parseFromDatabase(payment.due_date))}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Creado: {formatForDisplay(parseFromDatabase(payment.created_at))}</span>
        </div>
      </div>
      
      {payment.paid_date && (
        <div className="text-xs text-violet-600">
          Pagado: {formatForDisplay(parseFromDatabase(payment.paid_date))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Copy className="h-5 w-5 text-amber-500" />
            Detector de Pagos Duplicados
          </DialogTitle>
          <DialogDescription>
            Identifica y resuelve pagos con el mismo número de referencia para el mismo proveedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Buscando duplicados...</span>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                ¡Sin duplicados!
              </h3>
              <p className="text-muted-foreground">
                No se encontraron pagos duplicados en el sistema.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-foreground">
                  Se encontraron <strong>{duplicateGroups.length}</strong> grupos de pagos duplicados
                </span>
              </div>

              {duplicateGroups.map((group) => {
                const key = `${group.supplier_id}|${group.reference_number}`;
                const resolution = resolutions[key];
                
                return (
                  <Card key={key} className="border bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{group.supplier_name}</span>
                          <Badge variant="outline" className="font-mono">
                            Ref: {group.reference_number}
                          </Badge>
                        </div>
                        <Badge className="bg-amber-500 text-black">
                          {group.payments.length} pagos
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Payment cards */}
                      <div className="grid gap-2">
                        {group.payments.map(payment => renderPaymentCard(payment))}
                      </div>
                      
                      {/* Resolution options */}
                      <div className="border-t border-border pt-4">
                        <Label className="text-sm font-medium text-foreground mb-3 block">
                          Acción a realizar:
                        </Label>
                        <RadioGroup
                          value={resolution?.action || 'ignore'}
                          onValueChange={(value) => handleActionChange(key, value as ResolutionAction, group)}
                          className="grid grid-cols-2 gap-3"
                        >
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-muted/50">
                            <RadioGroupItem value="keep_newest" id={`${key}-newest`} />
                            <Label htmlFor={`${key}-newest`} className="cursor-pointer text-sm">
                              Conservar más reciente (eliminar antiguos)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-muted/50">
                            <RadioGroupItem value="keep_oldest" id={`${key}-oldest`} />
                            <Label htmlFor={`${key}-oldest`} className="cursor-pointer text-sm">
                              Conservar más antiguo (eliminar nuevos)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-muted/50">
                            <RadioGroupItem value="cancel_duplicates" id={`${key}-cancel`} />
                            <Label htmlFor={`${key}-cancel`} className="cursor-pointer text-sm">
                              Marcar duplicados como cancelados
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-muted/50">
                            <RadioGroupItem value="ignore" id={`${key}-ignore`} />
                            <Label htmlFor={`${key}-ignore`} className="cursor-pointer text-sm">
                              Ignorar (no hacer nada)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {duplicateGroups.length > 0 && (
            <Button 
              onClick={handleApplyResolutions}
              disabled={isProcessing}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Aplicar Resoluciones
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
