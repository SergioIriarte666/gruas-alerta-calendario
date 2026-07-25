import { useUser } from '@/contexts/UserContext';
import { RefreshCw, AlertCircle, BriefcaseBusiness, Radio, PackageCheck, ChevronRight } from 'lucide-react';
import { useOperatorServicesTabs } from '@/hooks/useOperatorServicesTabs';
import { AssignedServiceCard } from '@/components/operator/AssignedServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NextServiceCard } from '@/components/operator/NextServiceCard';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { usePendingOfflineInspections } from '@/hooks/usePendingOfflineInspections';
import { TransmissionControl } from '@/components/operator/TransmissionControl';
import { DocumentStatusBanner } from '@/components/operator/DocumentStatusBanner';
import { OperatorActivityPreview } from '@/components/operator/OperatorActivityPreview';

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
  const sectionTitle: Record<TabKey, { eyebrow: string; title: string; description: string }> = {
    asignados: {
      eyebrow: 'Servicios asignados',
      title: 'Tu jornada',
      description: 'Trabajos preparados para comenzar',
    },
    activos: {
      eyebrow: 'Trabajo en curso',
      title: 'Servicios activos',
      description: 'Continúa desde donde quedaste',
    },
    pendientes_entrega: {
      eyebrow: 'Último paso',
      title: 'Pendientes de entrega',
      description: 'Servicios listos para finalizar',
    },
    completados: {
      eyebrow: 'Actividad reciente',
      title: 'Historial',
      description: 'Últimos servicios completados',
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Cargando jornada">
        <Skeleton className="h-24 w-full rounded-3xl bg-muted" />
        <Skeleton className="h-20 w-full rounded-3xl bg-muted" />
        <Skeleton className="h-40 w-full rounded-3xl bg-muted" />
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
    <div className="operator-native-dashboard space-y-5">
      {/* ── Cabina de jornada ── */}
      <section className="operator-native-hero">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="operator-native-eyebrow text-primary">{sectionTitle[activeTab].eyebrow}</p>
            <h1 className="operator-native-display mt-1 truncate text-4xl font-bold text-foreground">
              {activeTab === 'asignados' ? `Hola, ${user?.name?.split(' ')[0] || 'Operador'}` : sectionTitle[activeTab].title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{sectionTitle[activeTab].description}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Actualizar jornada"
            className="operator-native-icon-button flex size-12 flex-shrink-0 items-center justify-center text-foreground"
          >
            <RefreshCw className={`size-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {activeTab === 'asignados' && (
          <div className="operator-native-status-rail relative z-10 mt-5 grid grid-cols-3 gap-1">
            {[
              { label: 'Asignados', count: serviceTabs.asignados.length, icon: BriefcaseBusiness, tone: 'primary' },
              { label: 'Activos', count: serviceTabs.activos.length, icon: Radio, tone: 'info' },
              { label: 'Entrega', count: serviceTabs.pendientes_entrega.length, icon: PackageCheck, tone: 'warning' },
            ].map(({ label, count, icon: Icon, tone }) => (
              <div key={label} className={`operator-native-status operator-native-status--${tone}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <Icon className="size-3.5" />
                  <span className="operator-native-display text-2xl font-bold tabular-nums">{count}</span>
                </div>
                <p className="mt-0.5 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <DocumentStatusBanner operatorId={user?.operator_id} />

      {/* ── Resumen próximo servicio ── */}
      {activeTab === 'asignados' && asignadosSorted.length > 0 && (
        <NextServiceCard service={asignadosSorted[0]} />
      )}

      {/* Un solo control: transmisión, link del cliente y estado de subida. No
          puede coexistir con otro consumidor de useOperatorLocationTracking —
          dos montajes abren dos watchers y pelean por la misma sesión. */}
      <TransmissionControl
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

      {activeTab === 'asignados' && <OperatorActivityPreview />}

      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <p className="operator-native-eyebrow">{sectionTitle[activeTab].eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">{sectionTitle[activeTab].title}</h2>
        </div>
        {current.services.length > 0 && (
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            {current.services.length} {current.services.length === 1 ? 'servicio' : 'servicios'}
            <ChevronRight className="size-3.5" />
          </div>
        )}
      </div>

      {/* ── Lista de servicios ── */}
      {current.services.length === 0 ? (
        <div className="operator-native-empty-state rounded-3xl p-10 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-5" />
          </span>
          <p className="font-semibold text-foreground">{current.emptyLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">La jornada se actualizará automáticamente.</p>
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

      <p className="pb-2 text-center text-xs font-medium text-muted-foreground/60">
        TMS Operador · Grúas 5 Norte · {businessClock.todayDate().getFullYear()}
      </p>
    </div>
  );
};

export default OperatorDashboard;
