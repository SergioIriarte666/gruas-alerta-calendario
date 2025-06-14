
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { RecentServicesTable } from '@/components/dashboard/RecentServicesTable';
import { 
  Truck, 
  Users, 
  DollarSign, 
  FileText, 
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { metrics, recentServices, upcomingEvents, loading } = useDashboardData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-white/10" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 bg-white/10" />
          </div>
          <Skeleton className="h-96 bg-white/10" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Dashboard Principal
        </h1>
        <p className="text-gray-400">
          Vista general del sistema de gestión de grúas
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Servicios del Mes"
          value={metrics.monthlyServices}
          change="+12%"
          changeType="positive"
          icon={Truck}
          description="Servicios completados este mes"
        />
        
        <MetricCard
          title="Clientes Activos"
          value={metrics.activeClients}
          icon={Users}
          description="Clientes con servicios vigentes"
        />
        
        <MetricCard
          title="Ingresos del Mes"
          value={formatCurrency(metrics.monthlyRevenue)}
          change="+8%"
          changeType="positive"
          icon={DollarSign}
          description="Facturación del mes actual"
        />
        
        <MetricCard
          title="Facturas Vencidas"
          value={metrics.overdueInvoices}
          changeType={metrics.overdueInvoices > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          description="Requieren atención inmediata"
        />
      </div>

      {/* Service Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="En Curso"
          value={metrics.servicesByStatus.pending}
          icon={TrendingUp}
          description="Servicios pendientes"
        />
        
        <MetricCard
          title="Completados"
          value={metrics.servicesByStatus.completed}
          icon={FileText}
          description="Servicios terminados"
        />
        
        <MetricCard
          title="Cancelados"
          value={metrics.servicesByStatus.cancelled}
          icon={DollarSign}
          description="Servicios cancelados"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Services */}
        <div className="lg:col-span-2">
          <RecentServicesTable services={recentServices} />
        </div>

        {/* Alerts Panel */}
        <div>
          <AlertsPanel events={upcomingEvents} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
