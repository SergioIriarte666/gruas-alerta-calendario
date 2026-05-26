
import React, { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/metric-card';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { RecentServicesTable } from '@/components/dashboard/RecentServicesTable';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { PendingSummaryModal } from '@/components/dashboard/PendingSummaryModal';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { 
  Truck, 
  Activity,
  DollarSign, 
  FileText, 
  AlertTriangle,
  CalendarClock,
  Download
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { downloadPendingReportPDF } from '@/utils/pdf/pendingReportPDF';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { metrics, recentServices, loading: dashboardLoading } = useDashboardData();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      await downloadPendingReportPDF();
      toast.success('Reporte de pendientes descargado');
    } catch (e: any) {
      toast.error(`Error al generar reporte: ${e.message}`);
    } finally {
      setDownloadingReport(false);
    }
  };

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
      <div className="space-y-6 sm:space-y-8">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 sm:h-10 w-60 sm:w-80" />
          <Skeleton className="h-5 sm:h-6 w-80 sm:w-96" />
        </div>
        
        {/* Primary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-36" />
          ))}
        </div>
        
        {/* Secondary Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          <div className="xl:col-span-2">
            <Skeleton className="h-80 sm:h-96" />
          </div>
          <Skeleton className="h-80 sm:h-96" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <PendingSummaryModal />
      <section className="animate-fade-in space-y-6">
        <PageHeader
          title="Dashboard Principal"
          description="Vista ejecutiva del estado operativo, financiero y de alertas del sistema."
          badges={
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Actualizado en tiempo real
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="w-fit border-border/70 bg-card/70"
            >
              <Download className="mr-2 size-4" />
              {downloadingReport ? 'Generando...' : 'Reporte Pendientes'}
            </Button>
          }
        />

        <SectionCard
          flush
          className="border-border/70 bg-card/70 shadow-sm"
          contentClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Resumen del negocio</p>
            <p className="text-sm text-muted-foreground">Los indicadores combinan actividad del mes, pendientes y salud operativa.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            Datos consolidados para la jornada actual
          </div>
        </SectionCard>

        {/* Primary Metrics - Main Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Ingresos del Mes"
            value={formatCurrency(metrics.monthlyRevenue)}
            tone="primary"
            icon={DollarSign}
            description={`Mes anterior: ${formatCurrency(metrics.previousMonthRevenue)}`}
            trend={metrics.revenueChange !== 0 ? {
              value: metrics.revenueChange,
              direction: metrics.revenueChange > 0 ? 'up' : 'down',
              isPositive: metrics.revenueChange > 0,
              label: 'vs mes anterior',
            } : undefined}
          />
          
          <MetricCard
            title="Servicios del Mes"
            value={metrics.monthlyServices}
            tone="info"
            icon={Truck}
            description={`Mes anterior: ${metrics.previousMonthServices}`}
            trend={metrics.servicesChange !== 0 ? {
              value: metrics.servicesChange,
              direction: metrics.servicesChange > 0 ? 'up' : 'down',
              isPositive: metrics.servicesChange > 0,
              label: 'vs mes anterior',
            } : undefined}
          />
          
          <MetricCard
            title="Servicios Programados"
            value={metrics.futureServices}
            tone="warning"
            icon={CalendarClock}
            description="Servicios futuros con fecha comprometida"
          />
          
          <MetricCard
            title="Facturas Vencidas"
            value={metrics.overdueInvoices}
            tone={metrics.overdueInvoices > 0 ? "danger" : "muted"}
            icon={AlertTriangle}
            description="Requieren atención inmediata"
          />
        </div>

        {/* Secondary Metrics - Service Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="En Curso"
            value={metrics.servicesByStatus.pending}
            tone="warning"
            icon={Activity}
            description="Servicios pendientes y en progreso"
          />
          
          <MetricCard
            title="Completados"
            value={metrics.servicesByStatus.completed}
            tone="success"
            icon={FileText}
            description="Servicios terminados"
          />
          
          <MetricCard
            title="Cancelados"
            value={metrics.servicesByStatus.cancelled}
            tone="muted"
            icon={AlertTriangle}
            description="Servicios cancelados"
          />
        </div>

        {/* Invoice Alerts Dashboard */}
        <SectionCard
          title="Estado de Facturación"
          description="Alertas clave de cobranza y facturas próximas a vencer."
          flush
          className="border-border/70 bg-card/80"
        >
          <InvoiceAlertsDashboard />
        </SectionCard>

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
      </section>
    </div>
  );
};

export default Dashboard;
