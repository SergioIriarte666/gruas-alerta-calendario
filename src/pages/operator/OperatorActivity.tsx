import { Activity, CheckCheck, CloudOff, Loader2, Radio, RefreshCw, WifiOff } from 'lucide-react';
import { OperatorActivityItem } from '@/components/operator/OperatorActivityItem';
import { useOperatorActivity } from '@/contexts/OperatorActivityContext';
import { groupOperatorActivities } from '@/lib/operatorActivity';
import { cn } from '@/lib/utils';

/**
 * Estado del canal realtime de la BITÁCORA, no del GPS.
 *
 * Los dos son estados distintos y ya viven en lugares distintos —el GPS se
 * rotula en la tarjeta de transmisión—, pero el 01/08 el operador vio
 * "Reconectando" al entrar acá y lo leyó como pérdida de señal. El rótulo dice
 * ahora de qué habla: un socket caído no es una grúa sin rastrear.
 */
const connectionCopy = {
  connecting: { label: 'Bitácora · conectando', icon: RefreshCw },
  live: { label: 'Bitácora · en directo', icon: Radio },
  offline: { label: 'Bitácora · sin conexión', icon: WifiOff },
  error: { label: 'Bitácora · reconectando', icon: CloudOff },
} as const;

const OperatorActivityPage = () => {
  const {
    activities,
    unreadCount,
    connection,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refresh,
    markAllRead,
    isMarkingRead,
  } = useOperatorActivity();
  const groups = groupOperatorActivities(activities);
  const ConnectionIcon = connectionCopy[connection].icon;

  return (
    <div className="operator-activity-page space-y-5">
      <section className="operator-native-hero operator-activity-hero">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="operator-native-eyebrow text-primary">Bitácora automática</p>
            <h1 className="operator-native-display mt-1 text-4xl font-bold text-foreground">Actividad</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cambios de servicio, inspecciones y ubicación.</p>
          </div>
          <span className={cn('operator-activity-live-pill', `is-${connection}`)}>
            <ConnectionIcon className={cn('size-3.5', connection === 'connecting' && 'animate-spin')} />
            {connectionCopy[connection].label}
          </span>
        </div>

        <div className="relative z-10 mt-5 flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 p-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="size-5" />
            </span>
            <div>
              <p className="operator-native-display text-2xl font-bold tabular-nums text-foreground">{unreadCount}</p>
              <p className="text-xs font-medium text-muted-foreground">{unreadCount === 1 ? 'novedad pendiente' : 'novedades pendientes'}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={isMarkingRead}
              className="operator-activity-read-button"
            >
              {isMarkingRead ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              Marcar leídas
            </button>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Cargando actividad
        </div>
      ) : error ? (
        <div className="operator-native-empty-state rounded-3xl p-8 text-center">
          <CloudOff className="mx-auto mb-3 size-8 text-warning" />
          <p className="font-semibold text-foreground">No pudimos actualizar la bitácora</p>
          <p className="mt-1 text-xs text-muted-foreground">Conservaremos la actividad disponible y volveremos a intentar.</p>
          <button type="button" onClick={() => void refresh()} className="operator-activity-read-button mx-auto mt-4">
            <RefreshCw className="size-4" /> Reintentar
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="operator-native-empty-state rounded-3xl p-10 text-center">
          <Activity className="mx-auto mb-3 size-9 text-primary" />
          <p className="font-semibold text-foreground">Tu bitácora está lista</p>
          <p className="mt-1 text-xs text-muted-foreground">La próxima asignación o cambio operativo aparecerá automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`activity-${group.key}`}>
              <div className="operator-activity-day-heading">
                <h2 id={`activity-${group.key}`}>{group.label}</h2>
                <span>{group.items.length}</span>
              </div>
              <div className="operator-activity-timeline">
                {group.items.map((activity) => (
                  <OperatorActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          ))}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="operator-activity-load-more"
            >
              {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Cargar actividad anterior
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OperatorActivityPage;
