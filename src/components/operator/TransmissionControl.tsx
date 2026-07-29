import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Eye, Loader2, Play, Radio, RadioTower, Share2, Square, WifiOff } from 'lucide-react';
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
import { OperatorDrivePanel } from '@/components/operator/OperatorDrivePanel';
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
import { resolveTransmissionStopGate } from '@/utils/transmissionStopGate';
import { buildPublicTrackingUrl } from '@/utils/trackingUrl';
import {
  KEEP_AWAKE_DENIED_MESSAGE,
  keepAwakeSafely,
  subscribeKeepAwake,
  type KeepAwakeOutcome,
} from '@/utils/keepAwake';
import type { Service } from '@/types';

const logger = createLogger('Tracking');

/**
 * Con la transmisión encendida, si la última subida CONFIRMADA supera este
 * umbral el pulso pasa a ámbar solo. Es alarma de congelamiento: el operador no
 * tiene que revisar nada para enterarse de que dejó de llegar información.
 */
const UPLOAD_STALE_MS = 2 * 60 * 1000;
const AGE_TICK_MS = 5000;

/**
 * Cadencia con la que se relee si el cliente tiene un link vigente.
 *
 * El estado no puede quedarse pegado al valor del montaje: el 26/07 el link se
 * creó a las 14:13 y la insignia del ojo —y con ella el gate del PIN— siguió
 * creyendo que nadie miraba hasta las 21:3x.
 */
const LINK_STATE_REFRESH_MS = 60000;

/**
 * Deep link de recuperación: `/operador?accion=reanudar` (o `/operator?...`).
 *
 * Lo usa el aviso de WhatsApp del watchdog de servidor. El operador toca la
 * notificación, aterriza aquí con el botón enfocado y resuelve con un gesto.
 */
export const RESUME_TRIP_ACTION = 'reanudar';

const SERVICE_STATE_LABELS: Record<string, string> = {
  pending: 'Asignado',
  in_progress: 'En curso',
  inspection_completed: 'Por entregar',
};

