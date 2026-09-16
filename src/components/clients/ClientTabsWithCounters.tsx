import { businessClock } from '@/utils/businessClock';
import { Client } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientServiceHistory } from './ClientServiceHistory';
import { ClientInvoicing } from './ClientInvoicing';
import { ClientClosureHistory } from './ClientClosureHistory';
import { ClientRequestHistory } from './ClientRequestHistory';
import { ClientMetricsOverview } from './ClientMetricsOverview';
import { useClientServices } from '@/hooks/useClientServices';
import { useClientInvoices } from '@/hooks/useClientInvoices';
import { useClientClosures } from '@/hooks/useClientClosures';
import { useClientRequests } from '@/hooks/useClientRequests';
import { useClientBillingContacts } from '@/hooks/useClientBillingContacts';
import { toTitleCase } from '@/lib/utils';
import { ClientLogoUpload } from './ClientLogoUpload';
import { ClientBillingContacts } from './ClientBillingContacts';

interface ClientTabsWithCountersProps {
  client: Client;
  logoUrl?: string | null;
  onLogoChange?: (url: string | null) => void;
}

export const ClientTabsWithCounters = ({ client, logoUrl, onLogoChange }: ClientTabsWithCountersProps) => {
  const { services, loading: servicesLoading } = useClientServices(client.id);
  const { invoices, loading: invoicesLoading } = useClientInvoices(client.id);
  const { closures, loading: closuresLoading } = useClientClosures(client.id);
  const { requests, loading: requestsLoading } = useClientRequests(client.id);
  const { contacts, isLoading: contactsLoading } = useClientBillingContacts(client.id);
  const activeContactsCount = contacts.filter(c => c.is_active).length;

  const getTabLabel = (baseLabel: string, count: number, loading: boolean) => {
    if (loading) return `${baseLabel} (...)`;
    return count > 0 ? `${baseLabel} (${count})` : baseLabel;
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <div className="flex-shrink-0 overflow-x-auto">
          <TabsList className="operations-tabs inline-flex h-auto w-auto min-w-full p-1 sm:grid sm:grid-cols-7">
            <TabsTrigger 
              value="overview" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              Resumen
            </TabsTrigger>
            <TabsTrigger 
              value="info" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              Info
            </TabsTrigger>
            <TabsTrigger 
              value="services" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              {getTabLabel('Servicios', services.length, servicesLoading)}
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              {getTabLabel('Facturas', invoices.length, invoicesLoading)}
            </TabsTrigger>
            <TabsTrigger 
              value="closures" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              {getTabLabel('Cierres', closures.length, closuresLoading)}
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              {getTabLabel('Solicitudes', requests.length, requestsLoading)}
            </TabsTrigger>
            <TabsTrigger 
              value="billing_contacts" 
              className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs sm:text-sm"
            >
              {getTabLabel('Cobranza', activeContactsCount, contactsLoading)}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-2 sm:p-6 space-y-4 sm:space-y-6">
              <TabsContent value="overview" className="m-0">
                <ClientMetricsOverview client={client} />
              </TabsContent>

              <TabsContent value="info" className="m-0">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Información General</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Nombre/Razón Social
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {toTitleCase(client.name)}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            RUT
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {client.rut}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Email
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {client.email || 'No especificado'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Departamento
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {client.department}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Teléfono
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {client.phone || 'No especificado'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Dirección
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {toTitleCase(client.address || 'No especificada')}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Estado
                          </label>
                          <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                            client.isActive 
                              ? 'bg-primary/10 text-primary border border-primary/20' 
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {client.isActive ? 'Activo' : 'Inactivo'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Fecha de Registro
                          </label>
                          <p className="text-foreground bg-card border-border rounded px-3 py-2">
                            {client.createdAt ? businessClock.dateLabel(client.createdAt, 'es-CL') : 'No disponible'}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Logo del portal cliente
                          </label>
                          <ClientLogoUpload
                            clientId={client.id}
                            currentLogoUrl={logoUrl}
                            clientName={client.name}
                            onLogoChange={onLogoChange || (() => {})}
                          />
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

              <TabsContent value="billing_contacts" className="m-0">
                <ClientBillingContacts clientId={client.id} />
              </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
