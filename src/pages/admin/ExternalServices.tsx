import { useEffect, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExternalServices, ExternalServiceListItem } from '@/hooks/useExternalServices';
import { ExternalServicesTable } from '@/components/external-services/ExternalServicesTable';
import { ExternalServicesMobileView } from '@/components/external-services/ExternalServicesMobileView';
import { CloseExternalServiceDialog } from '@/components/external-services/CloseExternalServiceDialog';
import { ExternalServiceDetailsDialog } from '@/components/external-services/ExternalServiceDetailsDialog';
import { useDeviceType } from '@/hooks/useDeviceType';

const ExternalServices = () => {
  const [tab, setTab] = useState<'pending' | 'closed'>('pending');
  const [closeTarget, setCloseTarget] = useState<ExternalServiceListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<ExternalServiceListItem | null>(null);
  const { isMobile } = useDeviceType();

  const query = useExternalServices(tab);

  useEffect(() => {
    document.title = 'Servicios Externos | Panel';
  }, []);

  const handleRowClick = (svc: ExternalServiceListItem) => {
    if (svc.hasClosure) setDetailTarget(svc);
    else setCloseTarget(svc);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-purple-100 p-2 dark:bg-purple-900/40">
            <Building2 className="size-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Servicios Externos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gestión de servicios subcontratados a proveedores externos
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'closed')}>
        <TabsList>
          <TabsTrigger value="pending">Pendientes de cierre</TabsTrigger>
          <TabsTrigger value="closed">Cerrados</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {query.isLoading ? (
            <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
              Cargando servicios...
            </div>
          ) : query.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              <p className="font-medium">Error al cargar servicios</p>
              <p className="mt-1">{(query.error as Error)?.message || 'Error desconocido'}</p>
              <button
                className="mt-3 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                onClick={() => query.refetch()}
              >
                Reintentar
              </button>
            </div>
          ) : (query.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay servicios externos pendientes de cierre.
            </div>
          ) : isMobile ? (
            <ExternalServicesMobileView services={query.data || []} onSelect={handleRowClick} />
          ) : (
            <ExternalServicesTable services={query.data || []} onSelect={handleRowClick} />
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          {query.isLoading ? (
            <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
              Cargando servicios...
            </div>
          ) : query.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              <p className="font-medium">Error al cargar servicios</p>
              <p className="mt-1">{(query.error as Error)?.message || 'Error desconocido'}</p>
              <button
                className="mt-3 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                onClick={() => query.refetch()}
              >
                Reintentar
              </button>
            </div>
          ) : (query.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay servicios externos cerrados.
            </div>
          ) : isMobile ? (
            <ExternalServicesMobileView services={query.data || []} onSelect={handleRowClick} />
          ) : (
            <ExternalServicesTable services={query.data || []} onSelect={handleRowClick} />
          )}
        </TabsContent>
      </Tabs>

      <CloseExternalServiceDialog
        service={closeTarget}
        open={!!closeTarget}
        onOpenChange={(open) => !open && setCloseTarget(null)}
      />
      <ExternalServiceDetailsDialog
        service={detailTarget}
        open={!!detailTarget}
        onOpenChange={(open) => !open && setDetailTarget(null)}
      />
    </div>
  );
};

export default ExternalServices;
