import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  FileWarning as FileAlert,
  History,
  PlusCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { useClientInvoices } from '@/hooks/portal/useClientInvoices';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, getServiceStatusBadge } from '@/utils/statusHelpers';
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
  const { user } = useUser();
  const { data: services, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useClientServices();
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useClientInvoices();

  const totalServicios = services?.length || 0;
  const serviciosSinOC = services?.filter((service) => service.needs_purchase_order).length || 0;
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
  const firstName = user?.name?.split(' ')[0] || 'Cliente';

  const handleRetryServices = () => {
    logger.debug('Retrying services fetch...');
    refetchServices();
  };

  const metricCards = [
    {
      label: 'Total servicios',
      value: servicesLoading ? '...' : totalServicios,
      accent: '#7c3aed',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      valueColor: 'text-[#0f172a]',
      delta: totalServicios > 0 ? `+${Math.min(totalServicios, 3)} este mes` : 'Sin movimientos',
      deltaColor: totalServicios > 0 ? 'text-green-600' : 'text-[#94a3b8]',
      icon: History,
    },
    {
      label: 'Sin orden de compra',
      value: servicesLoading ? '...' : serviciosSinOC,
      accent: '#f59e0b',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valueColor: serviciosSinOC > 0 ? 'text-amber-600' : 'text-[#64748b]',
      delta: serviciosSinOC > 0 ? 'Requieren OC' : 'Al dia',
      deltaColor: serviciosSinOC > 0 ? 'text-amber-600' : 'text-green-600',
      icon: FileAlert,
    },
    {
      label: 'Facturas pendientes',
      value: invoicesLoading ? '...' : formatCurrency(facturasPendientes),
      accent: '#f59e0b',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-600',
      delta: facturasPendientes > 0 ? 'Por regularizar' : 'Al dia',
      deltaColor: facturasPendientes > 0 ? 'text-amber-600' : 'text-green-600',
      icon: Clock,
    },
    {
      label: 'Facturas vencidas',
      value: invoicesLoading ? '...' : formatCurrency(facturasVencidas),
      accent: '#ef4444',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      valueColor: 'text-red-500',
      delta: facturasVencidas > 0 ? 'Requieren atencion' : 'Sin atraso',
      deltaColor: facturasVencidas > 0 ? 'text-red-500' : 'text-green-600',
      icon: AlertTriangle,
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[17px] font-medium text-[#0f172a]">Buenos dias, {firstName}</h1>
        <p className="mb-5 text-[11px] text-[#94a3b8]">Resumen de tu cuenta actualizado</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="relative overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white p-3">
              <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ backgroundColor: metric.accent }} />
              <div className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-[6px] ${metric.iconBg}`}>
                <Icon className={`size-[13px] ${metric.iconColor}`} />
              </div>
              <p className={`mb-1 text-[18px] font-medium leading-none ${metric.valueColor}`}>{metric.value}</p>
              <p className="mb-1 text-[10px] text-[#94a3b8]">{metric.label}</p>
              <p className={`flex items-center gap-1 text-[9px] ${metric.deltaColor}`}>
                <TrendingUp className="size-[9px]" />
                {metric.delta}
              </p>
            </div>
          );
        })}
      </div>

      {serviciosSinOC > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <FileAlert className="size-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              {serviciosSinOC} servicio{serviciosSinOC !== 1 ? 's' : ''} esperando orden de compra
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Envia tu OC para que podamos emitir la factura correspondiente
            </p>
            <div className="mt-3 space-y-2">
              {services?.filter((service) => service.needs_purchase_order).slice(0, 2).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border border-amber-100 bg-white px-3 py-2"
                >
                  <div>
                    <span className="text-xs font-medium text-amber-800">{service.folio}</span>
                    <span className="ml-2 text-xs text-amber-600">
                      {service.origin} → {service.destination}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-900">{formatCurrency(service.value)}</span>
                    <Link to="/portal/purchase-orders">
                      <button type="button" className="rounded-md bg-amber-500 px-2 py-1 text-xs text-white">
                        Enviar OC
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
              {serviciosSinOC > 2 && (
                <Link to="/portal/purchase-orders" className="text-xs text-amber-700 underline">
                  Ver los {serviciosSinOC - 2} restantes →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border border-[#e2e8f0] bg-white shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-[#0f172a]">
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
                <Link to="/portal/services" className="text-sm text-violet-600 hover:text-violet-700">
                  <span className="text-sm">Ver todos</span>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="text-[#94a3b8]">Cargando servicios...</div>
            ) : servicesError ? (
              <div className="text-center py-8">
                <AlertTriangle className="size-12 mx-auto mb-4 text-red-500" />
                <p className="mb-2 text-red-500">Error al cargar servicios</p>
                <p className="mb-4 text-sm text-[#94a3b8]">
                  No se pudieron cargar tus servicios
                </p>
                <Button onClick={handleRetryServices} variant="outline" size="sm">
                  <RefreshCw className="size-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            ) : serviciosRecientes.length > 0 ? (
              <div className="space-y-1.5">
                {serviciosRecientes.map((service) => (
                  <div
                    key={service.id}
                    className={`flex items-center justify-between rounded-[6px] border px-2.5 py-[7px] ${
                      service.status === 'in_progress'
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-[#f1f5f9] bg-[#f8fafc]'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-medium text-violet-700">{service.folio}</p>
                      <p className="text-[10px] text-[#94a3b8]">
                        {service.origin} → {service.destination}
                      </p>
                      <p className="text-[10px] text-[#cbd5e1]">
                        {format(safeParseDateOnly(service.service_date), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium text-[#0f172a]">{formatCurrency(service.value)}</p>
                      {service.is_portal_request ? (
                        <div className="mt-1 flex justify-end gap-2">
                          {getServiceStatusBadge(service.status)}
                          <Badge className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                            Solicitud pendiente de asignacion
                          </Badge>
                        </div>
                      ) : (
                        getServiceStatusBadge(service.status)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#94a3b8]">
                <History className="mx-auto mb-4 size-12 opacity-50" />
                <p>No hay servicios registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-[#e2e8f0] bg-white shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-[#0f172a]">
                Facturas Recientes
                <Link to="/portal/invoices" className="text-sm text-violet-600 hover:text-violet-700">
                  <span className="text-sm">Ver todas</span>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-[#94a3b8]">Cargando facturas...</div>
              ) : invoicesError ? (
                <div className="text-center py-6">
                  <AlertTriangle className="size-10 mx-auto mb-3 text-red-500" />
                  <p className="text-sm text-red-500">No se pudieron cargar las facturas</p>
                </div>
              ) : facturasRecientes.length > 0 ? (
                <div className="space-y-3">
                  {facturasRecientes.map((invoice) => (
                    <div key={invoice.id} className="rounded-[8px] border border-[#f1f5f9] bg-[#f8fafc] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#0f172a]">{invoice.folio}</p>
                          <p className="text-xs text-[#94a3b8]">
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
                <div className="py-6 text-center text-[#94a3b8]">
                  <FileText className="mx-auto mb-3 size-10 opacity-50" />
                  <p>No hay facturas pendientes o vencidas</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Link
            to="/portal/request-service"
            className="flex items-center gap-3 rounded-[9px] bg-gradient-to-br from-violet-700 to-indigo-600 p-3.5"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[7px] bg-white/15">
              <PlusCircle className="size-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-white">Solicitar nuevo servicio</p>
              <p className="text-[10px] text-white/70">Disponible las 24 horas</p>
            </div>
            <ArrowRight className="size-[15px] text-white/75" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
