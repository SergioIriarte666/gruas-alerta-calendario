
import React, { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { RecentServicesTable } from '@/components/dashboard/RecentServicesTable';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { 
  Truck, 
  Users, 
  DollarSign, 
  FileText, 
  AlertTriangle,
  TrendingUp,
  WifiOff,
  Download
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { metrics, recentServices, upcomingEvents, loading: dashboardLoading, isOfflineData, noCache } = useDashboardData();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const navigate = useNavigate();

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

  // CRITICAL: Handle no data case - show helpful message instead of blank screen
  if (!metrics) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-amber-600" />
              </div>
              <CardTitle className="text-amber-800">
                {noCache ? 'Sin datos offline disponibles' : 'Error al cargar datos'}
              </CardTitle>
              <CardDescription className="text-amber-700">
                {noCache 
                  ? 'No se encontraron datos en el cache local. Para usar el modo offline, primero descarga los datos cuando tengas conexión.'
                  : 'Hubo un problema al cargar los datos del dashboard.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button 
                onClick={() => navigate('/settings')}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Ir a Configuración Offline
              </Button>
              <p className="text-sm text-amber-600 mt-4">
                En Configuración → Modo Offline, usa "Descargar datos ahora" para preparar el modo sin conexión.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in p-4 sm:p-6" style={{ background: '#ffffff', color: '#000000' }}>
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-x-4 mb-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">
              Dashboard Principal
            </h1>
            {isOfflineData ? (
              <Badge className="bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center px-3 py-1 w-fit">
                <WifiOff className="w-3 h-3 mr-2" />
                Datos Offline
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center px-3 py-1 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-600 mr-2 animate-pulse"></span>
                En vivo
              </Badge>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            Vista general del sistema de gestión de grúas
            {isOfflineData && <span className="text-amber-600 ml-2">(mostrando datos guardados localmente)</span>}
          </p>
        </div>

        {/* Primary Metrics - Main Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Ingresos del Mes"
            value={formatCurrency(metrics.monthlyRevenue)}
            change={metrics.revenueChange !== 0 ? `${metrics.revenueChange > 0 ? '+' : ''}${metrics.revenueChange.toFixed(1)}%` : undefined}
            changeType={metrics.revenueChange > 0 ? "positive" : metrics.revenueChange < 0 ? "negative" : "neutral"}
            icon={DollarSign}
            description={`Facturación del mes actual • Mes anterior: ${formatCurrency(metrics.previousMonthRevenue)}`}
            linkTo="/invoices"
          />
          
          <MetricCard
            title="Servicios del Mes"
            value={metrics.monthlyServices}
            change={metrics.servicesChange !== 0 ? `${metrics.servicesChange > 0 ? '+' : ''}${metrics.servicesChange.toFixed(1)}%` : undefined}
            changeType={metrics.servicesChange > 0 ? "positive" : metrics.servicesChange < 0 ? "negative" : "neutral"}
            icon={Truck}
            description={`Servicios completados este mes • Mes anterior: ${metrics.previousMonthServices}`}
            linkTo="/services"
          />
          
          <MetricCard
            title="Servicios Futuros"
            value={metrics.futureServices}
            icon={Users}
            description="Servicios programados próximamente"
            linkTo="/services?future=true"
          />
          
          <MetricCard
            title="Facturas Vencidas"
            value={isOfflineData ? 'N/D' : metrics.overdueInvoices}
            changeType={!isOfflineData && metrics.overdueInvoices > 0 ? "negative" : "neutral"}
            icon={AlertTriangle}
            description={isOfflineData ? "No disponible offline" : "Requieren atención inmediata"}
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

        {/* Invoice Alerts Dashboard - Only show when online */}
        {!isOfflineData && (
          <div className="mb-6">
            <InvoiceAlertsDashboard />
          </div>
        )}
        
        {/* Offline notice for invoice alerts */}
        {isOfflineData && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-700">
                  Las alertas de facturas no están disponibles en modo offline. Conecta a internet para ver el estado de las facturas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Recent Services */}
          <div className="xl:col-span-2">
            <RecentServicesTable services={recentServices} onViewDetails={handleViewDetails} />
          </div>

          {/* Alerts Panel */}
          <div className="xl:col-span-1">
            <AlertsPanel />
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
