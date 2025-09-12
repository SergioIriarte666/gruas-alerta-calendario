import { Client } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClientServiceHistory } from './ClientServiceHistory';
import { ClientInvoicing } from './ClientInvoicing';
import { ClientClosureHistory } from './ClientClosureHistory';
import { ClientRequestHistory } from './ClientRequestHistory';
import { ClientMetricsOverview } from './ClientMetricsOverview';
import { useClientServices } from '@/hooks/useClientServices';
import { useClientInvoices } from '@/hooks/useClientInvoices';
import { useClientClosures } from '@/hooks/useClientClosures';
import { useClientRequests } from '@/hooks/useClientRequests';

interface ClientTabsWithCountersProps {
  client: Client;
}

export const ClientTabsWithCounters = ({ client }: ClientTabsWithCountersProps) => {
  const { services, loading: servicesLoading } = useClientServices(client.id);
  const { invoices, loading: invoicesLoading } = useClientInvoices(client.id);
  const { closures, loading: closuresLoading } = useClientClosures(client.id);
  const { requests, loading: requestsLoading } = useClientRequests(client.id);

  const getTabLabel = (baseLabel: string, count: number, loading: boolean) => {
    if (loading) return `${baseLabel} (...)`;
    return count > 0 ? `${baseLabel} (${count})` : baseLabel;
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList className="flex-shrink-0 grid w-full grid-cols-6 bg-white/5 border border-tms-green/30">
          <TabsTrigger 
            value="overview" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            Resumen
          </TabsTrigger>
          <TabsTrigger 
            value="info" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            Información
          </TabsTrigger>
          <TabsTrigger 
            value="services" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            {getTabLabel('Servicios', services.length, servicesLoading)}
          </TabsTrigger>
          <TabsTrigger 
            value="invoices" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            {getTabLabel('Facturas', invoices.length, invoicesLoading)}
          </TabsTrigger>
          <TabsTrigger 
            value="closures" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            {getTabLabel('Cierres', closures.length, closuresLoading)}
          </TabsTrigger>
          <TabsTrigger 
            value="requests" 
            className="text-white data-[state=active]:bg-tms-green data-[state=active]:text-black text-xs"
          >
            {getTabLabel('Solicitudes', requests.length, requestsLoading)}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-6 space-y-6">
              <TabsContent value="overview" className="m-0">
                <ClientMetricsOverview client={client} />
              </TabsContent>

              <TabsContent value="info" className="m-0">
                <Card className="bg-white/5 border-tms-green/30">
                  <CardHeader>
                    <CardTitle className="text-white">Información General</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Nombre/Razón Social
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.name}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            RUT
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.rut}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Email
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.email || 'No especificado'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Departamento
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.department}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Teléfono
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.phone || 'No especificado'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Dirección
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.address || 'No especificada'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Estado
                          </label>
                          <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                            client.isActive 
                              ? 'bg-tms-green/20 text-tms-green border border-tms-green/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {client.isActive ? 'Activo' : 'Inactivo'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Fecha de Registro
                          </label>
                          <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                            {client.createdAt ? new Date(client.createdAt).toLocaleDateString('es-CL') : 'No disponible'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="m-0">
                <ClientServiceHistory client={client} />
              </TabsContent>

              <TabsContent value="invoices" className="m-0">
                <ClientInvoicing client={client} />
              </TabsContent>

              <TabsContent value="closures" className="m-0">
                <ClientClosureHistory client={client} />
              </TabsContent>

              <TabsContent value="requests" className="m-0">
                <ClientRequestHistory client={client} />
              </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
};