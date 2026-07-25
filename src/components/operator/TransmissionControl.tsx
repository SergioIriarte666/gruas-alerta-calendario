import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Loader2, Radio, RadioTower, Share2, Square, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { OperatorPinDialog } from '@/components/operator/OperatorPinDialog';
import { StopReasonPicker } from '@/components/operator/StopReasonPicker';
import { useOperatorLocationTracking } from '@/hooks/useOperatorLocationTracking';
import { useServiceStopEvent } from '@/hooks/operator/useServiceStopEvent';
import { useAutoTransmissionOnMovement } from '@/hooks/operator/useAutoTransmissionOnMovement';
import { checkLocationPermission } from '@/services/operatorLocationService';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { STOP_REASON_LABELS } from '@/types/serviceStopEvent';
import type { Service } from '@/types';

const logger = createLogger('Tracking');

/**
 * Con la transmisión encendida, si la última subida CONFIRMADA supera este
 * umbral el pulso pasa a ámbar solo. Es alarma de congelamiento: el operador no
 * tiene que revisar nada para enterarse de que dejó de llegar información.
 */
const UPLOAD_STALE_MS = 2 * 60 * 1000;
const AGE_TICK_MS = 5000;

interface TransmissionControlProps {
  operatorId?: string | null;
  userId?: string | null;
  currentService?: Service | null;
}

const formatAge = (iso: string | null, now: Date): string | null => {
  if (!iso) return null;
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
};

/**
 * Control único de transmisión del servicio activo.
 *
 * Reemplaza las piezas sueltas (compartir ubicación, link del cliente, estado
 * de subida) por un solo interruptor cuyo estado se lee de un vistazo, sin
 * textos explicativos.
 */
