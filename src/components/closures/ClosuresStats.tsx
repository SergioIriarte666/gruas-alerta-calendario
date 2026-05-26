import { FileText, Calendar, DollarSign } from 'lucide-react';
import { MetricCard } from '@/components/ui/metric-card';
import { ServiceClosure } from '@/types';

interface ClosuresStatsProps {
  closures: ServiceClosure[];
}

const ClosuresStats = ({ closures }: ClosuresStatsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard
        title="Cierres Abiertos"
        value={closures.filter(c => c.status === 'open').length}
        description="Pendientes de revisión o cierre"
        icon={FileText}
        tone="warning"
      />
      <MetricCard
        title="Cierres Cerrados"
        value={closures.filter(c => c.status === 'closed').length}
        description="Listos para facturación"
        icon={Calendar}
        tone="info"
      />
      <MetricCard
        title="Total Facturado"
        value={formatCurrency(closures.filter(c => c.status === 'invoiced').reduce((sum, c) => sum + c.total, 0))}
        description="Monto ya facturado"
        icon={DollarSign}
        tone="success"
      />
    </div>
  );
};

export default ClosuresStats;
