import React from 'react';
import { Service } from '@/types';
import { Truck, Calendar, MapPin, User, ChevronRight, CheckCircle, Play, Package, Navigation, Car } from 'lucide-react';
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
  if (status === 'in_progress')          return 'border-l-blue-500';
  if (status === 'inspection_completed') return 'border-l-orange-500';
  const days = getImminenceDays(serviceDate);
  if (days <= 0) return 'border-l-red-500';
  if (days === 1) return 'border-l-primary';
  if (days <= 3) return 'border-l-amber-500';
  return 'border-l-muted-foreground/40';
};

const UrgencyBadge = ({ serviceDate, status }: { serviceDate: string; status: Service['status'] }) => {
  if (status === 'completed' || status === 'in_progress' || status === 'inspection_completed') return null;
  const days = getImminenceDays(serviceDate);
  if (days < 0) return <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-400">Vencido</span>;
  if (days === 0) return <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-400">Hoy</span>;
  if (days === 1) return <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Mañana</span>;
  if (days <= 7)  return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">en {days}d</span>;
  return null;
};

const StatusBadge = ({ status }: { status: Service['status'] }) => {
  const map: Record<string, { label: string; className: string }> = {
    pending:              { label: 'Pendiente',    className: 'bg-muted text-muted-foreground' },
    in_progress:          { label: 'En curso',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    inspection_completed: { label: 'Por entregar', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
    completed:            { label: 'Completado',   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  };
  const chip = map[status];
  if (!chip) return null;
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', chip.className)}>{chip.label}</span>;
};

// ── contenido común ────────────────────────────────────────────────────────

const CardBody = ({ service, showNavigation = false }: { service: Service; showNavigation?: boolean }) => (
  <div className="space-y-2 mt-2">
    <div className="flex items-center gap-2 text-sm text-foreground">
      <Truck className="size-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="truncate">{service.serviceType?.name ?? 'Servicio no especificado'}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-foreground">
      <User className="size-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="truncate">{service.client?.name ?? 'Cliente no especificado'}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Calendar className="size-3.5 flex-shrink-0 text-muted-foreground" />
      <span>{format(parseISO(service.serviceDate), "eee d 'de' MMM", { locale: es })}</span>
    </div>
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        <p className="truncate"><span className="text-foreground/80">Origen:</span> {service.origin}</p>
        <p className="truncate"><span className="text-foreground/80">Destino:</span> {service.destination}</p>
      </div>
      {showNavigation && service.destination && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openNavigation(service.destination); }}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-all active:scale-95"
        >
          <Navigation className="size-3" />
          Nav
        </button>
      )}
    </div>
    {(service.vehicleBrand || service.vehicleModel || service.licensePlate) && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Car className="size-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">
          {[service.vehicleBrand, service.vehicleModel].filter(Boolean).join(' ')}
          {service.licensePlate && ` · ${service.licensePlate.toUpperCase()}`}
        </span>
      </div>
    )}
  </div>
);

const CardHeader = ({ service, rightSlot }: { service: Service; rightSlot?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-bold text-foreground">Folio {service.folio}</span>
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
  const baseCard = cn('rounded-2xl border border-l-2 border-border bg-card px-4 py-3 shadow-sm', borderClass);

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
      <div className={cn(baseCard, 'opacity-60')}>
        <CardHeader service={service} rightSlot={<CheckCircle className="size-4 text-emerald-500 flex-shrink-0" />} />
        <CardBody service={service} />
      </div>
    );
  }

  // EN PROGRESO
  if (status === 'in_progress') {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'active:scale-[0.99] transition-transform')}>
          <CardHeader service={service} rightSlot={<Play className="size-4 text-blue-400 flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400">
            Toca para continuar con la inspección inicial
          </div>
        </div>
      </Link>
    );
  }

  // LISTO PARA ENTREGA
  if (status === 'inspection_completed' && showDeliveryAction) {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'active:scale-[0.99] transition-transform')}>
          <CardHeader service={service} rightSlot={<Package className="size-4 text-orange-400 flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-center text-xs font-medium text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-400">
            Toca para completar la entrega
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
          className="mt-3 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 transition-transform active:scale-[0.99] disabled:opacity-60 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400"
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