export const TransmissionControl = ({
  operatorId,
  userId,
  currentService,
}: TransmissionControlProps) => {
  const {
    isTracking,
    isBusy,
    lastPoint,
    lastSyncAt,
    pendingCount,
    errorMessage,
    trackingDisabled,
    manualStop,
    resumeTracking,
    stopTransmission,
    startTransmissionAutomatically,
  } = useOperatorLocationTracking({ operatorId, userId, currentService });

  const serviceId = currentService?.id ?? null;
  const { stopEvent, minutesStopped, isBusy: isStopBusy, declareStop, resume } = useServiceStopEvent({
    serviceId,
    operatorId,
    lastPoint,
  });

  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showAlwaysHint, setShowAlwaysHint] = useState(false);
  const [now, setNow] = useState(() => businessClock.now());

  const { isRollingWithoutTransmitting } = useAutoTransmissionOnMovement({
    enabled: Boolean(serviceId) && !isTracking && !trackingDisabled,
    manualStop,
    onSustainedMovement: startTransmissionAutomatically,
  });

  // La "edad del punto" tiene que avanzar sola, o el ámbar de congelamiento
  // nunca aparecería hasta que algo más provoque un render.
  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(businessClock.now()), AGE_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const refreshLinkState = useCallback(async () => {
    if (!serviceId) {
      setHasActiveLink(false);
      return;
    }
    const { data, error } = await supabase.rpc('service_has_active_tracking_link', {
      p_service_id: serviceId,
    });
    if (error) {
      logger.warn('No se pudo revisar el link de seguimiento vigente', error);
      return;
    }
    setHasActiveLink(data === true);
  }, [serviceId]);

  useEffect(() => { void refreshLinkState(); }, [refreshLinkState]);

  // Sin permiso "Siempre" en iOS el rastreo muere al bloquear la pantalla: es
  // el único texto que se conserva, porque sin él el control queda en gris sin
  // que el operador pueda deducir por qué.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void checkLocationPermission().then((state) => setShowAlwaysHint(state !== 'granted'));
  }, [isTracking]);

  if (trackingDisabled || !operatorId) return null;

  // Edad medida contra la CONFIRMACIÓN de subida, no contra la captura local:
  // es el dato que efectivamente ve el cliente.
  const uploadAgeMs = lastSyncAt ? now.getTime() - new Date(lastSyncAt).getTime() : null;
  const isFrozen = isTracking && (uploadAgeMs === null || uploadAgeMs > UPLOAD_STALE_MS);
  const ageLabel = formatAge(lastSyncAt, now);

  const handleShare = async () => {
    if (!serviceId) return;
    setIsSharing(true);
    try {
      // Regla dura: compartir con la transmisión apagada la enciende PRIMERO.
      // El orden queda garantizado por la interfaz, no por la memoria del operador.
      if (!isTracking) {
        await resumeTracking();
      }

      const { data, error } = await supabase.rpc('get_operator_service_tracking_token', {
        p_service_id: serviceId,
      });
      if (error) throw new Error(error.message);

      const url = `${window.location.origin}/track/${data}`;
      if (navigator.share) {
        await navigator.share({ title: `Seguimiento ${currentService?.folio ?? ''}`.trim(), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link de seguimiento copiado');
      }
      await refreshLinkState();
    } catch (error) {
      // Cancelar el diálogo nativo de compartir no es un fallo que reportar.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'No se pudo compartir el seguimiento';
      logger.warn('No se pudo compartir el link de seguimiento', error);
      toast.error(message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleToggle = async () => {
    if (!isTracking) {
      await resumeTracking();
      return;
    }

    // Con un cliente mirando, el corte debe ser deliberado y atribuible.
    // Sin nadie mirando, basta doble confirmación: no agregar fricción donde
    // no aporta.
    if (hasActiveLink) {
      const { data } = await supabase.rpc('operator_has_pin', { p_operator_id: operatorId });
      if (data === true) {
        setPinOpen(true);
        return;
      }
      // Con link vigente pero sin PIN configurado no se puede exigir lo que no
      // existe: se cae a la confirmación en vez de dejar al operador atrapado.
      logger.warn('Corte con link vigente sin PIN configurado: se usa doble confirmación', { operatorId });
    }

    setConfirmOpen(true);
  };

  const statusTone = !isTracking
    ? isRollingWithoutTransmitting ? 'rolling' : 'off'
    : isFrozen ? 'frozen' : 'live';

  const toneClass = {
    off: 'border-border bg-muted text-muted-foreground',
    rolling: 'border-warning bg-muted text-muted-foreground operator-transmission-pulse--warning',
    frozen: 'border-warning/40 bg-warning/10 text-warning operator-transmission-pulse--warning',
    live: 'border-success/40 bg-success/10 text-success operator-transmission-pulse--live',
  }[statusTone];

  return (
    <section
      className="operator-transmission-control rounded-3xl border border-border bg-card p-4"
      aria-label="Control de transmisión"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={isBusy}
          aria-pressed={isTracking}
          aria-label={isTracking ? 'Detener transmisión' : 'Iniciar transmisión'}
          className={cn(
            'relative flex size-20 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-60',
            toneClass,
          )}
        >
          {isBusy
            ? <Loader2 className="size-8 animate-spin" />
            : isTracking
              ? <RadioTower className="size-8" />
              : <Radio className="size-8" />}

          {hasActiveLink && (
            <span
              className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-card bg-info text-info-foreground"
              aria-label="El cliente puede ver tu recorrido"
              title="El cliente puede ver tu recorrido"
            >
              <Eye className="size-3.5" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-foreground">
            {isTracking ? (isFrozen ? 'Subida detenida' : 'Transmitiendo') : 'Sin transmitir'}
          </p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground" aria-live="polite">
            {isTracking
              ? ageLabel ? `Último punto subido ${ageLabel}` : 'Esperando primera subida'
              : isRollingWithoutTransmitting
                ? 'Rodando sin transmitir'
                : 'Toca para encender'}
          </p>
          {pendingCount > 0 && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
              <WifiOff className="size-3" />
              {pendingCount} en cola
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void handleShare()}
          disabled={!serviceId || isSharing}
          aria-label="Compartir seguimiento con el cliente"
          className="size-12 shrink-0 rounded-2xl"
        >
          {isSharing ? <Loader2 className="size-5 animate-spin" /> : <Share2 className="size-5" />}
        </Button>
      </div>

      {serviceId && (
        <div className="mt-3">
          {stopEvent ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-warning">
                  Detenido · {STOP_REASON_LABELS[stopEvent.reason]}
                </p>
                <p className="text-xs font-medium text-warning/80">
                  desde {businessClock.format(stopEvent.started_at, 'HH:mm')} · {minutesStopped} min
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void resume('manual')}
                disabled={isStopBusy}
                className="shrink-0 rounded-xl"
              >
                Rodando
              </Button>
            </div>
          ) : (
            <StopReasonPicker disabled={isStopBusy} onSelect={declareStop} />
          )}
        </div>
      )}

      {showAlwaysHint && (
        <p className="mt-3 rounded-xl border border-info/30 bg-info/10 p-2.5 text-xs text-info">
          Para transmitir con la pantalla apagada, activa Ubicación → Siempre en Ajustes de iOS.
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
          {errorMessage}
        </p>
      )}

      <OperatorPinDialog
        open={pinOpen}
        operatorId={operatorId}
        onOpenChange={setPinOpen}
        onVerified={() => stopTransmission('manual_pin')}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Detener transmisión?</AlertDialogTitle>
            <AlertDialogDescription>
              La central dejará de recibir tu posición hasta que la vuelvas a encender a mano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir transmitiendo</AlertDialogCancel>
            <AlertDialogAction onClick={() => void stopTransmission('manual_confirm')}>
              <Square className="size-4" />
              Detener
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
