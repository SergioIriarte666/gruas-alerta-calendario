import { differenceInCalendarDates } from '@/utils/calendarDate';
import { parseDateValue } from '@/utils/calendarDate';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { SectionCard } from '@/components/ui/section-card';
import { 
  Truck, 
  CheckCircle, 
  Clock, 
  DollarSign,
  AlertTriangle,
  Activity,
  TrendingUp,
  Package,
  Warehouse,
  ShoppingCart
} from 'lucide-react';
import { Crane } from '@/types';
import { useCraneMetrics } from '@/hooks/useCraneMetrics';
import { useCraneInventoryMetrics } from '@/hooks/useCraneInventoryMetrics';
import { CraneDocumentsSection } from './CraneDocumentsSection';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';
import { getCraneStatusLabel } from '@/utils/craneStatus';


const logger = createLogger("CraneMetricsOverview");
interface CraneMetricsOverviewProps {
  crane: Crane;
}

export const CraneMetricsOverview = ({ crane }: CraneMetricsOverviewProps) => {
  const { data: metrics, isLoading } = useCraneMetrics(crane.id);
  const { data: inventoryMetrics, isLoading: inventoryLoading } = useCraneInventoryMetrics(crane.id);

  // Calcular días para vencimientos - SIMPLIFICADO Y DOCUMENTADO
  const getDaysUntilExpiry = (date: string) => {
    try {
      if (!date) {
        logger.warn('Date is null or undefined:', date);
        return 0;
      }
      const expiry = parseDateValue(date);
      if (isNaN(expiry.getTime())) {
        logger.warn('Invalid date:', date);
        return 0;
      }
      const today = businessClock.todayDate();
      const diffTime = differenceInCalendarDates(expiry, today);
      const days = diffTime;
      return days;
    } catch (error) {
      logger.error('Error calculating days until expiry:', error, 'Date:', date);
      return 0;
    }
  };

  // Calcular días con valores seguros
  const technicalReviewDays = crane?.technicalReviewExpiry ? getDaysUntilExpiry(crane.technicalReviewExpiry) : 0;
  const insuranceDays = crane?.insuranceExpiry ? getDaysUntilExpiry(crane.insuranceExpiry) : 0;
  const permitDays = crane?.circulationPermitExpiry ? getDaysUntilExpiry(crane.circulationPermitExpiry) : 0;

  if (isLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando métricas...</div>
      </div>
    );
  }

  const _getExpiryStatus = (days: number) => {
    if (days <= 0) return 'danger';
    if (days <= 30) return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6">
      {/* Estado General */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Estado General</h3>
          <p className="text-muted-foreground">Resumen de métricas clave</p>
        </div>
        <Badge 
          variant={crane.status === 'active' ? "default" : "secondary"}
          className={crane.status === 'active'
            ? "border-primary/20 bg-primary-soft text-foreground" 
            : "border-border bg-muted text-muted-foreground"
          }
        >
          {getCraneStatusLabel(crane.status)}
        </Badge>
      </div>

      {/* Métricas de Servicios */}
      <SectionCard title="Servicios" flush className="border-0 bg-transparent shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Servicios"
            value={metrics?.totalServices || 0}
            icon={Truck}
            description="Este mes"
            tone="primary"
          />
          <MetricCard
            title="Completados"
            value={metrics?.completedServices || 0}
            icon={CheckCircle}
            description={`${metrics?.totalServices ? Math.round(((metrics.completedServices || 0) / metrics.totalServices) * 100) : 0}% tasa éxito`}
            tone="success"
          />
          <MetricCard
            title="Pendientes"
            value={metrics?.pendingServices || 0}
            icon={Clock}
            description="Por realizar"
            tone={(metrics?.pendingServices || 0) > 5 ? "warning" : "info"}
          />
          <MetricCard
            title="Ingresos Mes"
            value={`$${((metrics?.monthlyRevenue || 0) / 1000).toFixed(0)}K`}
            icon={DollarSign}
            description="Este mes"
            tone="success"
          />
        </div>
      </SectionCard>

      {/* Métricas de Inventario y Costos */}
      <SectionCard title="Inventario y Costos" flush className="border-0 bg-transparent shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Piezas Instaladas"
            value={inventoryMetrics?.totalPartsInstalled || 0}
            icon={Package}
            description="Directas + Consumos"
            tone="primary"
          />
          <MetricCard
            title="Valor Total Piezas"
            value={`$${((inventoryMetrics?.totalValue || 0) / 1000).toFixed(0)}K`}
            icon={Warehouse}
            description="Inversión acumulada"
            tone="success"
          />
          <MetricCard
            title="Compras Recientes"
            value={inventoryMetrics?.recentPurchases || 0}
            icon={ShoppingCart}
            description="Últimos 30 días"
            tone={(inventoryMetrics?.recentPurchases || 0) > 5 ? "warning" : "info"}
          />
          <MetricCard
            title="Gasto Mensual"
            value={`$${((metrics?.maintenanceCosts || 0) / 1000).toFixed(0)}K`}
            icon={TrendingUp}
            description="Costos de mantenimiento"
            tone="warning"
          />
        </div>
      </SectionCard>

      {/* Gestión de Documentos */}
      <CraneDocumentsSection crane={crane} />

      {/* Eficiencia y Rendimiento */}
      <SectionCard title="Rendimiento" flush className="border-0 bg-transparent shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Tasa Utilización"
            value={`${metrics?.utilizationRate || 0}%`}
            icon={Activity}
            description="Promedio mensual"
            tone={(metrics?.utilizationRate || 0) >= 80 ? "success" : "warning"}
          />
          <MetricCard
            title="Eficiencia"
            value={`${metrics?.efficiency || 0}%`}
            icon={TrendingUp}
            description="Servicios a tiempo"
            tone={(metrics?.efficiency || 0) >= 90 ? "success" : "warning"}
          />
          <MetricCard
            title="Costos Mantención"
            value={`$${((metrics?.maintenanceCosts || 0) / 1000).toFixed(0)}K`}
            icon={AlertTriangle}
            description="Este mes"
            tone="warning"
          />
        </div>
      </SectionCard>

      {/* Alertas si las hay */}
      {(technicalReviewDays <= 30 || insuranceDays <= 30 || permitDays <= 30 || (inventoryMetrics?.pendingMaintenanceAlerts || 0) > 0) && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5" />
              Alertas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {technicalReviewDays <= 30 && (
                <p className="text-foreground">
                  • Revisión técnica {technicalReviewDays <= 0 ? 'vencida' : `vence en ${technicalReviewDays} días`}
                </p>
              )}
              {insuranceDays <= 30 && (
                <p className="text-foreground">
                  • Seguro {insuranceDays <= 0 ? 'vencido' : `vence en ${insuranceDays} días`}
                </p>
              )}
              {permitDays <= 30 && (
                <p className="text-foreground">
                  • Permiso de circulación {permitDays <= 0 ? 'vencido' : `vence en ${permitDays} días`}
                </p>
              )}
              {(inventoryMetrics?.pendingMaintenanceAlerts || 0) > 0 && (
                <p className="text-foreground">
                  • {inventoryMetrics?.pendingMaintenanceAlerts} alertas de mantenimiento pendientes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
