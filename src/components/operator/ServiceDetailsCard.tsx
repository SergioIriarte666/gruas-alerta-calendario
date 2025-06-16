
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/types';

interface ServiceDetailsCardProps {
  service: Service;
}

export const ServiceDetailsCard = ({ service }: ServiceDetailsCardProps) => {
  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Detalles del Servicio (Folio: {service.folio})</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
        <p><strong className="text-gray-400">Cliente:</strong> {service.client.name}</p>
        <p><strong className="text-gray-400">Tipo:</strong> {service.serviceType.name}</p>
        <p><strong className="text-gray-400">Origen:</strong> {service.origin}</p>
        <p><strong className="text-gray-400">Destino:</strong> {service.destination}</p>
      </CardContent>
    </Card>
  );
};
