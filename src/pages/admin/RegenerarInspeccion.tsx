import { useMemo, useState } from 'react';
import { RegenerarInspeccionHeader } from '@/components/regenerar-inspeccion/RegenerarInspeccionHeader';
import { RegenerarInspeccionFilters } from '@/components/regenerar-inspeccion/RegenerarInspeccionFilters';
import { RegenerarInspeccionMobileView } from '@/components/regenerar-inspeccion/RegenerarInspeccionMobileView';
import { RegenerarInspeccionTable } from '@/components/regenerar-inspeccion/RegenerarInspeccionTable';
import { PreviewInspeccionDialog } from '@/components/regenerar-inspeccion/PreviewInspeccionDialog';
import { useServiciosConFotosFetcher } from '@/hooks/useRegenerarInspeccion';
import { useDeviceType } from '@/hooks/useDeviceType';
import { RegenerarInspeccionFilters as Filters, ServicioConFotos } from '@/types/regenerar-inspeccion';

const initialFilters: Filters = {
  folio: '',
  fecha: '',
  cliente: '',
};

const RegenerarInspeccion = () => {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selected, setSelected] = useState<ServicioConFotos | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { isMobile } = useDeviceType();
  const query = useServiciosConFotosFetcher();

  const filteredServicios = useMemo(() => {
    const folio = filters.folio.trim().toLowerCase();
    const cliente = filters.cliente.trim().toLowerCase();
    return (query.data || []).filter((servicio) => {
      if (folio && !servicio.folio.toLowerCase().includes(folio)) return false;
      if (cliente && !servicio.clientName.toLowerCase().includes(cliente)) return false;
      if (filters.fecha && servicio.serviceDate.slice(0, 10) !== filters.fecha) return false;
      return true;
    });
  }, [filters, query.data]);

  const handlePreview = (servicio: ServicioConFotos) => {
    setSelected(servicio);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <RegenerarInspeccionHeader onRefresh={() => query.refetch()} isRefreshing={query.isFetching} />
      <RegenerarInspeccionFilters filters={filters} onChange={setFilters} />

      {query.isLoading && (
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          Cargando servicios con evidencia fotográfica...
        </div>
      )}

      {query.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : 'No se pudieron cargar los servicios'}
        </div>
      )}

      {!query.isLoading && !query.error && (
        isMobile
          ? <RegenerarInspeccionMobileView servicios={filteredServicios} onPreview={handlePreview} />
          : <RegenerarInspeccionTable servicios={filteredServicios} onPreview={handlePreview} />
      )}

      <PreviewInspeccionDialog
        servicio={selected}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
};

export default RegenerarInspeccion;
