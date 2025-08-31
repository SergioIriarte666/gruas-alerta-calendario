import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeferredBilling } from '@/hooks/useDeferredBilling';
import { Calendar, Clock, DollarSign, Users, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export const DeferredBillingDashboard: React.FC = () => {
  const { summary, readyServices, calendarEvents, loading, generateInvoicesForClient } = useDeferredBilling();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              Listos para Facturar
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {summary?.readyForBilling || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              En Período Diferido
            </CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {summary?.pendingDeferred || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              Monto Pendiente
            </CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summary?.totalPendingAmount || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              Clientes con Diferimiento
            </CardTitle>
            <Users className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {summary?.clientsWithDeferredBilling || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="ready">Listos para Facturar</TabsTrigger>
          <TabsTrigger value="calendar">Calendario de Facturación</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Servicios Listos para Facturar
              </CardTitle>
              <CardDescription className="text-white/70">
                Servicios que han cumplido su período de diferimiento y están listos para generar facturas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readyServices.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  No hay servicios listos para facturar en este momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {readyServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-white/5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{service.folio}</span>
                          <Badge variant="outline" className="text-xs">
                            {service.clientName}
                          </Badge>
                          {service.autoInvoiceGeneration && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Servicio: {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })} • 
                          Listo desde: {format(new Date(service.billingReadyDate), 'dd/MM/yyyy', { locale: es })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-primary">
                          {formatCurrency(service.value)}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => generateInvoicesForClient(service.clientId, [service.id])}
                        >
                          Facturar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Calendario de Facturación
              </CardTitle>
              <CardDescription className="text-white/70">
                Próximas fechas de facturación para clientes con período diferido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  No hay eventos de facturación programados.
                </div>
              ) : (
                <div className="space-y-4">
                  {calendarEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        event.isOverdue 
                          ? 'border-destructive/50 bg-destructive/10' 
                          : 'border-primary/20 bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{event.clientName}</span>
                          {event.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Vencido
                            </Badge>
                          )}
                          {event.autoGeneration && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          {event.serviceCount} servicio{event.serviceCount !== 1 ? 's' : ''} • 
                          Fecha de facturación: {format(new Date(event.billingDate), 'dd/MM/yyyy', { locale: es })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-primary">
                          {formatCurrency(event.totalAmount)}
                        </span>
                        {event.isOverdue && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => generateInvoicesForClient(event.clientId, [])}
                          >
                            Facturar Ahora
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Configuración de Facturación Diferida</CardTitle>
              <CardDescription className="text-white/70">
                Configurar clientes y parámetros de facturación diferida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-white/70">
                Panel de configuración - Próximamente
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};