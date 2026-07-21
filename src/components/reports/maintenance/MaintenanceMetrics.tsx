import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaintenanceReportData } from '@/hooks/reports/useMaintenanceReport';
import { Wrench, Package, TrendingUp, Calculator, Users } from 'lucide-react';

interface MaintenanceMetricsProps {
  data: MaintenanceReportData;
}

export const MaintenanceMetrics = ({ data }: MaintenanceMetricsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalCost = data.totalMaintenanceCost + data.totalPartsCost;
  const maintenancePercentage = totalCost > 0 ? (data.totalMaintenanceCost / totalCost) * 100 : 0;
  const partsPercentage = totalCost > 0 ? (data.totalPartsCost / totalCost) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Costo Total Mantenimiento
          </CardTitle>
          <Wrench className="size-4 text-info-text" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(data.totalMaintenanceCost)}
          </div>
          <p className="text-xs text-foreground">
            {maintenancePercentage.toFixed(1)}% del total
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Costo Total Partes
          </CardTitle>
          <Package className="size-4 text-warning-text" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(data.totalPartsCost)}
          </div>
          <p className="text-xs text-foreground">
            {partsPercentage.toFixed(1)}% del total
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Total Intervenciones
          </CardTitle>
          <TrendingUp className="size-4 text-success-text" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {data.totalInterventions}
          </div>
          <p className="text-xs text-foreground">
            Mantenimientos y partes
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Costo Promedio
          </CardTitle>
          <Calculator className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(data.averageMaintenanceCost)}
          </div>
          <p className="text-xs text-foreground">
            Por intervención
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Proveedores Activos
          </CardTitle>
          <Users className="size-4 text-info-text" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {data.topProviders.length}
          </div>
          <p className="text-xs text-foreground">
            Proveedores únicos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};