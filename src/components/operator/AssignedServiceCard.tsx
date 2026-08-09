import React from 'react';
import { Service } from '@/types';
import { Truck, Calendar, User, ChevronRight, CheckCircle, Play, Package, Navigation, Car, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { getTodayLocal, safeDaysSince } from '@/utils/timezoneUtils';
import { openNavigation } from '@/utils/navigationUtils';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';
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
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';
import { usePendingServiceHandoff } from '@/hooks/operator/useServiceHandoff';
import { ServiceHandoffGate } from './ServiceHandoffGate';
import { isStartableByOperator } from '@/constants/operatorVisibility';

interface AssignedServiceCardProps {
  service: Service;
  showDeliveryAction?: boolean;
  /**
   * El operador ve el servicio pero no lo maneja: es Adicional
   * (service_resources), no el principal. Muestra el expediente y esconde TODA
   * acción operacional. Ver `selectOperatedServices`.
   */
  readOnly?: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────

const getImminenceDays = (serviceDate: string): number => {
  const todayStr = getTodayLocal();
  return -safeDaysSince(serviceDate, todayStr);
};

const getUrgencyBorder = (serviceDate: string, status: Service['status']): string => {
  if (status === 'completed')            return 'border-l-muted-foreground/40';
  if (status === 'in_progress')          return 'border-l-info';
  if (status === 'inspection_completed') return 'border-l-warning';
  const days = getImminenceDays(serviceDate);
  if (days <= 0) return 'border-l-danger';
  if (days === 1) return 'border-l-primary';
  if (days <= 3) return 'border-l-warning';
  return 'border-l-muted-foreground/40';
};

const UrgencyBadge = ({ serviceDate, status }: { serviceDate: string; status: Service['status'] }) => {
  if (status === 'completed' || status === 'in_progress' || status === 'inspection_completed') return null;
  const days = getImminenceDays(serviceDate);
  if (days < 0) return <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger-text">Vencido</span>;
  if (days === 0) return <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger-text">Hoy</span>;
  if (days === 1) return <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">Mañana</span>;
  if (days <= 7)  return <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">en {days}d</span>;
  return null;
};

const StatusBadge = ({ status }: { status: Service['status'] }) => {
  const map: Record<string, { label: string; className: string }> = {
    pending:              { label: 'Pendiente',    className: 'bg-muted text-muted-foreground' },
    in_progress:          { label: 'En curso',     className: 'bg-info-soft text-info-text' },
    inspection_completed: { label: 'Por entregar', className: 'bg-warning-soft text-warning-text' },
    completed:            { label: 'Completado',   className: 'bg-success-soft text-success-text' },
    // Comerciales: el operador los ve y los puede iniciar; el chip explica
    // por que el servicio aparece antes de estar confirmado con el cliente.
    quoted:                 { label: 'Cotizado',    className: 'bg-muted text-muted-foreground' },
    purchase_order_pending: { label: 'Esperando OC', className: 'bg-muted text-muted-foreground' },
    with_purchase_order:    { label: 'Con OC',      className: 'bg-muted text-muted-foreground' },
  };
  const chip = map[status];
  if (!chip) return null;
  return <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', chip.className)}>{chip.label}</span>;
};

// ── contenido común ────────────────────────────────────────────────────────

const resolveNavigationTarget = (service: Service) => {
  const goingToDestination =
    service.status === 'inspection_completed' || service.status === 'completed';

  return goingToDestination
    ? {
        kind: 'destino' as const,
        label: service.destination,
        lat: service.destinationLat,
        lng: service.destinationLng,
      }
    : {
        kind: 'origen' as const,
        label: service.origin,
        lat: service.originLat,
        lng: service.originLng,
      };
};

const CardBody = ({ service, showNavigation = false }: { service: Service; showNavigation?: boolean }) => {
  const navigationTarget = resolveNavigationTarget(service);

  return (
    <div className="mt-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Truck className="size-4 flex-shrink-0 text-primary" />
          <span className="truncate">{service.serviceType?.name ?? 'Servicio no especificado'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="size-4 flex-shrink-0" />
          <span className="truncate">{service.client?.name ?? 'Cliente no especificado'}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-muted px-2.5 py-2 text-xs font-semibold text-muted-foreground">
        <Calendar className="size-3.5" />
        <span>{format(parseISO(service.serviceDate), 'd MMM', { locale: es })}</span>
      </div>
    </div>
    <div className="operator-route-line relative ml-1.5 space-y-2.5 pl-6">
      <div className="relative min-w-0 text-xs text-muted-foreground">
        <span className="operator-route-dot operator-route-dot--origin" />
        <p className="operator-native-eyebrow">Origen</p>
        <p className="truncate text-sm font-medium text-foreground">{service.origin}</p>
      </div>
      <div className={cn('relative min-w-0 text-xs text-muted-foreground', showNavigation && 'pr-16')}>
        <span className="operator-route-dot operator-route-dot--destination" />
        <p className="operator-native-eyebrow">Destino</p>
        <p className="truncate text-sm font-medium text-foreground">{service.destination}</p>
      </div>
      {showNavigation && navigationTarget.label && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openNavigation(navigationTarget.label, {
              lat: navigationTarget.lat,
              lng: navigationTarget.lng,
            });
          }}
          aria-label={`Abrir navegación al ${navigationTarget.kind}: ${navigationTarget.label}`}
          className="operator-navigation-button absolute bottom-0 right-0 flex min-h-10 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-primary transition-all active:scale-95"
        >
          <Navigation className="size-3.5" />
          Ir al {navigationTarget.kind}
        </button>
      )}
    </div>
    {(service.vehicleBrand || service.vehicleModel || service.licensePlate) && (
      <div className="flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2.5 text-sm text-muted-foreground">
        <Car className="size-4 flex-shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {[service.vehicleBrand, service.vehicleModel].filter(Boolean).join(' ')}
        </span>
        {service.licensePlate && (
          <span className="operator-license-plate shrink-0 rounded-md bg-card px-2 py-1 text-xs font-bold tracking-wider text-foreground">
            {service.licensePlate.toUpperCase()}
          </span>
        )}
      </div>
    )}
    </div>
  );
};

