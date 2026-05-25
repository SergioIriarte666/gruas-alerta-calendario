
import React from 'react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay, safeParseDateOnly } from '@/utils/timezoneUtils';
import { AlertTriangle, History, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { PortalServiceCard } from '@/components/portal/PortalServiceCard';
import { PortalServiceFilters } from '@/components/portal/PortalServiceFilters';
import { useClientServiceExport } from '@/hooks/portal/useClientServiceExport';
import { Download, FileSpreadsheet } from 'lucide-react';
import { getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';

const PortalServices = () => {
  const { data: services, isLoading, isError, error } = useClientServices();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  
  const filteredServices = useMemo(() => {
    if (!services) return [];
    return services.filter(service => {
      const serviceDate = safeParseDateOnly(service.service_date);
      if (dateFrom && serviceDate < dateFrom) return false;
      if (dateTo && serviceDate > dateTo) return false;
      return true;
    });
  }, [services, dateFrom, dateTo]);
  
  const { exportToPDF, exportToExcel, servicesCount, isLoadingServices } = useClientServiceExport(filteredServices, dateFrom, dateTo);

  const handleClearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

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

    if (!filteredServices || filteredServices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg">
          <History className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-white">Sin servicios en el rango seleccionado</h3>
          <p className="text-gray-400">
            {dateFrom || dateTo 
              ? 'No se encontraron servicios en el rango de fechas seleccionado.'
              : 'No hemos encontrado servicios asociados a su cuenta.'
            }
          </p>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <PortalServiceCard key={service.id} service={service} />
          ))}
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
              <TableHead className="text-gray-300">Tipo</TableHead>
              <TableHead className="text-gray-300">Ruta</TableHead>
              <TableHead className="text-gray-300">Patente Grúa</TableHead>
              <TableHead className="text-gray-300">Operador</TableHead>
              <TableHead className="text-gray-300 text-right">Valor</TableHead>
              <TableHead className="text-gray-300 text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.map((service) => (
              <TableRow key={service.id} className="border-gray-700 hover:bg-gray-800/50">
                <TableCell className="font-medium text-tms-green">{service.folio}</TableCell>
                <TableCell className="text-gray-300">
                  {formatForDisplay(service.service_date)}
                </TableCell>
                <TableCell className="text-gray-300">{service.service_type_name}</TableCell>
                <TableCell className="text-gray-300 max-w-xs truncate" title={`${service.origin} → ${service.destination}`}>
                  {service.origin} → {service.destination}
                </TableCell>
                <TableCell className="text-gray-300">{service.crane_license_plate}</TableCell>
                <TableCell className="text-gray-300">{service.operator_name}</TableCell>
                <TableCell className="text-gray-300 font-semibold text-right">{formatCurrency(service.value)}</TableCell>
                <TableCell className="text-center">{getServiceStatusBadge(service.status)}</TableCell>
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
        <div className="flex items-center gap-4">
          {filteredServices && (
            <Badge variant="outline" className="text-tms-green border-tms-green">
              {filteredServices.length} servicio{filteredServices.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isLoadingServices || !filteredServices || filteredServices.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={isLoadingServices || !filteredServices || filteredServices.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <PortalServiceFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearFilters={handleClearFilters}
      />
      
      {renderContent()}
    </div>
  );
};

export default PortalServices;
