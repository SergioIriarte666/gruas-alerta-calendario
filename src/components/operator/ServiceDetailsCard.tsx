
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';

interface ServiceDetailsCardProps {
  service: Service;
}

export const ServiceDetailsCard = ({ service }: ServiceDetailsCardProps) => {
  return (
    <Card className="bg-card border-border text-foreground">
      <CardHeader>
        <CardTitle className="text-xl">Detalles del Servicio (Folio: {service.folio})</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
        <p><strong className="text-muted-foreground">Cliente:</strong> {service.client.name}</p>
        <p><strong className="text-muted-foreground">Tipo:</strong> {service.serviceType.name}</p>
        <p><strong className="text-muted-foreground">Origen:</strong> {service.origin}</p>
        <p><strong className="text-muted-foreground">Destino:</strong> {service.destination}</p>
      </CardContent>
    </Card>
  );
};
