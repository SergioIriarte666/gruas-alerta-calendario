import React from 'react';
import { useParams } from 'react-router-dom';
import { Service } from '@/types';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { DepartmentBadge } from '@/components/clients/DepartmentBadge';
import { useClientServices } from '@/hooks/useClientServices';
import { useServices } from '@/hooks/useServices';
import { PipelineListView } from '@/components/vip/PipelineListView';
import { PipelineMetrics } from '@/components/vip/PipelineMetrics';
import { PurchaseOrderManager } from '@/components/vip/PurchaseOrderManager';
import { PurchaseOrderPDFImporter } from '@/components/vip/PurchaseOrderPDFImporter';
import { QuotePDFImporter } from '@/components/vip/QuotePDFImporter';
import { BillingBatchImporter } from '@/components/vip/BillingBatchImporter';
import { PurchaseOrderDialog } from '@/components/vip/PurchaseOrderDialog';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

import { ClientAnalytics } from '@/components/vip/ClientAnalytics';
import { ExecutiveReports } from '@/components/vip/ExecutiveReports';
import { PredictiveInsights } from '@/components/vip/PredictiveInsights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { applyVipServiceBatchUpdates } from '@/utils/vipBatchServiceUpdater';
import { getVipPipelineDisplayStatus, isVipPipelineInvoiced } from '@/utils/vipPipelineStatus';

import { toTitleCase } from '@/lib/utils';
import { getClientDisplayName } from '@/utils/clientDisplayName';
import { createLogger } from "@/lib/logger";


const logger = createLogger("VipClientPipeline");

