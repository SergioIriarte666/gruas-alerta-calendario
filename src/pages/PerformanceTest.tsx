import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EnhancedClosureSelector from '@/components/invoices/EnhancedClosureSelector';
import { ClosureWithClient } from '@/hooks/useClosuresForInvoices';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PerformanceTest");
const PerformanceTest = () => {
  const [closures, setClosures] = useState<ClosureWithClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClosureId, setSelectedClosureId] = useState<string>('');
  const [_renderTime, _setRenderTime] = useState<number | null>(null);

  const generateClosures = (count: number) => {
    setLoading(true);
    // Use setTimeout to allow UI to update before generating data
    setTimeout(() => {
      const startTime = performance.now();
      
      const newClosures: ClosureWithClient[] = Array.from({ length: count }, (_, i) => ({
        id: `closure-${i}`,
        folio: `FOL-${1000 + i}`,
        status: 'closed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: `client-${i % 100}`,
        clientName: `Cliente Test ${i % 100}`,
        total: Math.random() * 100000,
        dateRange: {
          from: new Date().toISOString(),
          to: new Date().toISOString()
        },
        purchaseOrder: i % 3 === 0 ? `OC-${5000 + i}` : undefined,
        serviceIds: [`svc-${i}-1`, `svc-${i}-2`]
      }));
      
      const endTime = performance.now();
      logger.debug(`Generated ${count} closures in ${(endTime - startTime).toFixed(2)}ms`);
      
      setClosures(newClosures);
      setLoading(false);
    }, 100);
  };

  const handleTest = (count: number) => {
    setClosures([]);
    setSelectedClosureId('');
    generateClosures(count);
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Prueba de Rendimiento: Selector de Cierres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleTest(100)} disabled={loading}>
              Generar 100 Cierres
            </Button>
            <Button onClick={() => handleTest(500)} disabled={loading}>
              Generar 500 Cierres
            </Button>
            <Button onClick={() => handleTest(1000)} disabled={loading}>
              Generar 1,000 Cierres
            </Button>
            <Button onClick={() => handleTest(5000)} disabled={loading}>
              Generar 5,000 Cierres
            </Button>
          </div>

          <div className="p-4 border rounded-md bg-muted/50">
            <p className="text-sm font-medium">Estado:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
              <li>Cierres cargados: {closures.length}</li>
              <li>Cargando: {loading ? 'Sí' : 'No'}</li>
              <li>Seleccionado: {selectedClosureId || 'Ninguno'}</li>
            </ul>
          </div>

          <div className="border p-6 rounded-md">
            <h3 className="text-lg font-medium mb-4">Componente a probar:</h3>
            <div className="max-w-xl">
              <EnhancedClosureSelector
                selectedClosureId={selectedClosureId}
                onClosureChange={setSelectedClosureId}
                closures={closures}
                loading={loading}
                // Disable internal fetching to use our mock data
                // We need to ensure the component supports this prop or we might need to mock the hook
                // Based on previous edits, we added 'closures' prop support
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceTest;
