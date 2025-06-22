import React from 'react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, History } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
};

const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; className: string } } = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500' },
      completed: { label: 'Completado', className: 'bg-green-500' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500' },
      invoiced: { label: 'Facturado', className: 'bg-purple-500' },
    };
  
    const config = statusConfig[status] || { label: status, className: 'bg-gray-500' };
  
    return <Badge className={`${config.className} text-white`}>{config.label}</Badge>;
};

const PortalServices = () => {
  const { data: services, isLoading, isError, error } = useClientServices();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-gray-700" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-900/20 rounded-lg">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-white">Error al cargar servicios</h3>
          <p className="text-red-400">{error?.message || 'Ocurrió un error inesperado.'}</p>
        </div>
      );
    }

    if (!services || services.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg">
          <History className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-white">Sin historial de servicios</h3>
          <p className="text-gray-400">No hemos encontrado servicios asociados a su cuenta.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Folio</TableHead>
              <TableHead className="text-gray-300">Fecha</TableHead>
              <TableHead className="text-gray-300">Ruta</TableHead>
              <TableHead className="text-gray-300">Patente Grúa</TableHead>
              <TableHead className="text-gray-300">Operador</TableHead>
              <TableHead className="text-gray-300 text-right">Valor</TableHead>
              <TableHead className="text-gray-300 text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id} className="border-gray-700 hover:bg-gray-800/50">
                <TableCell className="font-medium text-tms-green">{service.folio}</TableCell>
                <TableCell className="text-gray-300">
                  {format(new Date(service.service_date), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell className="text-gray-300 max-w-xs truncate" title={`${service.origin} → ${service.destination}`}>
                  {service.origin} → {service.destination}
                </TableCell>
                <TableCell className="text-gray-300">{service.crane_license_plate}</TableCell>
                <TableCell className="text-gray-300">{service.operator_name}</TableCell>
                <TableCell className="text-gray-300 font-semibold text-right">{formatCurrency(service.value)}</TableCell>
                <TableCell className="text-center">{getStatusBadge(service.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Mis Servicios</h1>
        {services && (
            <Badge variant="outline" className="text-tms-green border-tms-green">
                {services.length} servicio{services.length !== 1 ? 's' : ''}
            </Badge>
        )}
      </div>
      {renderContent()}
    </div>
  );
};

export default PortalServices;

