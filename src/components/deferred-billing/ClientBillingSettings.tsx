import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { Search, Settings, Calendar, Clock, Users, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClientBillingConfigComponent } from '@/components/clients/ClientBillingConfig';
import { ClientBillingConfig } from '@/types/deferredBilling';

export const ClientBillingSettings: React.FC = () => {
  const { clients, updateClient, loading } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.rut.includes(searchTerm) ||
    client.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deferredClients = clients.filter(client => client.billingCycleType === 'deferred');
  const immediateClients = clients.filter(client => client.billingCycleType !== 'deferred');

  const handleQuickToggle = async (clientId: string, currentType: string) => {
    try {
      const newType = currentType === 'deferred' ? 'immediate' : 'deferred';
      await updateClient(clientId, {
        billingCycleType: newType,
        billingDelayDays: newType === 'deferred' ? 30 : 0,
      });
      toast.success(`Cliente actualizado a facturación ${newType === 'deferred' ? 'diferida' : 'inmediata'}`);
    } catch (error) {
      toast.error('Error al actualizar cliente');
    }
  };

  const handleConfigChange = (config: ClientBillingConfig) => {
    // El config se maneja en el componente hijo
  };

  const handleSaveConfig = async (config: ClientBillingConfig) => {
    if (!selectedClient) return;
    
    try {
      setSaving(true);
      await updateClient(selectedClient.id, {
        billingCycleType: config.billingCycleType,
        billingDelayDays: config.billingDelayDays,
        billingCycleDay: config.billingCycleDay,
        autoInvoiceGeneration: config.autoInvoiceGeneration,
        billingNotes: config.billingNotes,
      });
      toast.success('Configuración guardada exitosamente');
      setConfigModalOpen(false);
      setSelectedClient(null);
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const openConfigModal = (client: any) => {
    setSelectedClient(client);
    setConfigModalOpen(true);
  };

  const getBillingTypeColor = (type: string) => {
    return type === 'deferred' ? 'bg-orange-500/20 text-orange-300' : 'bg-green-500/20 text-green-300';
  };

  const getBillingTypeText = (type: string) => {
    return type === 'deferred' ? 'Diferida' : 'Inmediata';
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/90 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{clients.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/90 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Facturación Diferida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-300">{deferredClients.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/90 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Facturación Inmediata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{immediateClients.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuración de Facturación por Cliente
              </CardTitle>
              <CardDescription className="text-white/70">
                Configura el tipo de facturación para cada cliente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
            <Input
              placeholder="Buscar cliente por nombre, RUT o departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-10"
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{client.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {client.department}
                    </Badge>
                    <Badge className={`text-xs ${getBillingTypeColor(client.billingCycleType || 'immediate')}`}>
                      {getBillingTypeText(client.billingCycleType || 'immediate')}
                    </Badge>
                    {client.autoInvoiceGeneration && (
                      <Badge variant="secondary" className="text-xs">Auto</Badge>
                    )}
                  </div>
                  <div className="text-sm text-white/70">
                    RUT: {client.rut}
                    {client.billingCycleType === 'deferred' && (
                      <span className="ml-4">
                        Diferimiento: {client.billingDelayDays || 0} días
                        {client.billingCycleDay && ` (día ${client.billingCycleDay})`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={client.billingCycleType === 'deferred'}
                    onCheckedChange={() => handleQuickToggle(client.id, client.billingCycleType || 'immediate')}
                    disabled={loading}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openConfigModal(client)}
                    className="min-w-[80px]"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Configurar
                  </Button>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="text-center py-8 text-white/70">
                {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de configuración detallada */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] glass-card">
          <DialogHeader>
            <DialogTitle className="text-white">
              Configurar Facturación: {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <ClientBillingConfigComponent
              config={{
                billingCycleType: selectedClient.billingCycleType || 'immediate',
                billingDelayDays: selectedClient.billingDelayDays || 0,
                billingCycleDay: selectedClient.billingCycleDay,
                autoInvoiceGeneration: selectedClient.autoInvoiceGeneration || false,
                billingNotes: selectedClient.billingNotes || '',
              }}
              onChange={handleConfigChange}
              onSave={() => handleSaveConfig({
                billingCycleType: selectedClient.billingCycleType || 'immediate',
                billingDelayDays: selectedClient.billingDelayDays || 0,
                billingCycleDay: selectedClient.billingCycleDay,
                autoInvoiceGeneration: selectedClient.autoInvoiceGeneration || false,
                billingNotes: selectedClient.billingNotes || '',
              })}
              loading={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};