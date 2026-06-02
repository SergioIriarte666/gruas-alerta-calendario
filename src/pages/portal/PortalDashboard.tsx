
import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, History, RefreshCw, AlertTriangle, Calendar, Clock, FileText } from 'lucide-react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { useClientInvoices } from '@/hooks/portal/useClientInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/utils/statusHelpers';
import { getBusinessToday, safeDaysSince, safeParseDateOnly } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PortalDashboard");

const calculateDaysUntilDue = (dueDate: string | null, status: string): JSX.Element => {
  if (status === 'paid') {
    return <Badge className="bg-green-500 text-white">Pagada</Badge>;
  }

  if (!dueDate) {
    return <Badge className="bg-gray-500 text-white">Sin fecha</Badge>;
  }

  try {
    const todayStr = getBusinessToday();
    const dueStr = dueDate.slice(0, 10);
    const days = -safeDaysSince(dueStr, todayStr);

    if (days > 7) {
      return <Badge className="bg-green-500 text-white">+{days} dias</Badge>;
    }

    if (days >= 1) {
      return <Badge className="bg-yellow-500 text-white">+{days} dias</Badge>;
    }

    if (days === 0) {
      return <Badge className="bg-orange-500 text-white">Hoy</Badge>;
    }

    return <Badge className="bg-red-500 text-white">{days} dias</Badge>;
  } catch (error) {
    logger.error('Error calculating days until due:', error);
    return <Badge className="bg-gray-500 text-white">Error</Badge>;
  }
};

const PortalDashboard: React.FC = () => {
  const { data: services, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useClientServices();
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useClientInvoices();

  const totalServicios = services?.length || 0;
  const serviciosEsteMes = services?.filter((service) => {
    const fecha = safeParseDateOnly(service.service_date);
    const hoy = new Date();
    return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
  }).length || 0;
  const facturasPendientes = invoices
    ?.filter((invoice) => invoice.status === 'sent')
    .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const facturasVencidas = invoices
    ?.filter((invoice) => invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const serviciosRecientes = services?.slice(0, 5) || [];
  const facturasRecientes = invoices
    ?.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
    .slice(0, 3) || [];

  const handleRetryServices = () => {
    logger.debug('Retrying services fetch...');
    refetchServices();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Mi Dashboard</h1>
      
      {/* Metricas principales */}
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Servicios este mes</CardTitle>
            <Calendar className="size-4 text-tms-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {servicesLoading ? '...' : serviciosEsteMes}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Facturas pendientes</CardTitle>
            <Clock className="size-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {invoicesLoading ? '...' : formatCurrency(facturasPendientes)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Facturas vencidas</CardTitle>
            <AlertTriangle className="size-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {invoicesLoading ? '...' : formatCurrency(facturasVencidas)}
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
                        {format(safeParseDateOnly(service.service_date), 'dd/MM/yyyy', { locale: es })}
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

        {/* Facturas recientes y accion rapida */}
        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                Facturas Recientes
                <Link to="/portal/invoices" className="text-tms-green hover:text-tms-green-dark">
                  <span className="text-sm">Ver todas</span>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-gray-400">Cargando facturas...</div>
              ) : invoicesError ? (
                <div className="text-center py-6">
                  <AlertTriangle className="size-10 mx-auto mb-3 text-red-500" />
                  <p className="text-red-400 text-sm">No se pudieron cargar las facturas</p>
                </div>
              ) : facturasRecientes.length > 0 ? (
                <div className="space-y-3">
                  {facturasRecientes.map((invoice) => (
                    <div key={invoice.id} className="rounded-lg bg-gray-700 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{invoice.folio}</p>
                          <p className="text-xs text-gray-400">
                            Emision {format(safeParseDateOnly(invoice.issue_date), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <p className={`font-bold ${invoice.status === 'overdue' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {formatCurrency(invoice.total)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge className={invoice.status === 'overdue' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}>
                          {invoice.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                        </Badge>
                        {calculateDaysUntilDue(invoice.due_date, invoice.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <FileText className="size-10 mx-auto mb-3 opacity-50" />
                  <p>No hay facturas pendientes o vencidas</p>
                </div>
              )}
            </CardContent>
          </Card>

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
