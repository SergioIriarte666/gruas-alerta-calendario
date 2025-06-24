
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
      <div className="space-y-6 sm:space-y-8 bg-white min-h-screen p-4 sm:p-6">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 sm:h-10 w-60 sm:w-80 bg-gray-200" />
          <Skeleton className="h-5 sm:h-6 w-80 sm:w-96 bg-gray-200" />
        </div>
        
        {/* Primary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-36 bg-gray-200" />
          ))}
        </div>
        
        {/* Secondary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28 bg-gray-200" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          <div className="xl:col-span-2">
            <Skeleton className="h-80 sm:h-96 bg-gray-200" />
          </div>
          <Skeleton className="h-80 sm:h-96 bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in p-4 sm:p-6" style={{ background: '#ffffff', color: '#000000' }}>
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-x-4 mb-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">
              Dashboard Principal
            </h1>
            <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center px-3 py-1 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-600 mr-2 animate-pulse"></span>
              En vivo
            </Badge>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            Vista general del sistema de gestión de grúas
          </p>
        </div>

        {/* Primary Metrics - Main Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
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
    </div>
  );
};

export default Dashboard;