interface TransmissionControlProps {
  operatorId?: string | null;
  userId?: string | null;
  /** El mapa/velocímetro sólo pertenece a Inicio; el watcher GPS sigue montado en las demás pestañas. */
  showDrivePanel?: boolean;
  /** Servicio al que se asocia la transmisión (puede ser el próximo asignado). */
  currentService?: Service | null;
  /**
   * Servicio EN CURSO (in_progress / inspection_completed). Es el único al que
   * pueden colgarse detenciones: el chip se deshabilita si no hay ninguno.
   */
  activeService?: Service | null;
  /** Servicios en vuelo de la jornada, para elegir cuando hay más de uno. */
  candidates?: Service[];
  /** true = hay varios en vuelo y nadie eligió: no se asume ninguno. */
  requiresSelection?: boolean;
  onSelectService?: (serviceId: string | null) => void;
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
  showDrivePanel = true,
  currentService,
  activeService = null,
  candidates = [],
  requiresSelection = false,
  onSelectService,
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
  // La detención se cuelga SIEMPRE del servicio en curso, jamás del "próximo
  // servicio" de la tarjeta de resumen (bug del 25/07: el descanso quedó
  // registrado en un servicio de la mañana siguiente).
  const activeServiceId = activeService?.id ?? null;
  const { stopEvent, minutesStopped, isBusy: isStopBusy, declareStop, resume } = useServiceStopEvent({
    serviceId: activeServiceId,
    operatorId,
    lastPoint,
  });

  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showAlwaysHint, setShowAlwaysHint] = useState(false);
  const [keepAwakeOutcome, setKeepAwakeOutcome] = useState<KeepAwakeOutcome>('idle');
  const [now, setNow] = useState(() => businessClock.now());
  const [isResumingTrip, setIsResumingTrip] = useState(false);
  const resumeTripRef = useRef<HTMLButtonElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // URL del seguimiento resuelta por adelantado. Compartir tiene que poder
  // llamar a navigator.share SIN una llamada de red por delante: la activación
  // transitoria del gesto expira durante el await y Safari rechaza con
  // NotAllowedError (26/07, 14:13 — el token se creó y el panel nunca se abrió).
  const trackingUrlRef = useRef<string | null>(null);

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

  /**
   * ¿Hay un cliente mirando? Se resuelve contra la BD (RPC SECURITY DEFINER:
   * el operador nunca lee la tabla de tokens) y devuelve el valor para que el
   * gate del corte pueda usarlo en el acto, sin esperar un render.
   *
   * Devuelve `null` cuando no se pudo averiguar: quien decide trata la
   * incertidumbre como "puede haber alguien mirando".
   */
  const refreshLinkState = useCallback(async (): Promise<boolean | null> => {
    if (!serviceId) {
      setHasActiveLink(false);
      return false;
    }
    const { data, error } = await supabase.rpc('service_has_active_tracking_link', {
      p_service_id: serviceId,
    });
    if (error) {
      logger.warn('No se pudo revisar el link de seguimiento vigente', error);
      return null;
    }
    const active = data === true;
    setHasActiveLink(active);
    return active;
  }, [serviceId]);

  // Al montar, cada minuto y al volver a primer plano. Un valor de hace siete
  // horas no sirve para decidir si el corte necesita PIN.
  useEffect(() => {
    void refreshLinkState();
    const intervalId = window.setInterval(() => { void refreshLinkState(); }, LINK_STATE_REFRESH_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshLinkState();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshLinkState]);

  useEffect(() => subscribeKeepAwake(setKeepAwakeOutcome), []);

  /**
   * La transmisión está caída y el operador tiene un traslado en curso: la
   * recuperación deja de ser genérica ("toca para encender") y pasa a ser un
   * solo gesto que arregla las tres cosas a la vez.
   *
   * Las dos reanudaciones exitosas de la semana del 27/07 fueron MANUALES; las
   * automáticas fallaron o no corrieron. Lo simple y confiable primero: el
   * rearme automático del Fix 8 queda como capa de conveniencia encima, nunca
   * como única vía.
   */
  const canResumeTrip = !isTracking && Boolean(activeServiceId) && !trackingDisabled;

  // Aterrizaje del deep link: el botón se enfoca y se trae a la vista. El
  // parámetro se consume una sola vez para que un refresco no vuelva a robar
  // el foco mientras el operador maneja.
  useEffect(() => {
    if (searchParams.get('accion') !== RESUME_TRIP_ACTION) return;
    if (!canResumeTrip) return;

    resumeTripRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    resumeTripRef.current?.focus({ preventScroll: true });

    const next = new URLSearchParams(searchParams);
    next.delete('accion');
    setSearchParams(next, { replace: true });
  }, [canResumeTrip, searchParams, setSearchParams]);

  /**
   * Token del link, pedido apenas hay servicio y cacheado.
   *
   * `get_operator_service_tracking_token` es idempotente: reutiliza el vigente
   * y solo crea uno si no lo hay, así que pedirlo por adelantado no multiplica
   * links. Con la URL ya en mano, compartir es una operación síncrona dentro
   * del gesto.
   */
  useEffect(() => {
    if (!serviceId) {
      trackingUrlRef.current = null;
      return;
    }

    let cancelled = false;
    void supabase
      .rpc('get_operator_service_tracking_token', { p_service_id: serviceId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          logger.warn('No se pudo preparar el link de seguimiento', error);
          return;
        }
        trackingUrlRef.current = buildPublicTrackingUrl(data);
        void refreshLinkState();
      });

    return () => { cancelled = true; };
  }, [refreshLinkState, serviceId]);

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

  /** Copia al portapapeles con respaldo para WebViews que no exponen la API. */
  const copyToClipboard = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      logger.warn('El portapapeles no aceptó el link', error);
      return false;
    }
  };

  const markShared = async () => {
    if (!serviceId) return;
    const { error } = await supabase.rpc('mark_service_tracking_link_shared', {
      p_service_id: serviceId,
    });
    if (error) logger.warn('No se pudo marcar el link como entregado', error);
    await refreshLinkState();
  };

  /**
   * Compartir NUNCA termina en error: a lo más se degrada a copiar.
   *
   * Orden obligatorio dentro del gesto: primero `navigator.share` con el URL ya
   * cacheado (sin ningún await por delante), y recién después el resto —
   * encender la transmisión, marcar el link como entregado—. Invertirlo es lo
   * que produjo el NotAllowedError del 26/07.
   */
  const handleShare = async () => {
    if (!serviceId) return;

    const url = trackingUrlRef.current;
    setIsSharing(true);

    // Regla dura: compartir con la transmisión apagada la enciende igual. Va
    // sin await para no consumir la activación del gesto antes del share.
    const keepAwakePromise = isTracking ? null : keepAwakeSafely();
    const resumePromise = isTracking ? null : resumeTracking();

    try {
      if (url && navigator.share) {
        try {
          await navigator.share({ title: `Seguimiento ${currentService?.folio ?? ''}`.trim(), url });
          await markShared();
          return;
        } catch (error) {
          // Cancelar el diálogo nativo no es un fallo que reportar ni que
          // degradar: el operador decidió no compartir.
          if (error instanceof DOMException && error.name === 'AbortError') return;
          logger.warn('El panel de compartir no se abrió, se copia el link', error);
        }
      }

      // Sin URL cacheada (arranque muy temprano o RPC caída) se pide ahora: se
      // pierde el share nativo, pero el operador se lleva el link igual.
      const fallbackUrl = url ?? await (async () => {
        const { data, error } = await supabase.rpc('get_operator_service_tracking_token', {
          p_service_id: serviceId,
        });
        if (error || !data) return null;
        const resolved = buildPublicTrackingUrl(data);
        trackingUrlRef.current = resolved;
        return resolved;
      })();

      if (!fallbackUrl) {
        toast.error('No se pudo preparar el link. Revisa tu conexión e inténtalo de nuevo.');
        return;
      }

      if (await copyToClipboard(fallbackUrl)) {
        toast.success('Link copiado · pégalo en WhatsApp');
        await markShared();
        return;
      }

      // Último recurso: el link a la vista para copiarlo a mano. Sigue siendo
      // mejor que un error técnico que no deja nada.
      toast.info(fallbackUrl, { description: 'Copia este link y envíaselo al cliente', duration: 30000 });
      await markShared();
    } finally {
      await Promise.allSettled([keepAwakePromise, resumePromise].filter(Boolean));
      setIsSharing(false);
    }
  };

  const handleToggle = async () => {
    if (!isTracking) {
      // El wake lock se pide DENTRO del gesto, antes de cualquier await: fuera
      // de él Safari lo rechaza ("possibly because the user denied permission").
      void keepAwakeSafely();
      await resumeTracking();
      return;
    }

    // El estado cacheado no decide el corte: se relee contra la BD en el
    // instante en que el operador aprieta. Si la consulta falla, se asume que
    // SÍ hay alguien mirando —la fricción de más es preferible a cortarle el
    // seguimiento a un cliente en silencio—.
    const freshLinkState = await refreshLinkState();
    const linkIsActive = freshLinkState ?? true;

    const { data: pinData, error: pinError } = await supabase.rpc('operator_has_pin', {
      p_operator_id: operatorId,
    });
    if (pinError) logger.warn('No se pudo revisar el PIN del operador', pinError);

    const gate = resolveTransmissionStopGate({
      hasActiveLink: linkIsActive,
      hasPin: pinData === true,
    });

    if (gate === 'pin') {
      setPinOpen(true);
      return;
    }

    if (linkIsActive) {
      // Con link vigente pero sin PIN configurado no se puede exigir lo que no
      // existe: se cae a la confirmación en vez de dejar al operador atrapado.
      logger.warn('Corte con link vigente sin PIN configurado: se usa doble confirmación', { operatorId });
    }

    setConfirmOpen(true);
  };

  /**
   * Reanudar viaje: UN toque, la secuencia completa.
   *
   * 1. Enciende la transmisión (que a su vez limpia `manual_stop`, en memoria y
   *    en la base, vía startSession).
   * 2. Cierra la detención abierta del servicio con `ended_by_source='manual'`.
   *
   * Hasta ahora eran dos gestos separados —encender y después "Rodando"—, y el
   * segundo se olvidaba: el cliente quedaba viendo "detenido" con la grúa
   * andando. El orden importa: primero la transmisión, porque es lo que el
   * cliente deja de ver; si el cierre de la detención falla, su propio toast lo
   * dice y la transmisión ya quedó arriba.
   */
  const handleResumeTrip = async () => {
    // Dentro del gesto y sin await por delante: fuera de él Safari rechaza el
    // wake lock.
    void keepAwakeSafely();
    setIsResumingTrip(true);
    try {
      await resumeTracking();
      if (stopEvent) await resume('manual');
      toast.success('Viaje reanudado · transmitiendo');
    } finally {
      setIsResumingTrip(false);
    }
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

  // Varios servicios en vuelo y ninguno elegido: NO se adivina. Sin elección no
  // se cuelga nada de ningún servicio —ni transmisión, ni link, ni detenciones—
  // porque "el primero de la lista" es exactamente lo que escribió una detención
  // en el servicio de la mañana siguiente (25/07).
  if (requiresSelection) {
    return (
      <section
        className="operator-transmission-control rounded-3xl border border-border bg-card p-4"
        aria-label="Elegir servicio de la jornada"
      >
        <p className="operator-native-eyebrow">Tienes {candidates.length} servicios en jornada</p>
        <h2 className="mt-1 text-lg font-bold text-foreground">¿En cuál estás trabajando?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La transmisión, el link del cliente y las detenciones se asocian al servicio que elijas.
        </p>
        <div className="mt-3 space-y-2">
          {candidates.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelectService?.(service.id)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">
                  {service.folio}
                  {service.licensePlate ? ` · ${service.licensePlate.toUpperCase()}` : ''}
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {service.client?.name ?? 'Cliente no especificado'} · {SERVICE_STATE_LABELS[service.status] ?? service.status}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="operator-transmission-control rounded-3xl border border-border bg-card p-4"
      aria-label="Control de transmisión"
    >
      {candidates.length > 1 && currentService && (
        // Identidad visible: con varios servicios en jornada, el control dice en
        // voz alta sobre cuál está operando.
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3 py-2">
          <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
            Trabajando en <span className="text-foreground">{currentService.folio}</span>
            {currentService.licensePlate ? ` · ${currentService.licensePlate.toUpperCase()}` : ''}
            {currentService.client?.name ? ` · ${currentService.client.name}` : ''}
          </p>
          <button
            type="button"
            onClick={() => onSelectService?.(null)}
            className="shrink-0 text-xs font-bold text-primary"
          >
            Cambiar
          </button>
        </div>
      )}

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
                : canResumeTrip
                  ? `El cliente no ve tu posición${stopEvent ? ' y te ve detenido' : ''}`
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

      {/* Recuperación en un toque. Ocupa el ancho completo y va inmediatamente
          debajo del estado: cuando la transmisión está caída con un traslado en
          curso, esta es LA acción de la pantalla. */}
      {canResumeTrip && (
        <Button
          ref={resumeTripRef}
          type="button"
          onClick={() => void handleResumeTrip()}
          disabled={isBusy || isResumingTrip || isStopBusy}
          className="mt-4 min-h-14 w-full rounded-2xl text-base font-bold"
        >
          {isResumingTrip
            ? <Loader2 className="size-5 animate-spin" />
            : <Play className="size-5 fill-current" />}
          {isResumingTrip ? 'Reanudando…' : 'Reanudar viaje'}
        </Button>
      )}

      {showDrivePanel && <OperatorDrivePanel isTracking={isTracking} point={lastPoint} />}

      {(activeServiceId || serviceId) && (
        <div className="mt-3">
          {!activeServiceId ? (
            // Hay servicio asignado pero ninguno en curso: el chip existe y se
            // ve deshabilitado, en vez de escribir la detención en el servicio
            // equivocado.
            <>
              <StopReasonPicker disabled onSelect={declareStop} />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Inicia el servicio para poder registrar detenciones.
              </p>
            </>
          ) : stopEvent ? (
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

      {/* El sistema negó mantener la pantalla activa. No corta la transmisión:
          es un aviso de que la pantalla se va a apagar sola y con ella el
          rastreo, con la instrucción concreta para evitarlo. */}
      {isTracking && keepAwakeOutcome === 'denied' && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
          {KEEP_AWAKE_DENIED_MESSAGE}
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
