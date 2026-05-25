import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Edit, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Commission } from '@/types/commissions';
import { formatForDisplay, getCurrentChileDate, createLocalDateFromCalendar } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { useCommissionPayments } from '@/hooks/commissions/useCommissionPayments';
import { toast } from 'sonner';

interface EditPaymentDateDialogProps {
  commissions: Commission[];
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const EditPaymentDateDialog: React.FC<EditPaymentDateDialogProps> = ({
  commissions,
  trigger,
  onSuccess
}) => {
  const [paymentDate, setPaymentDate] = useState<Date>(getCurrentChileDate());
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { updateCommissionPaymentDate, isUpdatingPaymentDate } = useCommissionPayments();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentDate) {
      toast.error('Debe seleccionar una fecha de pago');
      return;
    }

    const commissionIds = commissions.map(c => c.id);
    
    // Crear nota con contexto del cambio
    const changeNote = notes ? ` Motivo del cambio: ${notes}` : '';
    const batchNote = `Fecha de pago actualizada el ${formatForDisplay(getCurrentChileDate())}.${changeNote}`;

    updateCommissionPaymentDate({
      commissionIds,
      paymentDate,
      paymentBatchId: `EDIT-${Date.now()}` // ID único para el cambio
    }, {
      onSuccess: () => {
        toast.success(`Fechas actualizadas para ${commissions.length} comisión(es)`);
        setIsOpen(false);
        setNotes('');
        setPaymentDate(getCurrentChileDate());
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error('Error al actualizar fechas: ' + (error.message || 'Error desconocido'));
      }
    });
  };

  // Validar que solo comisiones pagadas puedan ser editadas
  const paidCommissions = commissions.filter(c => c.status === 'paid');
  const isPendingCommissions = commissions.some(c => c.status === 'pending');

  if (isPendingCommissions) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Edit className="size-4 mr-2" />
        Solo comisiones pagadas
      </Button>
    );
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Edit className="size-4 mr-2" />
      {paidCommissions.length === 1 ? 'Editar fecha' : `Editar ${paidCommissions.length} fechas`}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar Fecha de Pago
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Comisiones a modificar: <span className="font-medium">{paidCommissions.length}</span>
            </Label>
            <div className="text-xs text-muted-foreground">
              {paidCommissions.slice(0, 3).map(c => c.service_folio || c.id.slice(0, 8)).join(', ')}
              {paidCommissions.length > 3 && ` +${paidCommissions.length - 3} más`}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nueva Fecha de Pago</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {paymentDate ? formatForDisplay(paymentDate) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => {
                    if (date) {
                      // Crear fecha local manteniendo el día exacto seleccionado
                      const localDate = createLocalDateFromCalendar(date);
                      setPaymentDate(localDate);
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Motivo del Cambio (Opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: Corrección de fecha incorrecta, ajuste contable..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isUpdatingPaymentDate}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isUpdatingPaymentDate}
            >
              {isUpdatingPaymentDate ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar Fechas'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};