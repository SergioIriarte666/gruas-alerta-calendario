import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OperatorPin');

interface OperatorPinSectionProps {
  operatorId: string;
}

/**
 * PIN de transmisión del operador, definido y reseteable SOLO por admin.
 *
 * Protege el corte manual de transmisión mientras un cliente mira el link:
 * con alguien mirando, cortar debe ser un acto deliberado y atribuible, no un
 * toque accidental contra el bolsillo o el soporte.
 *
 * Aquí solo se escribe: el hash vive en operator_pins, tabla sin acceso para
 * roles de cliente, y nunca vuelve al navegador.
 */
export const OperatorPinSection = ({ operatorId }: OperatorPinSectionProps) => {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('operator_has_pin', { p_operator_id: operatorId });
    if (error) {
      logger.warn('No se pudo consultar el estado del PIN', error);
      return;
    }
    setHasPin(data === true);
  }, [operatorId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleSave = async () => {
    if (pin.length !== 4) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('set_operator_pin', {
        p_operator_id: operatorId,
        p_pin: pin,
      });
      if (error) throw new Error(error.message);
      setPin('');
      await refresh();
      toast.success('PIN actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el PIN';
      logger.warn('No se pudo guardar el PIN', error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('clear_operator_pin', { p_operator_id: operatorId });
      if (error) throw new Error(error.message);
      await refresh();
      toast.success('PIN eliminado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el PIN';
      logger.warn('No se pudo eliminar el PIN', error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">PIN de transmisión</h4>
        </div>
        {hasPin === null ? null : hasPin ? (
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
            <ShieldCheck className="size-3.5" />
            Configurado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <ShieldOff className="size-3.5" />
            Sin PIN
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Se pide al operador para detener la transmisión cuando el cliente está viendo el seguimiento.
        Sin PIN configurado basta una doble confirmación.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`operator-pin-${operatorId}`} className="text-xs">
            {hasPin ? 'Nuevo PIN' : 'Definir PIN'}
          </Label>
          <Input
            id={`operator-pin-${operatorId}`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="4 dígitos"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-32 text-center tracking-[0.4em]"
          />
        </div>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={pin.length !== 4 || isSaving}>
          Guardar
        </Button>
        {hasPin && (
          <Button type="button" size="sm" variant="outline" onClick={() => void handleClear()} disabled={isSaving}>
            Quitar
          </Button>
        )}
      </div>
    </section>
  );
};
