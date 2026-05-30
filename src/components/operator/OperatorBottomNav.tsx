import { Link, useLocation } from 'react-router-dom';
import { Home, Play, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/operator',                   icon: Home,        label: 'Inicio'    },
  { to: '/operator?tab=activos',       icon: Play,        label: 'Activos'   },
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[hsl(222_40%_9%)] border-t border-white/5"
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
                active ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-500 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
