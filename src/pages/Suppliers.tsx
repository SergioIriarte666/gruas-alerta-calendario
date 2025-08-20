import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Upload, Plus, FileText } from 'lucide-react';
import { XMLSupplierUpload } from '@/components/suppliers/XMLSupplierUpload';
import { useSupplierStats } from '@/hooks/useSupplierStats';
import { useSuppliers } from '@/hooks/useSuppliers';

export const Suppliers: React.FC = () => {
  const [showXMLUpload, setShowXMLUpload] = useState(false);
  const { data: stats, isLoading: statsLoading } = useSupplierStats();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();

  const handleXMLUploadSuccess = (count: number) => {
    console.log(`${count} proveedores importados exitosamente`);
  };

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
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => setShowXMLUpload(true)}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Importar XML
            </Button>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Proveedor
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Proveedores
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_suppliers}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active_suppliers} activos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pagos Pendientes
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_pending_payments}</div>
                <p className="text-xs text-muted-foreground">
                  ${stats.total_pending_amount.toLocaleString('es-CL')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pagos Vencidos
                </CardTitle>
                <FileText className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.total_overdue_payments}</div>
                <p className="text-xs text-muted-foreground">
                  ${stats.total_overdue_amount.toLocaleString('es-CL')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Categorías
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(stats.suppliers_by_category).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  tipos de proveedores
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Importación de Datos</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    Importar proveedores desde archivos XML
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Soporte para facturas DTE chilenas
                  </li>
                  <li className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Detección automática de datos de proveedores
                  </li>
                </ul>
                <Button 
                  variant="outline" 
                  onClick={() => setShowXMLUpload(true)}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar XML
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Próximas Funcionalidades</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• CRUD completo de proveedores</li>
                  <li>• Gestión de pagos a proveedores</li>
                  <li>• Calendario de vencimientos</li>
                  <li>• Estadísticas y reportes detallados</li>
                  <li>• Categorización automática por giro</li>
                  <li>• Validación de RUT chileno</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* XML Upload Modal */}
        <XMLSupplierUpload
          isOpen={showXMLUpload}
          onClose={() => setShowXMLUpload(false)}
          onSuccess={handleXMLUploadSuccess}
        />
      </div>
    </div>
  );
};