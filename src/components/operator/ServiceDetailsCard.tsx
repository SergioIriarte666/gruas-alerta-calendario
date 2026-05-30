import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';
import { toTitleCase } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
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
    ? format(parseISO(service.serviceDate), "EEEE d 'de' MMMM yyyy", { locale: es })
    : '';
  const datetimeLabel = dateLabel && service.startTime
    ? `${dateLabel} · ${service.startTime.slice(0, 5)}`
    : dateLabel;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" />
          Folio {service.folio}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Row icon={Truck}        label="Tipo de servicio"    value={service.serviceType.name} />
        <Row icon={User}         label="Cliente"              value={toTitleCase(service.client.name)} />
        <Row icon={CalendarClock} label="Fecha y hora"        value={datetimeLabel} />
        <Row icon={MapPin}       label="Origen"               value={service.origin} />
        <Row icon={MapPin}       label="Destino"              value={service.destination} />

        {vehicleLabel && (
          <Row icon={Car} label="Vehículo" value={vehicleLabel} />
        )}
        {service.licensePlate && (
          <Row icon={Car} label="Patente" value={service.licensePlate.toUpperCase()} />
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
