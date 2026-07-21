import * as React from 'react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ServiceLiberationTool } from './ServiceLiberationTool';
import { ForceStatusChangeTool } from './ForceStatusChangeTool';
import { BulkStatusRepairTool } from './BulkStatusRepairTool';
import { ServiceDeletionTool } from './ServiceDeletionTool';
import { PaymentReassignmentTool } from './PaymentReassignmentTool';
import { PurchaseVoidTool } from './PurchaseVoidTool';
import { Unlock, RefreshCw, ScanSearch, Trash2, ArrowRightLeft, PackageX } from 'lucide-react';

export const AdminEmergencyPanel = () => {
  const { isAdmin } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('liberation');

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tienes permisos para acceder a estas herramientas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-6 bg-card border h-auto p-1 gap-1">
            <TabsTrigger value="liberation" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Unlock className="size-4" />
              <span>Liberación</span>
            </TabsTrigger>
            <TabsTrigger value="force-status" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <RefreshCw className="size-4" />
              <span>Forzar Estado</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-repair" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ScanSearch className="size-4" />
              <span>Reparación Masiva</span>
            </TabsTrigger>
            <TabsTrigger value="delete-service" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trash2 className="size-4" />
              <span>Eliminar Servicio</span>
            </TabsTrigger>
            <TabsTrigger value="payment-reassign" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ArrowRightLeft className="size-4" />
              <span>Reconexión Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="void-purchase" className="flex min-h-10 h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap p-2 text-xs text-foreground hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <PackageX className="size-4" />
              <span>Anular Compra</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="liberation">
          <ServiceLiberationTool />
        </TabsContent>
        <TabsContent value="force-status">
          <ForceStatusChangeTool />
        </TabsContent>
        <TabsContent value="bulk-repair">
          <BulkStatusRepairTool />
        </TabsContent>
        <TabsContent value="delete-service">
          <ServiceDeletionTool />
        </TabsContent>
        <TabsContent value="payment-reassign">
          <PaymentReassignmentTool />
        </TabsContent>
        <TabsContent value="void-purchase">
          <PurchaseVoidTool />
        </TabsContent>
      </Tabs>
    </div>
  );
};
