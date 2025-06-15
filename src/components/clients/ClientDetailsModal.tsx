
import * as React from 'react';
import { Client } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientGeneralInfo } from './ClientGeneralInfo';
import { ClientServiceHistory } from './ClientServiceHistory';
import { ClientInvoicing } from './ClientInvoicing';
import { User, History, FileText } from 'lucide-react';

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900/80 backdrop-blur-sm border-gray-700 text-white overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Detalles de {client.name}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 p-1 h-auto">
              <TabsTrigger value="general" className="flex items-center gap-2 data-[state=active]:bg-tms-green data-[state=active]:text-white data-[state=active]:shadow-md rounded-sm">
                <User className="w-4 h-4" />
                Información General
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-tms-green data-[state=active]:text-white data-[state=active]:shadow-md rounded-sm">
                <History className="w-4 h-4" />
                Historial de Servicios
              </TabsTrigger>
              <TabsTrigger value="invoicing" className="flex items-center gap-2 data-[state=active]:bg-tms-green data-[state=active]:text-white data-[state=active]:shadow-md rounded-sm">
                <FileText className="w-4 h-4" />
                Facturación
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-6">
              <ClientGeneralInfo client={client} />
            </TabsContent>
            <TabsContent value="history" className="mt-6">
              <ClientServiceHistory client={client} />
            </TabsContent>
            <TabsContent value="invoicing" className="mt-6">
              <ClientInvoicing client={client} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
