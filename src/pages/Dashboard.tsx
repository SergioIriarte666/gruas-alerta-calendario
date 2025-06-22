
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
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 bg-white min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header Skeleton */}
        <div className="space-y-2 sm:space-y-4">
          <Skeleton className="h-6 sm:h-8 md:h-10 w-48 sm:w-60 md:w-80 bg-gray-200" />
          <Skeleton className="h-4 sm:h-5 md:h-6 w-64 sm:w-80 md:w-96 bg-gray-200" />
        </div>
        
        {/* Primary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28 md:h-32 lg:h-36 bg-gray-200" />
          ))}
        </div>
        
        {/* Secondary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 sm:h-24 md:h-28 bg-gray-200" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <div className="xl:col-span-2">
            <Skeleton className="h-64 sm:h-80 md:h-96 bg-gray-200" />
          </div>
          <Skeleton className="h-64 sm:h-80 md:h-96 bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in bg-white min-h-screen p-3 sm:p-4 md:p-6 lg:p-8" style={{ background: '#ffffff', color: '#000000' }}>
      {/* Header Section */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-black">
            Dashboard Principal
          </h1>
          <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center px-2 sm:px-3 py-1 w-fit text-xs sm:text-sm">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-600 mr-1.5 sm:mr-2 animate-pulse"></span>
            En vivo
          </Badge>
        </div>
        <p className="text-sm sm:text-base md:text-lg text-gray-600">
          Vista general del sistema de gestión de grúas
        </p>
      </div>

      {/* Primary Metrics - Main Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
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
          title="Facturas Vencidas"
          value={metrics.overdueInvoices}
          changeType={metrics.overdueInvoices > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          description="Requieren atención inmediata"
          linkTo="/invoices?status=overdue"
        />
      </div>

      {/* Secondary Metrics - Service Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <MetricCard
          title="En Curso"
          value={metrics.servicesByStatus.pending}
          icon={TrendingUp}
          description="Servicios pendientes y en progreso"
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
          icon={AlertTriangle}
          description="Servicios cancelados"
          linkTo="/services?status=cancelled"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* Recent Services */}
        <div className="xl:col-span-2">
          <RecentServicesTable services={recentServices} onViewDetails={handleViewDetails} />
        </div>

        {/* Alerts Panel */}
        <div className="xl:col-span-1">
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
