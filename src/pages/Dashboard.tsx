
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/metric-card';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { RecentServicesTable } from '@/components/dashboard/RecentServicesTable';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { PendingSummaryModal } from '@/components/dashboard/PendingSummaryModal';
import { SectionCard } from '@/components/ui/section-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Truck, 
  Activity,
  DollarSign, 
  FileText, 
  AlertTriangle,
  CalendarClock,
  Download,
  Sparkles,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { downloadPendingReportPDF } from '@/utils/pdf/pendingReportPDF';
import { toast } from 'sonner';
import { useFleetCompliance } from '@/hooks/useFleetCompliance';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { formatForDisplay } from '@/utils/timezoneUtils';

const Dashboard: React.FC = () => {
  const { metrics, recentServices, loading: dashboardLoading } = useDashboardData();
  const { rows: fleetComplianceRows, counters } = useFleetCompliance();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [isComplianceDialogOpen, setIsComplianceDialogOpen] = useState(false);

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

  const notFitResources = fleetComplianceRows.filter((row) => row.worst_level === 'error');

  return (
    <div className="dashboard-concept space-y-6">
      <PendingSummaryModal />
      <section className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="dashboard-section-kicker">
              <Sparkles className="size-3.5" />
              Visión ejecutiva
            </div>
            <h2 className="dashboard-section-title">Resumen del negocio</h2>
            <p className="dashboard-section-description">
              Comparativa mensual, carga operativa y puntos que requieren atención.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="dashboard-live-badge">
              <span className="dashboard-live-dot" />
              Datos actualizados en tiempo real
            </span>
            <Button
              size="sm"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="dashboard-report-button"
            >
              <Download className="mr-1 size-4" />
              {downloadingReport ? 'Generando...' : 'Reporte de pendientes'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            variant="control"
            title="Ingresos del mes"
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
            variant="control"
            title="Servicios del mes"
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

          <Link
            to="/calendar"
            className="rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[hsl(var(--dashboard-lime))] focus-visible:ring-offset-2 hover:-translate-y-0.5"
            aria-label="Ver servicios programados en el calendario"
          >
            <MetricCard
              variant="control"
              title="Servicios programados"
              value={metrics.futureServices}
              tone="warning"
              icon={CalendarClock}
              description="Próximos servicios en calendario"
              className="h-full cursor-pointer"
            />
          </Link>

          <MetricCard
            variant="control"
            title="Facturas vencidas"
            value={metrics.overdueInvoices}
            tone={metrics.overdueInvoices > 0 ? "danger" : "muted"}
            icon={AlertTriangle}
            description="Requieren atención inmediata"
          />
        </div>

        <div className="dashboard-divider" />

        <div>
          <div className="dashboard-section-kicker">Pulso operativo</div>
          <h2 className="dashboard-section-title">Estado de los recursos</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            variant="control"
            title="En curso"
            value={metrics.servicesByStatus.pending}
            tone="warning"
            icon={Activity}
            description="Pendientes y en progreso"
          />

          <MetricCard
            variant="control"
            title="Completados"
            value={metrics.servicesByStatus.completed}
            tone="success"
            icon={FileText}
            description="Servicios terminados"
          />

          <MetricCard
            variant="control"
            title="Cancelados"
            value={metrics.servicesByStatus.cancelled}
            tone="muted"
            icon={AlertTriangle}
            description="Servicios cancelados"
          />

          <button
            type="button"
            onClick={() => setIsComplianceDialogOpen(true)}
            className="rounded-2xl text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[hsl(var(--dashboard-lime))] focus-visible:ring-offset-2"
          >
            <MetricCard
              variant="control"
              title="Recursos no aptos"
              value={counters.totalNotFit}
              tone={counters.totalNotFit > 0 ? 'danger' : 'success'}
              icon={AlertTriangle}
              description="Documentación vencida"
              className="h-full cursor-pointer"
            />
          </button>
        </div>

        <SectionCard
          title="Estado de facturación"
          description="Alertas clave de cobranza y facturas próximas a vencer."
          flush
          className="dashboard-section-card"
        >
          <InvoiceAlertsDashboard />
        </SectionCard>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RecentServicesTable services={recentServices} onViewDetails={handleViewDetails} />
          </div>
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

        <Dialog open={isComplianceDialogOpen} onOpenChange={setIsComplianceDialogOpen}>
          <DialogContent className="border-border/70 bg-card sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Recursos no aptos</DialogTitle>
              <DialogDescription>
                Grúas y operadores con documentos vencidos al día de hoy.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {notFitResources.length === 0 ? (
                <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-muted-foreground">
                  No hay recursos no aptos en este momento.
                </div>
              ) : (
                notFitResources.map((resource) => {
                  const tooltip = resource.next_item_label
                    ? `${resource.next_item_label}${resource.next_expiry_date ? ` · ${formatForDisplay(resource.next_expiry_date)}` : ''}`
                    : undefined;

                  return (
                    <div
                      key={`${resource.resource_type}-${resource.resource_id}`}
                      className="rounded-xl border border-border/70 bg-background/60 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{resource.resource_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {resource.resource_type === 'crane' ? 'Grúa' : 'Operador'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {resource.next_item_label || 'Sin detalle adicional'}
                            {resource.next_expiry_date ? ` · ${formatForDisplay(resource.next_expiry_date)}` : ''}
                          </p>
                        </div>

                        <ComplianceBadge
                          level={resource.worst_level}
                          tooltip={tooltip}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
};

export default Dashboard;
