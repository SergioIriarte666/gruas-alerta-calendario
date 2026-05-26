import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3 } from 'lucide-react';

export const ReportsHeader = () => (
  <PageHeader
    title="Reportes"
    description="Análisis y estadísticas del negocio con foco operativo, financiero y de rendimiento."
    actions={
      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
        <BarChart3 className="mr-1.5 size-3.5" />
        Analytics en tiempo real
      </Badge>
    }
  />
);
