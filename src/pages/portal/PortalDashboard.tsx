
import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, FileText, History, TrendingUp, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { useClientInvoices } from '@/hooks/portal/useClientInvoices';
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
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError, refetch: refetchInvoices } = useClientInvoices();

  // Calcular métricas
  const totalServicios = services?.length || 0;
  const serviciosRecientes = services?.slice(0, 5) || [];
  const totalFacturas = invoices?.length || 0;
  const facturasPendientes = invoices?.filter(inv => inv.status === 'sent') || [];
  const facturasVencidas = invoices?.filter(inv => inv.status === 'overdue') || [];
  const totalPendiente = facturasPendientes.reduce((sum, inv) => sum + inv.total, 0);

  const handleRetryServices = () => {
    console.log('Retrying services fetch...');
    refetchServices();
  };

  const handleRetryInvoices = () => {
    console.log('Retrying invoices fetch...');
    refetchInvoices();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Mi Dashboard</h1>
      
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Servicios</CardTitle>
            <History className="h-4 w-4 text-tms-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {servicesLoading ? '...' : totalServicios}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Facturas Totales</CardTitle>
            <FileText className="h-4 w-4 text-tms-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {invoicesLoading ? '...' : totalFacturas}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pendiente de Pago</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {invoicesLoading ? '...' : formatCurrency(totalPendiente)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {facturasPendientes.length} factura{facturasPendientes.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Facturas Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {invoicesLoading ? '...' : facturasVencidas.length}
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
                    <RefreshCw className="w-3 h-3 mr-1" />
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
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-400 mb-2">Error al cargar servicios</p>
                <p className="text-gray-400 text-sm mb-4">
                  No se pudieron cargar tus servicios
                </p>
                <Button onClick={handleRetryServices} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
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
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones y facturas pendientes */}
        <div className="space-y-6">
          {/* Acción rápida */}
          <Link 
            to="/portal/request-service"
            className="block bg-tms-green/20 border border-tms-green text-white p-6 rounded-lg shadow-lg hover:bg-tms-green/30 transition-colors"
          >
            <div className="flex flex-col items-center justify-center text-center">
              <PlusCircle className="w-12 h-12 text-tms-green mb-4" />
              <h2 className="text-xl font-semibold text-white">Solicitar Nuevo Servicio</h2>
              <p className="text-gray-300 mt-2">Acceso rápido para crear una nueva solicitud de grúa.</p>
            </div>
          </Link>

          {/* Facturas pendientes */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                Facturas por Pagar
                <div className="flex items-center gap-2">
                  {invoicesError && (
                    <Button
                      onClick={handleRetryInvoices}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reintentar
                    </Button>
                  )}
                  <Link to="/portal/invoices" className="text-tms-green hover:text-tms-green-dark">
                    <span className="text-sm">Ver todas</span>
                  </Link>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-gray-400">Cargando facturas...</div>
              ) : invoicesError ? (
                <div className="text-center py-4">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-red-400 text-sm mb-2">Error al cargar facturas</p>
                  <Button onClick={handleRetryInvoices} variant="outline" size="sm">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reintentar
                  </Button>
                </div>
              ) : facturasPendientes.length > 0 ? (
                <div className="space-y-3">
                  {facturasPendientes.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-white">{invoice.folio}</p>
                          <p className="text-xs text-gray-400">
                            Vence: {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <p className="font-bold text-yellow-500">{formatCurrency(invoice.total)}</p>
                      </div>
                    </div>
                  ))}
                  {facturasPendientes.length > 3 && (
                    <p className="text-sm text-gray-400 text-center">
                      +{facturasPendientes.length - 3} más
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay facturas por pagar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