const CardHeader = ({ service, rightSlot }: { service: Service; rightSlot?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="operator-native-display text-2xl font-bold leading-none text-foreground">{service.folio}</span>
      <StatusBadge status={service.status} />
      <UrgencyBadge serviceDate={service.serviceDate} status={service.status} />
    </div>
    {rightSlot}
  </div>
);

// ── componente principal ───────────────────────────────────────────────────

export const AssignedServiceCard = ({
  service,
  showDeliveryAction = false,
  readOnly = false,
}: AssignedServiceCardProps) => {
  const { status } = service;
  const borderClass = getUrgencyBorder(service.serviceDate, status);
  const baseCard = cn('operator-service-card rounded-3xl border border-l-2 border-border bg-card p-5', borderClass);

  const navigate = useNavigate();
  const { updateServiceStatusMutation } = useServiceStatusUpdate(service.id);
  const [startTimeDraft, setStartTimeDraft] = React.useState<string | null>(null);
  const { data: pendingHandoff } = usePendingServiceHandoff(service.id);

  // services.start_time quedaba NULL al iniciar y la hora real de partida se
  // perdía. Se propone la hora actual del negocio (nunca new Date(): la TZ del
  // teléfono puede no ser la de la operación) y el operador la confirma o ajusta.
  const openStartDialog = () => {
    setStartTimeDraft(businessClock.format(businessClock.now(), 'HH:mm'));
  };

  const confirmStartService = async () => {
    const startTime = startTimeDraft;
    if (!startTime) return;

    try {
      await updateServiceStatusMutation.mutateAsync({
        id: service.id,
        // El folio que esta tarjeta está mostrando: si no corresponde al id que
        // se manda, el servidor rechaza en vez de iniciar otro servicio.
        folioConfirmation: service.folio,
        targetStatus: 'in_progress',
        startTime,
      });
      setStartTimeDraft(null);
      navigate(`/operator/service/${service.id}/inspection`);
    } catch {
      // el hook ya muestra el toast de error, no hay nada mas que hacer aqui
    }
  };

  const startServiceDialog = (
    <Dialog
      open={startTimeDraft !== null}
      onOpenChange={(open) => { if (!open) setStartTimeDraft(null); }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar servicio {service.folio}</DialogTitle>
          <DialogDescription>
            Confirma la hora real de inicio. Queda registrada en el servicio y en el informe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="service-start-time" className="flex items-center gap-2">
            <Clock className="size-4" />
            Hora de inicio
          </Label>
          <Input
            id="service-start-time"
            type="time"
            value={startTimeDraft ?? ''}
            onChange={(event) => setStartTimeDraft(event.target.value)}
            className="min-h-12 rounded-xl text-base"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStartTimeDraft(null)}
            disabled={updateServiceStatusMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirmStartService}
            disabled={!startTimeDraft || updateServiceStatusMutation.isPending}
          >
            {updateServiceStatusMutation.isPending ? 'Iniciando...' : 'Iniciar servicio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // MODO CONSULTA (operador Adicional)
  //
  // Va primero de todo: el servicio no es suyo, así que ninguna rama de abajo
  // debe poder ofrecerle un control. Ve el expediente —folio, ruta, vehículo,
  // navegación— y nada más. El 28/07 el adicional tenía habilitado "Rodando"
  // sobre la detención real de un operador a 500 km.
  if (readOnly) {
    return (
      <div className={cn(baseCard, 'opacity-90')}>
        <CardHeader
          service={service}
          rightSlot={
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Apoyo
            </span>
          }
        />
        <CardBody service={service} showNavigation />
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Estás como operador de apoyo. {service.operator?.name ?? 'El operador principal'} maneja
          la transmisión, las detenciones y la entrega de este servicio.
        </p>
      </div>
    );
  }

  // RECEPCIÓN PENDIENTE (relevo con servicio en vuelo)
  //
  // Va antes que cualquier otro estado: mientras el traspaso no esté confirmado,
  // la tarjeta no ofrece acciones. El servicio sigue transmitiendo y el cliente
  // sigue viendo su link —los puntos cuelgan del SERVICIO, no del operador—, lo
  // único que se retiene es la operación por parte del entrante.
  if (pendingHandoff) {
    return (
      <div className={baseCard}>
        <CardHeader service={service} rightSlot={<Package className="size-4 flex-shrink-0 text-warning-text" />} />
        <CardBody service={service} showNavigation />
        <ServiceHandoffGate serviceId={service.id} folio={service.folio} />
      </div>
    );
  }

  // COMPLETADO
  if (status === 'completed') {
    return (
      <div className={cn(baseCard, 'opacity-70')}>
        <CardHeader service={service} rightSlot={<CheckCircle className="size-4 text-success-text flex-shrink-0" />} />
        <CardBody service={service} />
      </div>
    );
  }

  // EN PROGRESO
  if (status === 'in_progress') {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'transition-transform active:scale-[0.99]')}>
          <CardHeader service={service} rightSlot={<Play className="size-4 text-info-text flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
          <div className="operator-service-action mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-info-soft px-4 text-center text-sm font-bold text-info-text">
            Continuar inspección inicial
          </div>
        </div>
      </Link>
    );
  }

  // LISTO PARA ENTREGA
  if (status === 'inspection_completed' && showDeliveryAction) {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'transition-transform active:scale-[0.99]')}>
          <CardHeader service={service} rightSlot={<Package className="size-4 text-warning-text flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
          <div className="operator-service-action mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-warning-soft px-4 text-center text-sm font-bold text-warning-text">
            Completar entrega
          </div>
        </div>
      </Link>
    );
  }

  // POR INICIAR — incluye los estados comerciales ('quoted', OC pendiente...).
  // Antes solo entraba 'pending' y un servicio cotizado caia al fallback: se
  // veia en la lista pero no habia forma de arrancarlo.
  if (isStartableByOperator(status)) {
    return (
      <div className={baseCard}>
        <CardHeader service={service} rightSlot={<ChevronRight className="size-4 flex-shrink-0 text-muted-foreground" />} />
        <CardBody service={service} showNavigation />
        <button
          type="button"
          onClick={openStartDialog}
          disabled={updateServiceStatusMutation.isPending}
          className="operator-service-action mt-4 min-h-12 w-full rounded-2xl bg-primary px-4 text-center text-sm font-bold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {updateServiceStatusMutation.isPending ? 'Iniciando...' : 'Iniciar Servicio'}
        </button>
        {startServiceDialog}
      </div>
    );
  }

  // FALLBACK
  return (
    <div className={baseCard}>
      <CardHeader service={service} />
      <CardBody service={service} />
    </div>
  );
};
