import { Service } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, MapPin, Truck, Clock } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTodayLocal, safeDaysSince } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';

interface NextServiceCardProps {
  service: Service;
}

const getCountdown = (serviceDate: string, startTime?: string): { label: string; urgent: boolean } => {
  const todayStr = getTodayLocal();
  const days = -safeDaysSince(serviceDate, todayStr);

  if (days < 0) return { label: 'Fecha pasada', urgent: false };
  if (days === 0) {
    if (startTime) {
      const [h, m] = startTime.split(':').map(Number);
      const now = businessClock.todayDate();
      const serviceTime = businessClock.now();
      serviceTime.setHours(h, m, 0, 0);
      const diffMins = differenceInMinutes(serviceTime, now);
      if (diffMins <= 0) return { label: 'En curso', urgent: false };
      if (diffMins < 60) return { label: `En ${diffMins} min`, urgent: true };
      const diffHrs = Math.floor(diffMins / 60);
      return { label: `Hoy en ${diffHrs}h`, urgent: diffHrs < 3 };
    }
    return { label: 'Hoy', urgent: true };
  }
  if (days === 1) return { label: 'Mañana', urgent: false };
  return { label: `En ${days} días`, urgent: false };
};

export const NextServiceCard = ({ service }: NextServiceCardProps) => {
  const { label, urgent } = getCountdown(service.serviceDate, service.startTime);

  return (
    <Card className={cn(
      'border transition-colors',
      urgent
        ? 'border-primary/35 bg-primary/10'
        : 'bg-card border-border'
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className={cn('size-4', urgent ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-medium text-foreground">Próximo servicio</span>
          </div>
          <span className={cn(
            'text-xs font-bold px-2.5 py-1 rounded-full',
            urgent
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}>
            {label}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Truck className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground font-medium truncate">{service.serviceType?.name ?? 'Servicio'}</span>
            <span className="text-muted-foreground shrink-0">· Folio {service.folio}</span>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground truncate">
              <span className="font-medium text-foreground">Destino:</span> {service.destination}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {format(parseISO(service.serviceDate), "EEEE d 'de' MMMM", { locale: es })}
              {service.startTime && ` · ${service.startTime.slice(0, 5)}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
