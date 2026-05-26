import { MetricCard } from '@/components/ui/metric-card';
import { Users, Building2, TrendingUp, DollarSign } from 'lucide-react';

interface ClientsDashboardProps {
  activeClients: number;
  inactiveClients: number;
  uniqueCompanies: number;
  activeServices: number;
  pendingInvoiceAmount: number;
}

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
};

export const ClientsDashboard = ({ activeClients, inactiveClients, uniqueCompanies, activeServices, pendingInvoiceAmount }: ClientsDashboardProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Clientes Activos"
        value={activeClients}
        description={`${inactiveClients} inactivos`}
        icon={Users}
        tone="primary"
      />
      <MetricCard
        title="Empresas Únicas"
        value={uniqueCompanies}
        description="Agrupadas por RUT"
        icon={Building2}
        tone="info"
      />
      <MetricCard
        title="Servicios Activos"
        value={activeServices}
        description="Clientes con actividad en pipeline"
        icon={TrendingUp}
        tone="warning"
      />
      <MetricCard
        title="Fact. Pendiente"
        value={formatCompactCurrency(pendingInvoiceAmount)}
        description="Monto total por cobrar"
        icon={DollarSign}
        tone="success"
      />
    </div>
  );
};
