import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useInventoryFix } from '@/hooks/useInventoryFix';

export function InventoryFixPanel() {
  const { execute, isExecuting, result } = useInventoryFix();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning" />
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
          onClick={execute}
          disabled={isExecuting}
          className="w-full"
          size="lg"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Ejecutando corrección...
            </>
          ) : (
            'Ejecutar Corrección Completa'
          )}
        </Button>

        {result && (
          <Card className="bg-accent/5 border-accent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-success" />
                <CardTitle className="text-base">Resultado de la Corrección</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground">Costos Duplicados</div>
                  <div className="text-2xl font-bold text-destructive">
                    {result.deleted_costs || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">eliminados</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Registros Actualizados</div>
                  <div className="text-2xl font-bold text-success">
                    {result.updated_crane_parts || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">crane_parts corregidos</div>
                </div>
              </div>
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  {result.message}
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
