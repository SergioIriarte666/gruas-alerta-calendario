import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export const Suppliers: React.FC = () => {
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

        {/* Test Card */}
        <Card>
          <CardHeader>
            <CardTitle>Módulo de Proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El módulo de proveedores está siendo implementado. Esta página de prueba confirma que la ruta funciona correctamente.
            </p>
            <div className="mt-4 space-y-2">
              <p><strong>Funcionalidades planificadas:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>CRUD completo de proveedores</li>
                <li>Gestión de pagos a proveedores</li>
                <li>Calendario de vencimientos</li>
                <li>Estadísticas y reportes</li>
                <li>Categorización por tipo de servicio</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};