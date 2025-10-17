
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Calendar,
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

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

const MetricCard = ({ title, value, icon: Icon, trend, status = 'info' }: MetricCardProps) => {
  const statusColors = {
    success: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
    info: 'border-tms-green/30 bg-white/5'
  };

  const iconColors = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    info: 'text-tms-green'
  };

  return (
    <Card className={`${statusColors[status]} border transition-all hover:border-opacity-50`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300 text-sm">{title}</p>
            <p className="text-white text-2xl font-bold mt-1">{value}</p>
            {trend && (
              <p className="text-gray-400 text-xs mt-1">{trend}</p>
            )}
          </div>
          <Icon className={`w-8 h-8 ${iconColors[status]}`} />
        </div>
      </CardContent>
    </Card>
  );
};

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
        console.warn('Date is null or undefined:', date);
        return 0;
      }
      const expiry = new Date(date);
      if (isNaN(expiry.getTime())) {
        console.warn('Invalid date:', date);
        return 0;
      }
      const today = new Date();
      const diffTime = expiry.getTime() - today.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days;
    } catch (error) {
      console.error('Error calculating days until expiry:', error, 'Date:', date);
      return 0;
    }
  };

  // Calcular días con valores seguros
  const technicalReviewDays = crane?.technicalReviewExpiry ? getDaysUntilExpiry(crane.technicalReviewExpiry) : 0;
  const insuranceDays = crane?.insuranceExpiry ? getDaysUntilExpiry(crane.insuranceExpiry) : 0;
  const permitDays = crane?.circulationPermitExpiry ? getDaysUntilExpiry(crane.circulationPermitExpiry) : 0;

  console.log('🔍 DEBUG: Crane documentation data:', {
    crane: crane?.licensePlate,
    technicalReview: crane?.technicalReviewExpiry,
    insurance: crane?.insuranceExpiry,
    permit: crane?.circulationPermitExpiry,
    days: { technicalReviewDays, insuranceDays, permitDays }
  });

  console.log('🚨 DOCUMENTACIÓN SECCIÓN DEBE APARECER SIEMPRE');

  if (isLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando métricas...</div>
      </div>
    );
  }

  const getExpiryStatus = (days: number) => {
    if (days <= 0) return 'danger';
    if (days <= 30) return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6">
      {/* Estado General */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Estado General</h3>
          <p className="text-gray-300">Resumen de métricas clave</p>
        </div>
        <Badge 
          variant={crane.isActive ? "default" : "secondary"}
          className={crane.isActive 
            ? "bg-tms-green/20 text-tms-green border-tms-green/50" 
            : "bg-gray-600/20 text-gray-400 border-gray-600/50"
          }
        >
          {crane.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      {/* Métricas de Servicios */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Servicios</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Servicios"
            value={metrics?.totalServices || 0}
            icon={Truck}
            trend="Este mes"
            status="info"
          />
          <MetricCard
            title="Completados"
            value={metrics?.completedServices || 0}
            icon={CheckCircle}
            trend={`${metrics?.totalServices ? Math.round(((metrics.completedServices || 0) / metrics.totalServices) * 100) : 0}% tasa éxito`}
            status="success"
          />
          <MetricCard
            title="Pendientes"
            value={metrics?.pendingServices || 0}
            icon={Clock}
            trend="Por realizar"
            status={(metrics?.pendingServices || 0) > 5 ? "warning" : "info"}
          />
          <MetricCard
            title="Ingresos Mes"
            value={`$${((metrics?.monthlyRevenue || 0) / 1000).toFixed(0)}K`}
            icon={DollarSign}
            trend="Este mes"
            status="success"
          />
        </div>
      </div>

      {/* Métricas de Inventario y Costos */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Inventario y Costos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Piezas Instaladas"
            value={inventoryMetrics?.totalPartsInstalled || 0}
            icon={Package}
            trend="Directas + Consumos"
            status="info"
          />
          <MetricCard
            title="Valor Total Piezas"
            value={`$${((inventoryMetrics?.totalValue || 0) / 1000).toFixed(0)}K`}
            icon={Warehouse}
            trend="Inversión acumulada"
            status="success"
          />
          <MetricCard
            title="Compras Recientes"
            value={inventoryMetrics?.recentPurchases || 0}
            icon={ShoppingCart}
            trend="Últimos 30 días"
            status={(inventoryMetrics?.recentPurchases || 0) > 5 ? "warning" : "info"}
          />
          <MetricCard
            title="Gasto Mensual"
            value={`$${((metrics?.maintenanceCosts || 0) / 1000).toFixed(0)}K`}
            icon={TrendingUp}
            trend="Costos de mantenimiento"
            status="info"
          />
        </div>
      </div>

      {/* Gestión de Documentos */}
      <CraneDocumentsSection crane={crane} />

      {/* Eficiencia y Rendimiento */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Rendimiento</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Tasa Utilización"
            value={`${metrics?.utilizationRate || 0}%`}
            icon={Activity}
            trend="Promedio mensual"
            status={(metrics?.utilizationRate || 0) >= 80 ? "success" : "warning"}
          />
          <MetricCard
            title="Eficiencia"
            value={`${metrics?.efficiency || 0}%`}
            icon={TrendingUp}
            trend="Servicios a tiempo"
            status={(metrics?.efficiency || 0) >= 90 ? "success" : "warning"}
          />
          <MetricCard
            title="Costos Mantención"
            value={`$${((metrics?.maintenanceCosts || 0) / 1000).toFixed(0)}K`}
            icon={AlertTriangle}
            trend="Este mes"
            status="info"
          />
        </div>
      </div>

      {/* Alertas si las hay */}
      {(technicalReviewDays <= 30 || insuranceDays <= 30 || permitDays <= 30 || (inventoryMetrics?.pendingMaintenanceAlerts || 0) > 0) && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {technicalReviewDays <= 30 && (
                <p className="text-yellow-300">
                  • Revisión técnica {technicalReviewDays <= 0 ? 'vencida' : `vence en ${technicalReviewDays} días`}
                </p>
              )}
              {insuranceDays <= 30 && (
                <p className="text-yellow-300">
                  • Seguro {insuranceDays <= 0 ? 'vencido' : `vence en ${insuranceDays} días`}
                </p>
              )}
              {permitDays <= 30 && (
                <p className="text-yellow-300">
                  • Permiso de circulación {permitDays <= 0 ? 'vencido' : `vence en ${permitDays} días`}
                </p>
              )}
              {(inventoryMetrics?.pendingMaintenanceAlerts || 0) > 0 && (
                <p className="text-yellow-300">
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
