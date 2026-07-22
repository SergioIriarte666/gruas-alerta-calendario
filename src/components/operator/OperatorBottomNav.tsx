import { Link, useLocation } from 'react-router-dom';
import { Home, Play, CheckCircle, Package, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOperatorActivity } from '@/contexts/OperatorActivityContext';

const tabs = [
  { to: '/operator',                   icon: Home,        label: 'Inicio'    },
  { to: '/operator?tab=activos',       icon: Play,        label: 'Activos'   },
  { to: '/operator?tab=pendientes_entrega', icon: Package, label: 'Entrega'  },
  { to: '/operator?tab=completados',   icon: CheckCircle, label: 'Historial' },
  { to: '/operator/activity',           icon: Activity,    label: 'Actividad' },
] as const;

export const OperatorBottomNav = () => {
  const { pathname, search } = useLocation();
  const { unreadCount } = useOperatorActivity();
  const tab = new URLSearchParams(search).get('tab');

  const isActive = (to: string) => {
    if (to === '/operator/activity') return pathname === to;
    if (to === '/operator') return pathname === '/operator' && !tab;
    return pathname === '/operator' && to.includes(`tab=${tab}`);
  };

  return (
    <nav
      className="operator-native-tabbar fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navegación principal del operador"
    >
      <div className="operator-native-tabbar__inner flex">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'operator-native-tab relative flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors',
                active ? 'is-active text-primary' : 'text-muted-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="operator-native-tab__icon flex h-7 min-w-12 items-center justify-center rounded-full">
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                {to === '/operator/activity' && unreadCount > 0 && (
                  <span className="operator-native-tab__badge" aria-label={`${unreadCount} actividades sin leer`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
