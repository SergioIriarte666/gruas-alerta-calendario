import React from 'react';
import { useParams } from 'react-router-dom';
import { Service } from '@/types';
import { ArrowLeft, Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PurchaseOrderDialog } from '@/components/vip/PurchaseOrderDialog';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

import { ClientAnalytics } from '@/components/vip/ClientAnalytics';
import { ExecutiveReports } from '@/components/vip/ExecutiveReports';
import { PredictiveInsights } from '@/components/vip/PredictiveInsights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function VipClientPipeline() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { services, loading, refetch } = useClientServices(clientId || null);
  const { createService, updateService } = useServices();
  
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
    if (service.status === 'purchase_order_pending' && !service.purchaseOrderNumber) {
      setShowPurchaseOrderDialog(true);
    } else {
      setShowServiceDetailsModal(true);
    }
  };

  const handleServiceEdit = (service: Service) => {
    if (service.status === 'invoiced') {
      toast.error('No se puede editar un servicio facturado');
      return;
    }
    setEditingService(service);
    setIsFormOpen(true);
  };

  // Función para crear servicio
  const handleCreateService = async (serviceData: any) => {
    try {
      await createService(serviceData);
      setIsFormOpen(false);
      setEditingService(null);
      toast.success('Servicio creado correctamente');
      refetch();
    } catch (error) {
      console.error('Error creando servicio:', error);
    }
  };

  // Función para actualizar servicio
  const handleUpdateService = async (serviceData: any) => {
    try {
      if (editingService?.id) {
        await updateService(editingService.id, serviceData);
        setIsFormOpen(false);
        setEditingService(null);
        toast.success('Servicio actualizado correctamente');
        refetch();
      }
    } catch (error) {
      console.error('Error actualizando servicio:', error);
    }
  };

  // Función para actualización por lotes
  const handleBatchUpdate = async (updates: any) => {
    try {
      console.log('🔄 Iniciando actualización por lotes:', updates);
      
      // Start progress modal
      batchProgress.start('REGISTRANDO LOTE', updates.services.length);
      
      // Sequential loop instead of Promise.all for progress reporting
      for (let i = 0; i < updates.services.length; i++) {
        const serviceUpdate = updates.services[i];
        const updateData: any = {};
        
        // Agregar campos según lo que se esté actualizando
        if (serviceUpdate.quote_number) {
          updateData.quoteNumber = serviceUpdate.quote_number;
        }
        if (serviceUpdate.purchase_order_number) {
          updateData.purchaseOrder = serviceUpdate.purchase_order_number;
        }
        
        // Agregar cambio de estado automático si está habilitado
        if (updates.auto_update_status && serviceUpdate.target_status) {
          updateData.status = serviceUpdate.target_status;
        }
        
        await updateService(serviceUpdate.id, updateData);
        
        // Update progress
        batchProgress.update(i + 1, serviceUpdate.folio || `Servicio ${i + 1}`);
      }

      batchProgress.complete();
      
      // Mensaje más detallado según lo que se actualizó
      let message = `${updates.services.length} servicios actualizados correctamente`;
      if (updates.auto_update_status && updates.services[0]?.target_status) {
        const statusName = updates.services[0].target_status === 'quoted' ? 'Cotizado' : 'Con Orden de Compra';
        message += ` - Estado cambiado a '${statusName}'`;
      }
      
      // Delay to show completion animation
      setTimeout(() => {
        batchProgress.close();
        toast.success(message);
        refetch();
      }, 1500);
    } catch (error) {
      batchProgress.close();
      console.error('❌ Error en actualización por lotes:', error);
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
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/clients')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>
        </div>
        <Card className="bg-card border">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Cliente no encontrado</h2>
            <p className="text-muted-foreground">El cliente solicitado no existe o no tienes permisos para verlo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 vip-pipeline-scope">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/clients')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Volver a Clientes</span>
            <span className="sm:hidden">Volver</span>
          </Button>
          <div className="hidden sm:block h-8 w-px bg-border" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex flex-wrap items-center gap-2 sm:gap-3">
              {client.name}
              <Badge variant="secondary" className="text-xs sm:text-sm">
                VIP Pipeline
              </Badge>
            </h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              RUT: {client.rut} • 
              <DepartmentBadge
                department={client.department}
                clientRut={client.rut}
                clientName={client.name}
                allClients={clients}
              />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Sistema Activo</span>
            <span className="sm:hidden">Activo</span>
          </Badge>
        </div>
      </div>

      {/* Pipeline Metrics */}
      <PipelineMetrics services={services} clientName={client.name} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-card border">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
            O.C.
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-0">
          <div className="min-h-[600px]">
            <PipelineListView 
              services={services} 
              loading={loading}
              clientId={clientId}
              clientName={client.name}
              onServiceUpdate={handleServiceUpdate}
              onServiceSelect={handleServiceSelect}
              onServiceEdit={handleServiceEdit}
              onBatchUpdate={handleBatchUpdate}
            />
          </div>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-6">
          <QuotePDFImporter
            clientId={clientId}
            clientName={client.name}
            services={services}
            onComplete={() => refetch()}
          />
          <PurchaseOrderPDFImporter
            clientId={clientId}
            clientName={client.name}
            services={services}
            onComplete={() => refetch()}
          />
          <PurchaseOrderManager 
            services={services}
            onServiceSelect={handleServiceSelect}
          />
        </TabsContent>


        <TabsContent value="analytics" className="space-y-0">
          <div className="space-y-6">
            <ClientAnalytics 
              services={services}
              clientName={client.name}
            />
            <PredictiveInsights 
              services={services}
              clientName={client.name}
            />
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-0">
          <ExecutiveReports 
            services={services}
            clientId={clientId}
            clientName={client.name}
          />
        </TabsContent>
      </Tabs>

      {/* Info Footer */}
      <Card className="bg-card border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="w-4 h-4 text-primary" />
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