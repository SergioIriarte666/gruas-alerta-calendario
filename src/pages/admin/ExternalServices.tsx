import { useEffect, useMemo, useState } from 'react';
import { Building2, CircleDollarSign, ClipboardCheck, Handshake, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { Skeleton } from '@/components/ui/skeleton';
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

  const metrics = useMemo(() => {
    const services = query.data ?? [];
    return {
      total: services.length,
      totalCost: services.reduce((sum, service) => sum + (service.outsourcedCost ?? 0), 0),
      providers: new Set(services.map((service) => service.outsourcedProviderId).filter(Boolean)).size,
    };
  }, [query.data]);

  const formattedCost = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(metrics.totalCost);

  useEffect(() => {
    document.title = 'Servicios Externos | Panel';
  }, []);

  const handleRowClick = (svc: ExternalServiceListItem) => {
    if (svc.hasClosure) setDetailTarget(svc);
    else setCloseTarget(svc);
  };

  const renderServiceList = () => {
    if (query.isLoading) {
      return (
        <div className="external-state-panel space-y-3 p-5">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full rounded-lg" />)}
        </div>
      );
    }

    if (query.isError) {
      return (
        <div className="external-error-panel p-6 text-sm">
          <p className="font-semibold text-danger">No fue posible cargar los servicios</p>
          <p className="mt-1 text-muted-foreground">{(query.error as Error)?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" className="mt-4 border-danger/30 text-danger hover:bg-danger/10" onClick={() => query.refetch()}>
            Reintentar
          </Button>
        </div>
      );
    }

    if ((query.data?.length ?? 0) === 0) {
      return (
        <div className="external-state-panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <div className="external-empty-icon">
            <ClipboardCheck className="size-6" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground">
            {tab === 'pending' ? 'Sin cierres pendientes' : 'Sin servicios cerrados'}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {tab === 'pending'
              ? 'Todos los servicios externos disponibles ya tienen su cierre administrativo.'
              : 'Los servicios cerrados con evidencia aparecerán en esta sección.'}
          </p>
        </div>
      );
    }

    return isMobile
      ? <ExternalServicesMobileView services={query.data || []} onSelect={handleRowClick} />
      : <ExternalServicesTable services={query.data || []} onSelect={handleRowClick} />;
  };

  return (
    <div className="external-services-concept space-y-6">
      <section className="space-y-5" aria-labelledby="external-services-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="dashboard-section-kicker">
              <Handshake className="size-3.5" />
              Red de proveedores
            </span>
            <h1 id="external-services-heading" className="dashboard-section-title">Servicios externos</h1>
            <p className="dashboard-section-description">Control de subcontrataciones, evidencias y cierres administrativos.</p>
          </div>
          <Button variant="outline" size="sm" className="border-border/70 bg-background/70" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard icon={ClipboardCheck} title={tab === 'pending' ? 'Pendientes visibles' : 'Cierres visibles'} value={metrics.total} description="Servicios del estado seleccionado" tone="primary" variant="control" />
          <MetricCard icon={CircleDollarSign} title="Costo subcontratado" value={formattedCost} description="Suma informada en el período" tone="success" variant="control" />
          <MetricCard icon={Building2} title="Proveedores asignados" value={metrics.providers} description="Proveedores distintos identificados" tone="info" variant="control" />
        </div>
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'closed')} className="space-y-4">
        <TabsList className="external-services-tabs h-auto w-full justify-start gap-1 overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="pending" className="whitespace-nowrap px-4 py-2">Pendientes de cierre</TabsTrigger>
          <TabsTrigger value="closed" className="whitespace-nowrap px-4 py-2">Cerrados</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-0">{renderServiceList()}</TabsContent>
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
