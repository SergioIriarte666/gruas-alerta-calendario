
import React, { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';

const Dashboard: React.FC = () => {
  const { metrics, recentServices, upcomingEvents, loading: dashboardLoading } = useDashboardData();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: selectedService, isLoading: detailsLoading } = useServiceDetails(selectedServiceId);

  const handleViewDetails = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };
  
  const handleCloseDetails = () => {
    setSelectedServiceId(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (dashboardLoading) {
    return (
      <div className="space-y-6 bg-white min-h-screen">
        {/* Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-gray-200" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 bg-gray-200" />
          </div>
          <Skeleton className="h-96 bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6 animate-fade-in bg-white min-h-screen" style={{ background: '#ffffff', color: '#000000' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-x-3 mb-2">
          <h1 className="text-3xl font-bold text-black">
            Dashboard Principal
          </h1>
          <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-600 mr-2 animate-pulse"></span>
            En vivo
          </Badge>
        </div>
        <p className="text-gray-600">
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
          linkTo="/services"
        />
        
        <MetricCard
          title="Clientes Activos"
          value={metrics.activeClients}
          icon={Users}
          description="Clientes con servicios vigentes"
          linkTo="/clients"
        />
        
        <MetricCard
          title="Ingresos del Mes"
          value={formatCurrency(metrics.monthlyRevenue)}
          change="+8%"
          changeType="positive"
          icon={DollarSign}
          description="Facturación del mes actual"
          linkTo="/invoices"
        />
        
        <MetricCard
          title="Facturas Vencidas"
          value={metrics.overdueInvoices}
          changeType={metrics.overdueInvoices > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          description="Requieren atención inmediata"
          linkTo="/invoices?status=overdue"
        />
      </div>

      {/* Service Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="En Curso"
          value={metrics.servicesByStatus.pending}
          icon={TrendingUp}
          description="Servicios pendientes"
          linkTo="/services?status=pending,in_progress"
        />
        
        <MetricCard
          title="Completados"
          value={metrics.servicesByStatus.completed}
          icon={FileText}
          description="Servicios terminados"
          linkTo="/services?status=completed"
        />
        
        <MetricCard
          title="Cancelados"
          value={metrics.servicesByStatus.cancelled}
          icon={DollarSign}
          description="Servicios cancelados"
          linkTo="/services?status=cancelled"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Services */}
        <div className="lg:col-span-2">
          <RecentServicesTable services={recentServices} onViewDetails={handleViewDetails} />
        </div>

        {/* Alerts Panel */}
        <div>
          <AlertsPanel events={upcomingEvents} />
        </div>
      </div>

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isOpen={!!selectedServiceId && !detailsLoading}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  );
};

export default Dashboard;
