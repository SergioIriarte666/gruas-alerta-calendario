import React from 'react';
import { useParams } from 'react-router-dom';
import { Service } from '@/types';
import { ArrowLeft, Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { useClientServices } from '@/hooks/useClientServices';
import { KanbanBoard } from '@/components/vip/KanbanBoard';
import { PipelineMetrics } from '@/components/vip/PipelineMetrics';
import { PurchaseOrderManager } from '@/components/vip/PurchaseOrderManager';
import { PurchaseOrderDialog } from '@/components/vip/PurchaseOrderDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function VipClientPipeline() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { services, loading, refetch } = useClientServices(clientId || null);
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [showPurchaseOrderDialog, setShowPurchaseOrderDialog] = React.useState(false);

  const client = clients.find(c => c.id === clientId);

  const handleServiceUpdate = () => {
    refetch();
    toast.success('Servicio actualizado correctamente');
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    if (service.status === 'purchase_order_pending' && !service.purchaseOrderNumber) {
      setShowPurchaseOrderDialog(true);
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
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Cliente no encontrado</h2>
            <p className="text-gray-400">El cliente solicitado no existe o no tienes permisos para verlo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/clients')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>
          <div className="h-8 w-px bg-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {client.name}
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                VIP Pipeline
              </Badge>
            </h1>
            <p className="text-gray-400">RUT: {client.rut} • {client.department}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Sistema Activo
          </Badge>
        </div>
      </div>

      {/* Pipeline Metrics */}
      <PipelineMetrics services={services} clientName={client.name} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-blue-600">
            Pipeline Kanban
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="data-[state=active]:bg-blue-600">
            Órdenes de Compra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-0">
          <div className="min-h-[600px]">
            <KanbanBoard 
              services={services} 
              loading={loading}
              clientId={clientId}
              onServiceUpdate={handleServiceUpdate}
            />
          </div>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-0">
          <PurchaseOrderManager 
            services={services}
            onServiceSelect={handleServiceSelect}
          />
        </TabsContent>
      </Tabs>

      {/* Info Footer */}
      <Card className="glass-card border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-blue-300">
            <Clock className="w-4 h-4" />
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
    </div>
  );
}