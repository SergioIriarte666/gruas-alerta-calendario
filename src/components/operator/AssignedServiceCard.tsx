import React from 'react';
import { Service } from '@/types';
import { Truck, Calendar, User, ChevronRight, CheckCircle, Play, Package, Navigation, Car } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { getTodayLocal, safeDaysSince } from '@/utils/timezoneUtils';
import { openNavigation } from '@/utils/navigationUtils';
import { cn } from '@/lib/utils';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';

interface AssignedServiceCardProps {
  service: Service;
  showDeliveryAction?: boolean;
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
  };
  const chip = map[status];
  if (!chip) return null;
  return <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', chip.className)}>{chip.label}</span>;
};

// ── contenido común ────────────────────────────────────────────────────────

const CardBody = ({ service, showNavigation = false }: { service: Service; showNavigation?: boolean }) => (
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
      {showNavigation && service.destination && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openNavigation(service.destination); }}
          aria-label={`Abrir navegación a ${service.destination}`}
          className="operator-navigation-button absolute bottom-0 right-0 flex min-h-10 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-primary transition-all active:scale-95"
        >
          <Navigation className="size-3.5" />
          Ir
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

export const AssignedServiceCard = ({ service, showDeliveryAction = false }: AssignedServiceCardProps) => {
  const { status } = service;
  const borderClass = getUrgencyBorder(service.serviceDate, status);
  const baseCard = cn('operator-service-card rounded-3xl border border-l-2 border-border bg-card p-5', borderClass);

  const navigate = useNavigate();
  const { updateServiceStatusMutation } = useServiceStatusUpdate(service.id);

  const handleStartService = async () => {
    try {
      await updateServiceStatusMutation.mutateAsync({ id: service.id, targetStatus: 'in_progress' });
      navigate(`/operator/service/${service.id}/inspection`);
    } catch {
      // el hook ya muestra el toast de error, no hay nada mas que hacer aqui
    }
  };

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

  // PENDIENTE
  if (status === 'pending') {
    return (
      <div className={baseCard}>
        <CardHeader service={service} rightSlot={<ChevronRight className="size-4 flex-shrink-0 text-muted-foreground" />} />
        <CardBody service={service} showNavigation />
        <button
          type="button"
          onClick={handleStartService}
          disabled={updateServiceStatusMutation.isPending}
          className="operator-service-action mt-4 min-h-12 w-full rounded-2xl bg-primary px-4 text-center text-sm font-bold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {updateServiceStatusMutation.isPending ? 'Iniciando...' : 'Iniciar Servicio'}
        </button>
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
