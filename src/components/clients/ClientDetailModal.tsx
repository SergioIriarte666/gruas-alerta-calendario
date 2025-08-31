import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Client } from '@/types';
import { ClientBillingConfigComponent } from './ClientBillingConfig';
import { ClientBillingConfig } from '@/types/deferredBilling';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';

interface ClientDetailModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  open,
  onOpenChange,
}) => {
  const { updateClient } = useClients();
  const [saving, setSaving] = useState(false);

  if (!client) return null;

  const billingConfig: ClientBillingConfig = {
    billingCycleType: client.billingCycleType || 'immediate',
    billingDelayDays: client.billingDelayDays || 0,
    billingCycleDay: client.billingCycleDay,
    autoInvoiceGeneration: client.autoInvoiceGeneration || false,
    billingNotes: client.billingNotes || '',
  };

  const handleBillingConfigChange = (config: ClientBillingConfig) => {
    // La configuración se actualiza en el componente hijo
  };

  const handleSaveBillingConfig = async (config: ClientBillingConfig) => {
    try {
      setSaving(true);
      await updateClient(client.id, {
        billingCycleType: config.billingCycleType,
        billingDelayDays: config.billingDelayDays,
        billingCycleDay: config.billingCycleDay,
        autoInvoiceGeneration: config.autoInvoiceGeneration,
        billingNotes: config.billingNotes,
      });
      toast.success("Configuración de facturación actualizada");
    } catch (error) {
      toast.error("Error al actualizar la configuración");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card">
        <DialogHeader>
          <DialogTitle className="text-white">
            Configuración del Cliente: {client.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="billing" className="space-y-4">
          <TabsList className="glass-card">
            <TabsTrigger value="billing">Facturación</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="space-y-4">
            <ClientBillingConfigComponent
              config={billingConfig}
              onChange={handleBillingConfigChange}
              onSave={() => handleSaveBillingConfig(billingConfig)}
              loading={saving}
            />
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="text-center py-8 text-white/70">
              Información general del cliente - Próximamente
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="text-center py-8 text-white/70">
              Historial de servicios y facturas - Próximamente
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};