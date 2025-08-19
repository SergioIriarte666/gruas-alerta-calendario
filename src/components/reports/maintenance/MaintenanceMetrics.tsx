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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Costo Total Mantenimiento
          </CardTitle>
          <Wrench className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(data.totalMaintenanceCost)}
          </div>
          <p className="text-xs text-green-400">
            {maintenancePercentage.toFixed(1)}% del total
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Costo Total Partes
          </CardTitle>
          <Package className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(data.totalPartsCost)}
          </div>
          <p className="text-xs text-orange-400">
            {partsPercentage.toFixed(1)}% del total
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Intervenciones
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {data.totalInterventions}
          </div>
          <p className="text-xs text-gray-400">
            Mantenimientos y partes
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Costo Promedio
          </CardTitle>
          <Calculator className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(data.averageMaintenanceCost)}
          </div>
          <p className="text-xs text-gray-400">
            Por intervención
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Proveedores Activos
          </CardTitle>
          <Users className="h-4 w-4 text-cyan-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {data.topProviders.length}
          </div>
          <p className="text-xs text-gray-400">
            Proveedores únicos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};