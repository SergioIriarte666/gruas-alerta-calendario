import { businessClock } from '@/utils/businessClock';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Car, MapPin, User, Phone, CalendarClock, FileText, Truck } from 'lucide-react';

interface ServiceDetailsCardProps {
  service: Service;
}

const Row = ({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) => {
  if (!value?.trim()) return null;
  return (
    <div className="operator-service-detail-row flex items-start gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="operator-native-eyebrow mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            className="text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground break-words">{value}</p>
        )}
      </div>
    </div>
  );
};

export const ServiceDetailsCard = ({ service }: ServiceDetailsCardProps) => {
  const vehicleLabel = [service.vehicleBrand, service.vehicleModel]
    .filter(Boolean)
    .join(' ');

  const dateLabel = service.serviceDate
    ? businessClock.format(service.serviceDate, "EEEE d 'de' MMMM yyyy", { locale: es })
    : '';
  const datetimeLabel = dateLabel && service.startTime
    ? `${dateLabel} · ${service.startTime.slice(0, 5)}`
    : dateLabel;

  return (
    <Card className="operator-inspection-card overflow-hidden rounded-3xl">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="operator-native-eyebrow">Orden de trabajo</p>
              <p className="operator-native-display truncate text-2xl font-bold text-foreground">{service.folio}</p>
            </div>
          </div>
          {service.licensePlate && (
            <span className="operator-license-plate rounded-lg bg-muted px-3 py-2 text-xs font-bold tracking-wider text-foreground">
              {service.licensePlate.toUpperCase()}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-4 pt-3 sm:grid-cols-2">
        <Row icon={Truck}        label="Tipo de servicio"    value={service.serviceType.name} />
        <Row icon={User}         label="Cliente"              value={toTitleCase(service.client.name)} />
        <Row icon={CalendarClock} label="Fecha y hora"        value={datetimeLabel} />
        <Row icon={MapPin}       label="Origen"               value={service.origin} />
        <Row icon={MapPin}       label="Destino"              value={service.destination} />

        {vehicleLabel && (
          <Row icon={Car} label="Vehículo" value={vehicleLabel} />
        )}
        {service.contactPerson && (
          <Row icon={User} label="Persona en el lugar" value={service.contactPerson} />
        )}
        {service.contactPhone && (
          <Row
            icon={Phone}
            label="Teléfono de contacto"
            value={service.contactPhone}
            href={`tel:${service.contactPhone}`}
          />
        )}
        {service.observations && (
          <Row icon={FileText} label="Observaciones" value={service.observations} />
        )}
      </CardContent>
    </Card>
  );
};
