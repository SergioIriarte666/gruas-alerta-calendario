
import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, History, RefreshCw, AlertTriangle } from 'lucide-react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
};

const PortalDashboard: React.FC = () => {
  const { data: services, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useClientServices();

  // Calcular métricas de servicios
  const totalServicios = services?.length || 0;
  const serviciosRecientes = services?.slice(0, 5) || [];

  const handleRetryServices = () => {
    console.log('Retrying services fetch...');
    refetchServices();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Mi Dashboard</h1>
      
      {/* Métricas principales - Solo servicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Servicios</CardTitle>
            <History className="size-4 text-tms-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {servicesLoading ? '...' : totalServicios}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Servicios recientes */}
        <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Servicios Recientes
              <div className="flex items-center gap-2">
                {servicesError && (
                  <Button
                    onClick={handleRetryServices}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Reintentar
                  </Button>
                )}
                <Link to="/portal/services" className="text-tms-green hover:text-tms-green-dark">
                  <span className="text-sm">Ver todos</span>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="text-gray-400">Cargando servicios...</div>
            ) : servicesError ? (
              <div className="text-center py-8">
                <AlertTriangle className="size-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-400 mb-2">Error al cargar servicios</p>
                <p className="text-gray-400 text-sm mb-4">
                  No se pudieron cargar tus servicios
                </p>
                <Button onClick={handleRetryServices} variant="outline" size="sm">
                  <RefreshCw className="size-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            ) : serviciosRecientes.length > 0 ? (
              <div className="space-y-3">
                {serviciosRecientes.map((service) => (
                  <div key={service.id} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{service.folio}</p>
                      <p className="text-sm text-gray-400">
                        {service.origin} → {service.destination}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(service.service_date), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-tms-green">{formatCurrency(service.value)}</p>
                      <Badge variant="outline" className="text-xs">
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <History className="size-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acción rápida */}
        <div className="space-y-6">
          <Link 
            to="/portal/request-service"
            className="block bg-tms-green/20 border border-tms-green text-white p-6 rounded-lg shadow-lg hover:bg-tms-green/30 transition-colors"
          >
            <div className="flex flex-col items-center justify-center text-center">
              <PlusCircle className="size-12 text-tms-green mb-4" />
              <h2 className="text-xl font-semibold text-white">Solicitar Nuevo Servicio</h2>
              <p className="text-gray-300 mt-2">Acceso rápido para crear una nueva solicitud de grúa.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
