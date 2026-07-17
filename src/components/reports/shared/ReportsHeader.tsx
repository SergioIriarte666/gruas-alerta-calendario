import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

export const ReportsHeader = () => (
  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
    <div>
      <span className="dashboard-section-kicker"><BarChart3 className="size-3.5" />Inteligencia del negocio</span>
      <h1 className="dashboard-section-title">Reportes</h1>
      <p className="dashboard-section-description">Métricas operativas, financieras y de rendimiento en una vista unificada.</p>
    </div>
      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
        <BarChart3 className="mr-1.5 size-3.5" />
        Analytics en tiempo real
      </Badge>
  </div>
);