export default function VipClientPipeline() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { services, loading, refetch } = useClientServices(clientId || null);
  const { forceGlobalRefresh } = useServices();
  
  // Estados para modales y formularios
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [showPurchaseOrderDialog, setShowPurchaseOrderDialog] = React.useState(false);
  const [showServiceDetailsModal, setShowServiceDetailsModal] = React.useState(false);
  
  // Estados para edición de servicios
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  
  // Batch progress
  const batchProgress = useBatchProgress();

  const client = clients.find(c => c.id === clientId);

  const handleServiceUpdate = () => {
    refetch();
    toast.success('Servicio actualizado correctamente');
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    if (getVipPipelineDisplayStatus(service) === 'purchase_order_pending' && !service.purchaseOrderNumber) {
      setShowPurchaseOrderDialog(true);
    } else {
      setShowServiceDetailsModal(true);
    }
  };

  const handleServiceView = (service: Service) => {
    setSelectedService(service);
    setShowPurchaseOrderDialog(false);
    setShowServiceDetailsModal(true);
  };

  const handleServiceEdit = (service: Service) => {
    if (isVipPipelineInvoiced(service)) {
      toast.error('No se puede editar un servicio facturado');
      return;
    }
    setEditingService(service);
    setIsFormOpen(true);
  };

  // Función para crear servicio
  const handleCreateService = async (createdService: Service) => {
    try {
      logger.debug('Post-procesando servicio VIP creado:', createdService.folio);
      await refetch();
      setIsFormOpen(false);
      setEditingService(null);
      toast.success('Servicio creado correctamente');
    } catch (error) {
      logger.error('Error creando servicio:', error);
    }
  };

  // Función para actualizar servicio
  const handleUpdateService = async (updatedService: Service) => {
    try {
      logger.debug('Post-procesando servicio VIP actualizado:', updatedService.folio);
      await refetch();
      setIsFormOpen(false);
      setEditingService(null);
      toast.success('Servicio actualizado correctamente');
    } catch (error) {
      logger.error('Error actualizando servicio:', error);
    }
  };

  // Función para actualización por lotes
  const handleBatchUpdate = async (updates: any) => {
    try {
      logger.debug('🔄 Iniciando actualización por lotes:', updates);

      const servicesToUpdate = updates.services.filter((serviceUpdate: any) =>
        Boolean(serviceUpdate.quote_number || serviceUpdate.purchase_order_number || serviceUpdate.target_status)
      );

      if (servicesToUpdate.length === 0) {
        toast.error('No hay cambios efectivos para registrar en el lote');
        return;
      }
      
      // Start progress modal
      batchProgress.start('Registrando lote', servicesToUpdate.length);
      
      const serviceLabelById = new Map<string, string>(
        servicesToUpdate.map((serviceUpdate: any, index: number) => [
          serviceUpdate.id,
          serviceUpdate.folio || `Servicio ${index + 1}`,
        ])
      );

      const payload = servicesToUpdate.map((serviceUpdate: any) => ({
        id: serviceUpdate.id,
        quote_number: serviceUpdate.quote_number || null,
        purchase_order: serviceUpdate.purchase_order_number || null,
        target_status: updates.auto_update_status ? serviceUpdate.target_status || null : null,
      }));

      const { successCount, failedIds } = await applyVipServiceBatchUpdates({
        updates: payload,
        getLabel: (update, index) => serviceLabelById.get(update.id) || `Servicio ${index + 1}`,
        onProgress: ({ processedCount, currentLabel }) => {
          batchProgress.update(processedCount, currentLabel);
        },
      });

      const failedServices = failedIds.map((serviceId) => serviceLabelById.get(serviceId) || serviceId);

      await Promise.all([
        forceGlobalRefresh(),
        refetch(),
      ]);
      
      // Mensaje más detallado según lo que se actualizó
      let message = `${successCount} servicios actualizados correctamente`;
      if (updates.auto_update_status && servicesToUpdate[0]?.target_status) {
        const statusName = servicesToUpdate[0].target_status === 'quoted' ? 'Cotizado' : 'Con Orden de Compra';
        message += ` - Estado cambiado a '${statusName}'`;
      }

      if (failedServices.length === 0) {
        batchProgress.complete();
        setTimeout(() => {
          batchProgress.close();
          toast.success(message);
        }, 400);
        return;
      }

      batchProgress.error(`${failedServices.length} de ${servicesToUpdate.length} con error`);
      setTimeout(() => {
        batchProgress.close();
        toast.error('El lote terminó con errores parciales', {
          description:
            failedServices.length <= 3
              ? `Fallaron: ${failedServices.join(', ')}`
              : `Fallaron ${failedServices.length} servicios. Revisa el lote para identificar los pendientes.`,
        });
      }, 600);
    } catch (error) {
      batchProgress.close();
      logger.error('❌ Error en actualización por lotes:', error);
      toast.error('Error al actualizar los servicios');
      throw error;
    }
  };

  if (!clientId) {
    navigate('/clients');
    return null;
  }

  if (!client) {
    return (
      <div className="client-pipeline-concept space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/clients')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 mr-2" />
            Volver a Clientes
          </Button>
        </div>
        <Card className="operations-panel border bg-card">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 size-12 text-warning" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Cliente no encontrado</h2>
            <p className="text-muted-foreground">El cliente solicitado no existe o no tienes permisos para verlo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="client-pipeline-concept space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/clients')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 mr-2" />
            <span className="hidden sm:inline">Volver a Clientes</span>
            <span className="sm:hidden">Volver</span>
          </Button>
          <div className="hidden sm:block h-8 w-px bg-border" />
          <div>
            <span className="dashboard-section-kicker">Pipeline comercial</span>
            {/* Cada departamento del RUT es una unidad operativa aparte y este
                pipeline es solo el suyo: el nombre lo lleva para que nunca se
                confunda con el de una sucursal hermana. */}
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex flex-wrap items-center gap-2 sm:gap-3">
              {getClientDisplayName(client)}
              <Badge variant="secondary" className="text-xs sm:text-sm">
                VIP Pipeline
              </Badge>
            </h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              RUT: {client.rut} • 
              <DepartmentBadge
                department={client.department}
                clientRut={client.rut}
                clientName={toTitleCase(client.name)}
                allClients={clients}
              />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="size-3 mr-1" />
            <span className="hidden sm:inline">Sistema Activo</span>
            <span className="sm:hidden">Activo</span>
          </Badge>
        </div>
      </div>

      {/* Pipeline Metrics */}
      <PipelineMetrics services={services} clientName={toTitleCase(client.name)} clientId={clientId} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="operations-tabs grid h-auto w-full grid-cols-2 border p-1 sm:grid-cols-4">
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="text-xs sm:text-sm">
            O.C.
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-0">
          <div className="min-h-[37.5rem]">
            <PipelineListView 
              services={services} 
              loading={loading}
              clientId={clientId}
              clientName={toTitleCase(client.name)}
              onServiceUpdate={handleServiceUpdate}
              onServiceSelect={handleServiceSelect}
              onServiceEdit={handleServiceEdit}
              onBatchUpdate={handleBatchUpdate}
            />
          </div>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-6">
          <BillingBatchImporter
            clientId={clientId}
            clientName={toTitleCase(client.name)}
            services={services}
            onServiceSelect={handleServiceView}
            onRefresh={async () => {
              await Promise.all([forceGlobalRefresh(), refetch()]);
            }}
          />
          <QuotePDFImporter
            clientId={clientId}
            clientName={toTitleCase(client.name)}
            services={services}
            onComplete={() => refetch()}
          />
          <PurchaseOrderPDFImporter
            clientId={clientId}
            clientName={toTitleCase(client.name)}
            services={services}
            onComplete={() => refetch()}
          />
          <PurchaseOrderManager 
            services={services}
            clientId={clientId}
            onServiceSelect={handleServiceSelect}
          />
        </TabsContent>


        <TabsContent value="analytics" className="space-y-0">
          <div className="space-y-6">
            <ClientAnalytics 
              services={services}
              clientId={clientId}
              clientName={toTitleCase(client.name)}
            />
            <PredictiveInsights 
              services={services}
              clientId={clientId}
              clientName={toTitleCase(client.name)}
            />
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-0">
          <ExecutiveReports 
            services={services}
            clientId={clientId}
            clientName={toTitleCase(client.name)}
          />
        </TabsContent>
      </Tabs>

      {/* Info Footer */}
      <Card className="operations-panel border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="size-4 text-primary" />
            <p className="text-sm">
              Este pipeline se actualiza en tiempo real. Los servicios se mueven automáticamente entre estados según su progreso.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Order Dialog */}
      <PurchaseOrderDialog
        open={showPurchaseOrderDialog}
        onOpenChange={setShowPurchaseOrderDialog}
        service={selectedService}
        clientId={clientId}
        onUpdate={handleServiceUpdate}
      />

      {/* Service Details Modal */}
      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isOpen={showServiceDetailsModal}
          onClose={() => setShowServiceDetailsModal(false)}
        />
      )}

      {/* Services Form Dialog */}
      <ServicesDialogs
        isCSVUploadOpen={false}
        onCSVUploadClose={() => {}}
        onCSVSuccess={() => {}}
        isFormOpen={isFormOpen}
        onFormOpenChange={setIsFormOpen}
        editingService={editingService}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={null}
        isDetailsOpen={false}
        onDetailsClose={() => {}}
      />

      {/* Batch Progress Modal */}
      <BatchProgressModal 
        state={batchProgress.state} 
        onClose={batchProgress.close} 
      />
    </div>
  );
}
