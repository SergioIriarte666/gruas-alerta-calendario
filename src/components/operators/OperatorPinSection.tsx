import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
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
 *
 * La comprobación de rol se hace AQUÍ y no en el llamador: este modal también se
 * abre desde el Parte Diario, que no es una ruta solo-admin. Un PIN que el
 * propio vigilado puede quitar no protege nada. Las funciones
 * set_operator_pin/clear_operator_pin ya exigen admin en la base de datos: esto
 * es la capa visual del mismo criterio, no su único guardián.
 */
export const OperatorPinSection = ({ operatorId }: OperatorPinSectionProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Lee de la BASE si el PIN existe. Devuelve el booleano —no solo lo guarda en
   * estado— porque los handlers lo usan como CONFIRMACIÓN: el badge y el toast
   * de éxito se emiten contra lo que dice la base, nunca contra el optimismo del
   * cliente. El 26/07 la UI dio por guardado un PIN que nunca llegó a
   * operator_pins; al día siguiente el mismo flujo funcionó. Un fallo
   * intermitente que se muestra como éxito es peor que un fallo a secas: el
   * admin se va convencido de que el operador quedó protegido.
   *
   * Si la lectura falla, se propaga: "no pude confirmar" no es "salió bien".
   */
  const readHasPin = useCallback(async () => {
    const { data, error } = await supabase.rpc('operator_has_pin', { p_operator_id: operatorId });
    logger.debug('operator_has_pin', { operatorId, data, error: error?.message ?? null });
    if (error) throw new Error(error.message);
    return data === true;
  }, [operatorId]);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setHasPin(await readHasPin());
    } catch (error) {
      // El badge queda en "desconocido" en vez de mentir en cualquiera de los
      // dos sentidos.
      setHasPin(null);
      logger.warn('No se pudo consultar el estado del PIN', error);
    }
  }, [isAdmin, readHasPin]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    if (pin.length !== 4) return;
    setIsSaving(true);
    logger.debug('set_operator_pin request', { operatorId });
    try {
      const { error } = await supabase.rpc('set_operator_pin', {
        p_operator_id: operatorId,
        p_pin: pin,
      });
      logger.debug('set_operator_pin response', { operatorId, error: error?.message ?? null });
      if (error) throw new Error(error.message);

      const confirmed = await readHasPin();
      if (!confirmed) {
        throw new Error('El PIN no quedó guardado. Vuelve a intentarlo.');
      }

      setHasPin(true);
      setPin('');
      toast.success('PIN actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el PIN';
      logger.warn('No se pudo guardar el PIN', error);
      toast.error(message);
      // El badge NO cambia por un intento fallido: se re-lee y que hable la base.
      void refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    logger.debug('clear_operator_pin request', { operatorId });
    try {
      const { error } = await supabase.rpc('clear_operator_pin', { p_operator_id: operatorId });
      logger.debug('clear_operator_pin response', { operatorId, error: error?.message ?? null });
      if (error) throw new Error(error.message);

      const stillHasPin = await readHasPin();
      if (stillHasPin) {
        throw new Error('El PIN sigue configurado. Vuelve a intentarlo.');
      }

      setHasPin(false);
      toast.success('PIN eliminado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el PIN';
      logger.warn('No se pudo eliminar el PIN', error);
      toast.error(message);
      void refresh();
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
