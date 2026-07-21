import { Link, useLocation } from 'react-router-dom';
import { Home, Play, CheckCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/operator',                   icon: Home,        label: 'Inicio'    },
  { to: '/operator?tab=activos',       icon: Play,        label: 'Activos'   },
  { to: '/operator?tab=pendientes_entrega', icon: Package, label: 'Entrega'  },
  { to: '/operator?tab=completados',   icon: CheckCircle, label: 'Historial' },
] as const;

export const OperatorBottomNav = () => {
  const { pathname, search } = useLocation();
  const tab = new URLSearchParams(search).get('tab');

  const isActive = (to: string) => {
    if (to === '/operator') return pathname === '/operator' && !tab;
    return to.includes(`tab=${tab}`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-card/95 shadow-nav backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-medium">{label}</span>
              {active && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-t-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
