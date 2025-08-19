import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackupManager } from '@/components/backup/BackupManager';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const BackupPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Respaldo y Reparación del Sistema</h1>
          <p className="text-muted-foreground">
            Gestión completa de respaldos SQL y reparación del sistema de comisiones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sistema de Respaldo y Reparación Definitiva</CardTitle>
            <CardDescription>
              Herramientas para generar respaldos SQL completos y reparar definitivamente 
              el sistema de comisiones. Use primero el respaldo antes de cualquier reparación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupManager />
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800 mb-2">⚠️ Instrucciones Importantes</h3>
        <div className="text-sm text-amber-700 space-y-2">
          <div><strong>1. RESPALDO PRIMERO:</strong> Siempre genere un dump SQL completo antes de hacer reparaciones</div>
          <div><strong>2. AUDITORÍA:</strong> Ejecute la auditoría para conocer el estado actual del sistema</div>
          <div><strong>3. REPARACIÓN:</strong> Solo ejecute la reparación después del respaldo y auditoría</div>
          <div><strong>4. VERIFICACIÓN:</strong> Después de la reparación, revise que las comisiones aparezcan en la UI</div>
          <div><strong>5. ROLLBACK:</strong> En caso de problemas, use el dump SQL para restaurar el estado anterior</div>
        </div>
      </div>
    </div>
  );
};