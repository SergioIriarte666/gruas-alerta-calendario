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

const logger = createLogger('OperatorDashboard');

type TabKey = 'asignados' | 'activos' | 'pendientes_entrega' | 'completados';

const OperatorDashboard = () => {
  const { user } = useUser();
  const { serviceTabs, isLoading, error, refreshAllData } = useOperatorServicesTabs();
  const { search } = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tabFromUrl = new URLSearchParams(search).get('tab') as TabKey | null;
  const activeTab: TabKey = tabFromUrl || 'asignados';

  const asignadosSorted = [...serviceTabs.asignados].sort((a, b) =>
    (a.serviceDate || '').localeCompare(b.serviceDate || '')
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refreshAllData(); } finally { setIsRefreshing(false); }
  };

  logger.debug('Render:', { activeTab, totalServices: serviceTabs.asignados.length });

  const sectionMap: Record<TabKey, { services: typeof serviceTabs.asignados; emptyLabel: string; showDelivery?: boolean }> = {
    asignados:          { services: asignadosSorted,                 emptyLabel: 'No hay servicios asignados' },
    activos:            { services: serviceTabs.activos,             emptyLabel: 'No hay servicios activos' },
    pendientes_entrega: { services: serviceTabs.pendientes_entrega,  emptyLabel: 'No hay entregas pendientes', showDelivery: true },
    completados:        { services: serviceTabs.completados,         emptyLabel: 'No hay servicios completados' },
  };

  const current = sectionMap[activeTab];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl bg-zinc-800" />
        <Skeleton className="h-28 w-full rounded-2xl bg-zinc-800" />
        <Skeleton className="h-28 w-full rounded-2xl bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    const isNoOperator = error.message.includes('operador');
    return (
      <div className="rounded-2xl bg-red-950/40 border border-red-900/50 p-6 text-center">
        <AlertCircle className="size-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm font-semibold text-red-300 mb-1">
          {isNoOperator ? 'Usuario no configurado como operador' : 'Error al cargar servicios'}
        </p>
        <p className="text-xs text-red-400/70 mb-4">
          {isNoOperator
            ? 'Tu usuario no tiene un operador asociado. Vincúlalo en Configuración → Gestión de Usuarios (Asignar Operador).'
            : error.message}
        </p>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl border border-red-800 text-red-300 text-sm"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Bienvenida + refresh ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Buenos días</p>
          <h1 className="text-lg font-bold text-white leading-tight">
            {user?.name?.split(' ')[0] || 'Operador'}
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="size-9 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
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
            { label: 'Asignados', count: serviceTabs.asignados.length,          color: 'text-violet-400' },
            { label: 'Activos',   count: serviceTabs.activos.length,            color: 'text-blue-400' },
            { label: 'Entrega',   count: serviceTabs.pendientes_entrega.length, color: 'text-orange-400' },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-zinc-900 rounded-xl p-3 text-center border border-white/5">
              <p className={`text-xl font-bold ${color}`}>{count}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Lista de servicios ── */}
      {current.services.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900 border border-white/5 p-10 text-center">
          <p className="text-zinc-500 text-sm">{current.emptyLabel}</p>
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

      <p className="text-center text-zinc-700 text-xs pb-2">
        Grúas 5 Norte © {businessClock.todayDate().getFullYear()}
      </p>
    </div>
  );
};

export default OperatorDashboard;
