import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeferredBilling } from '@/hooks/useDeferredBilling';
import { Calendar, Clock, DollarSign, Users, FileText, AlertCircle, Receipt } from 'lucide-react';
import { ClientBillingSettings } from './ClientBillingSettings';
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
        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Listos para Facturar
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary?.readyForBilling || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Período Diferido
            </CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary?.pendingDeferred || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monto Pendiente
            </CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(summary?.totalPendingAmount || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes con Diferimiento
            </CardTitle>
            <Users className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary?.clientsWithDeferredBilling || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList className="bg-muted/50 rounded-md p-1">
          <TabsTrigger value="ready">Listos para Facturar</TabsTrigger>
          <TabsTrigger value="calendar">Calendario de Facturación</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-4">
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Servicios Listos para Facturar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Servicios que han cumplido su período de diferimiento y están listos para generar facturas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readyServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay servicios listos para facturar en este momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {readyServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{service.clientName}</span>
                          <Badge variant="outline" className="text-xs">
                            {service.serviceCount} servicios
                          </Badge>
                          {service.autoInvoiceGeneration && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Período: {new Date(service.serviceMonth).toLocaleDateString('es', { month: 'long', year: 'numeric' })} • 
                          Listo desde: {format(new Date(service.billingReadyDate), 'dd/MM/yyyy', { locale: es })}
                          {service.billingCycleDay && ` • Día ciclo: ${service.billingCycleDay}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-bold text-primary text-lg">
                            {formatCurrency(service.totalValue)}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {service.serviceCount} servicios
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => generateInvoicesForClient(service.clientId, [service.id])}
                        >
                          <Receipt className="w-4 h-4 mr-1" />
                          Facturar Período
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
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Calendario de Facturación
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Próximas fechas de facturación para clientes con período diferido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                          : 'border bg-muted/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{event.clientName}</span>
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
                        <div className="text-sm text-muted-foreground">
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
          <ClientBillingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};