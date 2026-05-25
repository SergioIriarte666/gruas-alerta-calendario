
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function ConnectionTest() {
  const [results, setResults] = useState<{
    auth?: { success: boolean; message: string; data?: any };
    closuresCount?: { success: boolean; message: string; count?: number };
    singleClosure?: { success: boolean; message: string; data?: any };
    invoiceClosures?: { success: boolean; message: string; data?: any };
    clients?: { success: boolean; message: string; count?: number };
  }>({});
  
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const newResults: typeof results = {};

    try {
      // 1. Auth Check
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      newResults.auth = {
        success: !authError && !!session,
        message: authError ? authError.message : (session ? `Authenticated as ${session.user.email}` : 'Not authenticated'),
        data: session?.user
      };

      // 2. Closures Count
      const { count, error: countError } = await supabase
        .from('service_closures')
        .select('*', { count: 'exact', head: true });
      
      newResults.closuresCount = {
        success: !countError,
        message: countError ? countError.message : `Total closures: ${count}`,
        count: count || 0
      };

      // 3. Single Closure Fetch with Relations
      const { data: closureData, error: closureError } = await supabase
        .from('service_closures')
        .select(`
          id, folio, total, status, client_id, created_at,
          clients:client_id (name)
        `)
        .limit(1)
        .single();

      newResults.singleClosure = {
        success: !closureError,
        message: closureError ? closureError.message : `Fetched closure ${closureData?.folio || 'none'}`,
        data: closureData
      };

      // 4. Invoice Closures Check
      const { data: invoiceClosures, error: icError } = await supabase
        .from('invoice_closures')
        .select('count', { count: 'exact', head: true });

      newResults.invoiceClosures = {
        success: !icError,
        message: icError ? icError.message : `Invoice closures table accessible`,
        data: invoiceClosures
      };

      // 5. Clients Check
      const { count: clientsCount, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      newResults.clients = {
        success: !clientsError,
        message: clientsError ? clientsError.message : `Total clients: ${clientsCount}`,
        count: clientsCount || 0
      };

    } catch (err: any) {
      console.error('Test failed unexpectedly:', err);
    } finally {
      setResults(newResults);
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const StatusIcon = ({ success }: { success?: boolean }) => {
    if (success === undefined) return <Loader2 className="size-5 animate-spin text-gray-400" />;
    return success ? <CheckCircle2 className="size-5 text-green-500" /> : <XCircle className="size-5 text-red-500" />;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Diagnóstico de Conexión (Producción)</h1>
        <Button onClick={runTests} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Ejecutar Pruebas
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Auth Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Autenticación</CardTitle>
            <StatusIcon success={results.auth?.success} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.auth?.success ? 'Conectado' : 'Error'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {results.auth?.message || 'Verificando...'}
            </p>
            {results.auth?.data && (
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                User ID: {results.auth.data.id}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Closures Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tabla service_closures</CardTitle>
            <StatusIcon success={results.closuresCount?.success} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.closuresCount?.count ?? '-'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {results.closuresCount?.message || 'Verificando...'}
            </p>
          </CardContent>
        </Card>

        {/* Single Closure + Relations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relación Clientes (JOIN)</CardTitle>
            <StatusIcon success={results.singleClosure?.success} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.singleClosure?.success ? 'OK' : 'Error'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {results.singleClosure?.message || 'Verificando...'}
            </p>
            {results.singleClosure?.data && (
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(results.singleClosure.data, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Invoice Closures Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tabla invoice_closures</CardTitle>
            <StatusIcon success={results.invoiceClosures?.success} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.invoiceClosures?.success ? 'Accesible' : 'Error'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {results.invoiceClosures?.message || 'Verificando...'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTitle>Información de Versión</AlertTitle>
        <AlertDescription>
          Si ves esta página, estás ejecutando la versión de diagnóstico v1.0.3.
          Por favor comparte una captura de pantalla de esta página si ves algún error en rojo.
        </AlertDescription>
      </Alert>
    </div>
  );
}
