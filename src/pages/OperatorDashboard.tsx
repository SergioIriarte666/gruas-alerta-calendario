import { useUser } from '@/contexts/UserContext';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useOperatorServicesTabs } from '@/hooks/useOperatorServicesTabs';
import { AssignedServiceCard } from '@/components/operator/AssignedServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NextServiceCard } from '@/components/operator/NextServiceCard';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { usePendingOfflineInspections } from '@/hooks/usePendingOfflineInspections';
import { LocationSharingCard } from '@/components/operator/LocationSharingCard';
import { DocumentStatusBanner } from '@/components/operator/DocumentStatusBanner';

const logger = createLogger('OperatorDashboard');

type TabKey = 'asignados' | 'activos' | 'pendientes_entrega' | 'completados';

const OperatorDashboard = () => {
  const { user } = useUser();
  const { serviceTabs, isLoading, error, refreshAllData } = useOperatorServicesTabs();
  const { pendingCount } = usePendingOfflineInspections();
  const { search } = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tabFromUrl = new URLSearchParams(search).get('tab') as TabKey | null;
  const activeTab: TabKey = tabFromUrl || 'asignados';

  const asignadosSorted = [...serviceTabs.asignados].sort((a, b) =>
    (a.serviceDate || '').localeCompare(b.serviceDate || '')
  );
  const completadosRecientes = [...serviceTabs.completados]
    .sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''))
    .slice(0, 5);
  const currentTrackingService = serviceTabs.activos[0] || asignadosSorted[0] || null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refreshAllData(); } finally { setIsRefreshing(false); }
  };

  logger.debug('Render:', { activeTab, totalServices: serviceTabs.asignados.length });

  const sectionMap: Record<TabKey, { services: typeof serviceTabs.asignados; emptyLabel: string; showDelivery?: boolean }> = {
    asignados:          { services: asignadosSorted,                 emptyLabel: 'No hay servicios asignados' },
    activos:            { services: serviceTabs.activos,             emptyLabel: 'No hay servicios activos' },
    pendientes_entrega: { services: serviceTabs.pendientes_entrega,  emptyLabel: 'No hay entregas pendientes', showDelivery: true },
    completados:        { services: completadosRecientes,            emptyLabel: 'No hay servicios completados' },
  };

  const current = sectionMap[activeTab];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl bg-muted" />
        <Skeleton className="h-28 w-full rounded-2xl bg-muted" />
        <Skeleton className="h-28 w-full rounded-2xl bg-muted" />
      </div>
    );
  }

  if (error) {
    const isNoOperator = error.message.includes('operador');
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-6 text-center">
        <AlertCircle className="mx-auto mb-3 size-10 text-danger" />
        <p className="mb-1 text-sm font-semibold text-danger">
          {isNoOperator ? 'Usuario no configurado como operador' : 'Error al cargar servicios'}
        </p>
        <p className="mb-4 text-xs text-danger/80">
          {isNoOperator
            ? 'Tu usuario no tiene un operador asociado. Vincúlalo en Configuración → Gestión de Usuarios (Asignar Operador).'
            : error.message}
        </p>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="mx-auto flex items-center gap-2 rounded-xl border border-danger/30 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocumentStatusBanner operatorId={user?.operator_id} />

      {/* ── Bienvenida + refresh ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Buenos días</p>
          <h1 className="text-lg font-bold leading-tight text-foreground">
            {user?.name?.split(' ')[0] || 'Operador'}
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Resumen próximo servicio ── */}
      {activeTab === 'asignados' && asignadosSorted.length > 0 && (
        <NextServiceCard service={asignadosSorted[0]} />
      )}

      {/* ── Contadores rápidos (solo en inicio) ── */}
      {activeTab === 'asignados' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Asignados', count: serviceTabs.asignados.length,          color: 'text-primary' },
            { label: 'Activos',   count: serviceTabs.activos.length,            color: 'text-info' },
            { label: 'Entrega',   count: serviceTabs.pendientes_entrega.length, color: 'text-warning' },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
              <p className={`text-xl font-bold ${color}`}>{count}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      <LocationSharingCard
        operatorId={user?.operator_id}
        userId={user?.id}
        currentService={currentTrackingService}
      />

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft p-3">
          <p className="text-sm font-medium text-warning">
            {pendingCount} inspección(es) pendiente(s) de sincronización
          </p>
          <p className="mt-1 text-xs text-warning/80">
            Se enviarán automáticamente cuando el equipo recupere conexión.
          </p>
        </div>
      )}

      {/* ── Lista de servicios ── */}
      {current.services.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{current.emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {current.services.map(service => (
            <AssignedServiceCard
              key={service.id}
              service={service}
              showDeliveryAction={current.showDelivery}
            />
          ))}
        </div>
      )}

      <p className="pb-2 text-center text-xs text-muted-foreground/60">
        Grúas 5 Norte © {businessClock.todayDate().getFullYear()}
      </p>
    </div>
  );
};

export default OperatorDashboard;
