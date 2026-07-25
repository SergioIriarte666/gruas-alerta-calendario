import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { ShieldAlert } from 'lucide-react';

const logger = createLogger('Tracking');

interface OperatorPinDialogProps {
  open: boolean;
  operatorId: string;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void | Promise<void>;
}

/**
 * PIN para cortar la transmisión mientras un cliente mira el link.
 *
 * No bloquea tras N intentos a propósito: dejar a una grúa sin poder operar la
 * app en terreno por un PIN mal tecleado es peor que el corte que se intenta
 * evitar. Los intentos fallidos se registran y la transmisión sigue encendida,
 * que es el estado seguro.
 */
export const OperatorPinDialog = ({
  open,
  operatorId,
  onOpenChange,
  onVerified,
}: OperatorPinDialogProps) => {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPin('');
      setAttempts(0);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (pin.length !== 4) return;
    setIsChecking(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_operator_pin', {
        p_operator_id: operatorId,
        p_pin: pin,
      });

      if (rpcError) throw new Error(rpcError.message);

      if (data === true) {
        onOpenChange(false);
        await onVerified();
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPin('');
      setError('PIN incorrecto. La transmisión sigue encendida.');
      logger.warn('Intento de corte con PIN incorrecto', { operatorId, attempts: nextAttempts });
    } catch (verifyError) {
      logger.warn('No se pudo verificar el PIN', verifyError);
      setError('No se pudo verificar el PIN. La transmisión sigue encendida.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detener transmisión</DialogTitle>
          <DialogDescription>
            El cliente está viendo tu recorrido. Ingresa tu PIN para confirmar que quieres cortarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="operator-pin">PIN de 4 dígitos</Label>
          <Input
            id="operator-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleConfirm(); }}
            className="min-h-12 rounded-xl text-center text-2xl tracking-[0.5em]"
          />
          {error && (
            <p className="flex items-start gap-1.5 text-sm text-danger">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isChecking}>
            Seguir transmitiendo
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={pin.length !== 4 || isChecking}
          >
            {isChecking ? 'Verificando...' : 'Detener'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
