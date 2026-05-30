import React from 'react';
import { Service } from '@/types';
import { Truck, Calendar, MapPin, User, ChevronRight, CheckCircle, Play, Package, Navigation, Car } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { getTodayLocal, safeDaysSince } from '@/utils/timezoneUtils';
import { openNavigation } from '@/utils/navigationUtils';
import { cn } from '@/lib/utils';

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
  if (status === 'completed')            return 'border-l-zinc-600';
  if (status === 'in_progress')          return 'border-l-blue-500';
  if (status === 'inspection_completed') return 'border-l-orange-500';
  const days = getImminenceDays(serviceDate);
  if (days <= 0) return 'border-l-red-500';
  if (days === 1) return 'border-l-violet-500';
  if (days <= 3) return 'border-l-amber-500';
  return 'border-l-zinc-600';
};

const UrgencyBadge = ({ serviceDate, status }: { serviceDate: string; status: Service['status'] }) => {
  if (status === 'completed' || status === 'in_progress' || status === 'inspection_completed') return null;
  const days = getImminenceDays(serviceDate);
  if (days < 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400">Vencido</span>;
  if (days === 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400">Hoy</span>;
  if (days === 1) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-950 text-violet-400">Mañana</span>;
  if (days <= 7)  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">en {days}d</span>;
  return null;
};

const StatusBadge = ({ status }: { status: Service['status'] }) => {
  const map: Record<string, { label: string; className: string }> = {
    pending:              { label: 'Pendiente',    className: 'bg-zinc-800 text-zinc-300' },
    in_progress:          { label: 'En curso',     className: 'bg-blue-950 text-blue-400' },
    inspection_completed: { label: 'Por entregar', className: 'bg-orange-950 text-orange-400' },
    completed:            { label: 'Completado',   className: 'bg-emerald-950 text-emerald-400' },
  };
  const chip = map[status];
  if (!chip) return null;
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', chip.className)}>{chip.label}</span>;
};

// ── contenido común ────────────────────────────────────────────────────────

const CardBody = ({ service, showNavigation = false }: { service: Service; showNavigation?: boolean }) => (
  <div className="space-y-2 mt-2">
    <div className="flex items-center gap-2 text-sm text-zinc-300">
      <Truck className="size-3.5 text-zinc-500 flex-shrink-0" />
      <span className="truncate">{service.serviceType?.name ?? 'Servicio no especificado'}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-zinc-300">
      <User className="size-3.5 text-zinc-500 flex-shrink-0" />
      <span className="truncate">{service.client?.name ?? 'Cliente no especificado'}</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <Calendar className="size-3.5 text-zinc-600 flex-shrink-0" />
      <span>{format(parseISO(service.serviceDate), "eee d 'de' MMM", { locale: es })}</span>
    </div>
    <div className="flex items-start gap-2">
      <MapPin className="size-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-zinc-500 flex-1 min-w-0">
        <p className="truncate"><span className="text-zinc-400">Origen:</span> {service.origin}</p>
        <p className="truncate"><span className="text-zinc-400">Destino:</span> {service.destination}</p>
      </div>
      {showNavigation && service.destination && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openNavigation(service.destination); }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-violet-950 text-violet-400 border border-violet-900 active:scale-95 transition-all flex-shrink-0"
        >
          <Navigation className="size-3" />
          Nav
        </button>
      )}
    </div>
    {(service.vehicleBrand || service.vehicleModel || service.licensePlate) && (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Car className="size-3.5 text-zinc-600 flex-shrink-0" />
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
      <span className="text-sm font-bold text-white">Folio {service.folio}</span>
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
  const baseCard = cn('bg-zinc-900 border border-white/5 border-l-2 rounded-2xl px-4 py-3', borderClass);

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
      <div className={baseCard}>
        <CardHeader service={service} rightSlot={<Play className="size-4 text-blue-400 flex-shrink-0" />} />
        <CardBody service={service} />
        <div className="mt-3 text-xs text-blue-400 font-medium flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
          Servicio en progreso
        </div>
      </div>
    );
  }

  // LISTO PARA ENTREGA
  if (status === 'inspection_completed' && showDeliveryAction) {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'active:scale-[0.99] transition-transform')}>
          <CardHeader service={service} rightSlot={<Package className="size-4 text-orange-400 flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
          <div className="mt-3 bg-orange-950/50 border border-orange-900/50 rounded-xl px-3 py-2 text-xs text-orange-400 font-medium text-center">
            Toca para completar la entrega
          </div>
        </div>
      </Link>
    );
  }

  // PENDIENTE
  if (status === 'pending') {
    return (
      <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <div className={cn(baseCard, 'active:scale-[0.99] transition-transform')}>
          <CardHeader service={service} rightSlot={<ChevronRight className="size-4 text-zinc-600 flex-shrink-0" />} />
          <CardBody service={service} showNavigation />
        </div>
      </Link>
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
