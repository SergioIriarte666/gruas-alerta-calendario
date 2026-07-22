import { Activity, ChevronRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { OperatorActivityItem } from '@/components/operator/OperatorActivityItem';
import { useOperatorActivity } from '@/contexts/OperatorActivityContext';

export const OperatorActivityPreview = () => {
  const { recentActivities, unreadCount, connection, isLoading } = useOperatorActivity();

  return (
    <section className="operator-activity-preview" aria-labelledby="operator-activity-preview-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="operator-native-eyebrow flex items-center gap-1.5">
            <Radio className="size-3.5 text-primary" /> En directo
          </p>
          <h2 id="operator-activity-preview-title" className="mt-1 text-xl font-bold text-foreground">
            Actividad reciente
          </h2>
        </div>
        <Link className="operator-activity-preview__link" to="/operator/activity">
          Ver todo
          {unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : recentActivities.length > 0 ? (
        <div className="operator-activity-preview__list">
          {recentActivities.map((activity) => (
            <OperatorActivityItem key={activity.id} activity={activity} compact />
          ))}
        </div>
      ) : (
        <div className="operator-activity-preview__empty">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Todo tranquilo por ahora</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {connection === 'offline' ? 'La cronología se actualizará al recuperar conexión.' : 'Los cambios de tu jornada aparecerán aquí.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
