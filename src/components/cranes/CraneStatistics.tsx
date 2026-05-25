import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Calendar,
  DollarSign,
  Percent,
  Clock,
  Target
} from 'lucide-react';
import { Crane } from '@/types';
import { useCraneStatistics } from '@/hooks/useCraneStatistics';

interface CraneStatisticsProps {
  crane: Crane;
}

// Componente de gráfico simple (placeholder)
const SimpleBarChart = ({ data, title }: { data: number[], title: string }) => (
  <div className="space-y-2">
    <p className="text-gray-300 text-sm">{title}</p>
    <div className="flex items-end space-x-1 h-16">
      {data.map((value, index) => (
        <div
          key={index}
          className="bg-tms-green/50 rounded-t-sm flex-1 min-w-[8px]"
          style={{ height: `${(value / Math.max(...data)) * 100}%` }}
        />
      ))}
    </div>
    <div className="flex justify-between text-xs text-gray-400">
      <span>Ene</span>
      <span>Feb</span>
      <span>Mar</span>
      <span>Abr</span>
      <span>May</span>
      <span>Jun</span>
    </div>
  </div>
);

export const CraneStatistics = ({ crane }: CraneStatisticsProps) => {
  const { data: statistics, isLoading } = useCraneStatistics(crane.id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="bg-white/5 border-tms-green/30">
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!statistics) return null;

  const currentMonth = new Date().getMonth();
  const last6Months = Array(6).fill(0).map((_, i) => {
    const monthIndex = (currentMonth - 5 + i + 12) % 12;
    return {
      services: statistics.monthlyServiceCounts[monthIndex] || 0,
      revenue: statistics.monthlyRevenue[monthIndex] || 0,
      fuel: statistics.fuelConsumption[monthIndex] || 0,
      maintenance: statistics.maintenanceCosts[monthIndex] || 0
    };
  });

  const yearToDateServices = statistics.totalServices;
  const yearToDateRevenue = statistics.totalRevenue;

  return (
    <div className="space-y-6">
      {/* Métricas Clave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Utilización</p>
                <p className="text-white text-2xl font-bold">{statistics.utilizationRate}%</p>
              </div>
              <Activity className="size-8 text-tms-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Eficiencia</p>
                <p className="text-white text-2xl font-bold">{statistics.efficiency}%</p>
              </div>
              <Target className="size-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Tiempo Promedio</p>
                <p className="text-white text-2xl font-bold">{statistics.averageServiceTime}h</p>
              </div>
              <Clock className="size-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Satisfacción</p>
                <p className="text-white text-2xl font-bold">{statistics.customerSatisfaction}/5</p>
              </div>
              <Percent className="size-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="size-5 text-tms-green" />
              Servicios por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart 
              data={last6Months.map(m => m.services)} 
              title="Número de servicios realizados"
            />
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-300">Total del año:</span>
                <span className="text-white font-bold">{yearToDateServices} servicios</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="size-5 text-tms-green" />
              Ingresos por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart 
              data={last6Months.map(m => m.revenue)} 
              title="Ingresos generados (CLP)"
            />
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-300">Total del año:</span>
                <span className="text-white font-bold">${(yearToDateRevenue / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis Operativo */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="size-5 text-tms-green" />
            Análisis Operativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="text-white font-medium mb-3">Rendimiento Mensual</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Servicios promedio:</span>
                  <span className="text-white">{Math.round(yearToDateServices / 6)} / mes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Ingresos promedio:</span>
                  <span className="text-white">${statistics.averageServiceValue > 0 ? (statistics.averageServiceValue / 1000).toFixed(0) : 0}K / servicio</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Crecimiento:</span>
                  <span className={statistics.yearOverYearGrowth >= 0 ? "text-green-400" : "text-red-400"}>
                    {statistics.yearOverYearGrowth >= 0 ? '+' : ''}{statistics.yearOverYearGrowth}% vs año anterior
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-3">Eficiencia Operativa</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Servicios a tiempo:</span>
                  <span className="text-white">{statistics.efficiency}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Cancelaciones:</span>
                  <span className="text-white">{statistics.totalServices > 0 ? Math.round((statistics.cancelledServices / statistics.totalServices) * 100) : 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Tiempo inactivo:</span>
                  <span className="text-white">{100 - statistics.utilizationRate}%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-3">Costos Operativos</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Combustible/mes:</span>
                  <span className="text-white">{Math.round(statistics.fuelConsumption.reduce((a, b) => a + b) / 12)}L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Mantenimiento/mes:</span>
                  <span className="text-white">${Math.round(statistics.maintenanceCosts.reduce((a, b) => a + b) / 12 / 1000)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Costo por servicio:</span>
                  <span className="text-white">${statistics.averageServiceValue > 0 ? (statistics.averageServiceValue / 1000).toFixed(0) : 0}K promedio</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativa de Consumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white">Consumo de Combustible</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart 
              data={last6Months.map(m => m.fuel)} 
              title="Litros consumidos por mes"
            />
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-300">Promedio mensual:</span>
                <span className="text-white">{Math.round(statistics.fuelConsumption.reduce((a, b) => a + b) / 12)} litros</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white">Costos de Mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart 
              data={last6Months.map(m => m.maintenance)} 
              title="Costos mensuales de mantenimiento"
            />
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-300">Promedio mensual:</span>
                <span className="text-white">${Math.round(statistics.maintenanceCosts.reduce((a, b) => a + b) / 12 / 1000)}K</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparativa con el Parque */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="size-5 text-tms-green" />
            Comparativa con el Parque de Grúas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-tms-green mb-2">2°</div>
              <div className="text-white font-medium">Posición en Ingresos</div>
              <div className="text-gray-400 text-sm">De 8 grúas totales</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">3°</div>
              <div className="text-white font-medium">Posición en Servicios</div>
              <div className="text-gray-400 text-sm">De 8 grúas totales</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">1°</div>
              <div className="text-white font-medium">Posición en Eficiencia</div>
              <div className="text-gray-400 text-sm">De 8 grúas totales</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};