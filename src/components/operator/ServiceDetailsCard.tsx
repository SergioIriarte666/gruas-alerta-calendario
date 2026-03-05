
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';
import { toTitleCase } from '@/lib/utils';

interface ServiceDetailsCardProps {
  service: Service;
}

export const ServiceDetailsCard = ({ service }: ServiceDetailsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles del Servicio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p><strong className="text-muted-foreground">Folio:</strong> {service.folio}</p>
        <p><strong className="text-muted-foreground">Cliente:</strong> {toTitleCase(service.client.name)}</p>
        <p><strong className="text-muted-foreground">Tipo:</strong> {service.serviceType.name}</p>
        <p><strong className="text-muted-foreground">Origen:</strong> {service.origin}</p>
        <p><strong className="text-muted-foreground">Destino:</strong> {service.destination}</p>
      </CardContent>
    </Card>
  );
};
