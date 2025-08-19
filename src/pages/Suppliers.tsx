import React, { useState } from 'react';
import { Building2, CreditCard, Calendar, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { PaymentList } from '@/components/suppliers/PaymentList';
import { SupplierPaymentCalendar } from '@/components/suppliers/SupplierPaymentCalendar';
import { SupplierDocumentList } from '@/components/suppliers/SupplierDocumentList';

export const Suppliers: React.FC = () => {
  const [activeTab, setActiveTab] = useState('suppliers');

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              Gestión de Proveedores
            </h1>
            <p className="text-muted-foreground mt-2">
              Administra proveedores, pagos y seguimiento de vencimientos
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="suppliers" 
              className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Building2 className="h-4 w-4" />
              Proveedores
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <CreditCard className="h-4 w-4" />
              Pagos
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <TabsContent value="suppliers" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Lista de Proveedores</h2>
              </div>
              <SupplierList />
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Gestión de Pagos</h2>
              </div>
              <PaymentList />
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Calendario de Vencimientos</h2>
              </div>
              <SupplierPaymentCalendar />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Documentos de Proveedores</h2>
                <p className="text-sm text-gray-400">
                  Selecciona un proveedor desde la pestaña "Proveedores" para ver sus documentos
                </p>
              </div>
              {/* Nota: SupplierDocumentList requiere supplierId y supplierName como props */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Gestión de Documentos
                </h3>
                <p className="text-gray-400 mb-4">
                  Para ver y gestionar documentos, selecciona un proveedor específico desde la lista de proveedores.
                </p>
                <p className="text-sm text-gray-500">
                  Los documentos se organizan por categorías: Contratos, Facturas, Certificados, Documentos Tributarios y Otros.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};