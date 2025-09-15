import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FixResult {
  success: boolean;
  deleted_costs: number;
  updated_crane_parts: number;
  materiales_unit_cost: number;
  message: string;
}

export function InventoryFixPanel() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<FixResult | null>(null);

  const executeCompletefix = async () => {
    setIsExecuting(true);
    
    try {
      // Ejecutar limpieza global definitiva
      const { data: result, error } = await supabase.rpc('global_inventory_cleanup');
      
      if (error) {
        throw error;
      }

      const cleanupResult = result as unknown as FixResult;
      setLastResult(cleanupResult);
      
      toast.success('Limpieza global completada exitosamente', {
        description: `Eliminados ${cleanupResult.deleted_costs || 0} costos duplicados, actualizados ${cleanupResult.updated_crane_parts || 0} registros`
      });
      
    } catch (error: any) {
      console.error('Error ejecutando limpieza global:', error);
      toast.error('Error al ejecutar limpieza global', {
        description: error.message || 'Error desconocido'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle>Corrección de Costos de Inventario</CardTitle>
        </div>
        <CardDescription>
          Ejecuta la corrección automática para resolver problemas de:
          <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
            <li>Costos unitarios incorrectos en el catálogo (ej: $0.00)</li>
            <li>Costos de salida incorrectos ($0.01)</li>
            <li>Costos duplicados de "Consumo de Inventario"</li>
            <li>Recálculo de costos reales en crane_parts</li>
          </ul>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={executeCompletefix}
          disabled={isExecuting}
          className="w-full"
          size="lg"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ejecutando corrección...
            </>
          ) : (
            'Ejecutar Corrección Completa'
          )}
        </Button>

        {lastResult && (
          <Card className="bg-accent/5 border-accent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <CardTitle className="text-base">Resultado de la Corrección</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground">Costos Duplicados</div>
                  <div className="text-2xl font-bold text-destructive">
                    {lastResult.deleted_costs || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">eliminados</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Registros Actualizados</div>
                  <div className="text-2xl font-bold text-success">
                    {lastResult.updated_crane_parts || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">crane_parts corregidos</div>
                </div>
              </div>
              
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  {lastResult.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Nota:</strong> Esta operación corrige primero el catálogo de productos y luego limpia duplicados históricos.</p>
          <p>Se mantendrá la trazabilidad completa de todos los movimientos de inventario.</p>
        </div>
      </CardContent>
    </Card>
  );
}