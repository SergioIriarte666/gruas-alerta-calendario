import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaintenanceReportData } from '@/hooks/reports/useMaintenanceReport';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MaintenanceTablesProps {
  data: MaintenanceReportData;
}

export const MaintenanceTables = ({ data }: MaintenanceTablesProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getTrendColor = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing': return 'destructive';
      case 'decreasing': return 'default';
      default: return 'secondary';
    }
  };

  const getTrendLabel = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing': return 'Creciente';
      case 'decreasing': return 'Decreciente';
      default: return 'Estable';
    }
  };

  return (
    <Tabs defaultValue="cranes" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="cranes">Análisis por Grúa</TabsTrigger>
        <TabsTrigger value="providers">Top Proveedores</TabsTrigger>
        <TabsTrigger value="parts">Análisis de Partes</TabsTrigger>
        <TabsTrigger value="insights">Insights Predictivos</TabsTrigger>
      </TabsList>

      <TabsContent value="cranes" className="space-y-4">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-white">Análisis Detallado por Grúa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-gray-300">Grúa</TableHead>
                    <TableHead className="text-gray-300">Marca/Modelo</TableHead>
                    <TableHead className="text-gray-300">Costo Mantenimiento</TableHead>
                    <TableHead className="text-gray-300">Costo Partes</TableHead>
                    <TableHead className="text-gray-300">Total Intervenciones</TableHead>
                    <TableHead className="text-gray-300">Último Mantenimiento</TableHead>
                    <TableHead className="text-gray-300">Próximo Mantenimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.craneAnalysis
                    .sort((a, b) => (b.totalMaintenanceCost + b.totalPartsCost) - (a.totalMaintenanceCost + a.totalPartsCost))
                    .map((crane) => (
                    <TableRow key={crane.craneId} className="border-border">
                      <TableCell className="text-white font-medium">
                        {crane.licensePlate}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {crane.brand} {crane.model}
                      </TableCell>
                      <TableCell className="text-white">
                        {formatCurrency(crane.totalMaintenanceCost)}
                      </TableCell>
                      <TableCell className="text-white">
                        {formatCurrency(crane.totalPartsCost)}
                      </TableCell>
                      <TableCell className="text-white">
                        {crane.interventionCount}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatDate(crane.lastMaintenance)}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatDate(crane.nextMaintenance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="providers" className="space-y-4">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-white">Top Proveedores por Volumen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-gray-300">Proveedor</TableHead>
                    <TableHead className="text-gray-300">Costo Total</TableHead>
                    <TableHead className="text-gray-300">Número de Intervenciones</TableHead>
                    <TableHead className="text-gray-300">Costo Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProviders.map((provider, index) => (
                    <TableRow key={provider.provider} className="border-border">
                      <TableCell className="text-white font-medium">
                        #{index + 1} {provider.provider}
                      </TableCell>
                      <TableCell className="text-white">
                        {formatCurrency(provider.totalCost)}
                      </TableCell>
                      <TableCell className="text-white">
                        {provider.interventionCount}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatCurrency(provider.totalCost / provider.interventionCount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="parts" className="space-y-4">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-white">Análisis de Partes y Repuestos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-gray-300">Parte</TableHead>
                    <TableHead className="text-gray-300">Proveedor</TableHead>
                    <TableHead className="text-gray-300">Cantidad Total</TableHead>
                    <TableHead className="text-gray-300">Costo Total</TableHead>
                    <TableHead className="text-gray-300">Grúas Afectadas</TableHead>
                    <TableHead className="text-gray-300">Costo Unitario Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.partsAnalysis.length > 0 ? (
                    data.partsAnalysis
                      .sort((a, b) => b.totalCost - a.totalCost)
                      .slice(0, 20)
                      .map((part, index) => (
                      <TableRow key={`${part.partName}-${part.supplier}`} className="border-border">
                        <TableCell className="text-white font-medium">
                          {part.partName}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {part.supplier}
                        </TableCell>
                        <TableCell className="text-white">
                          {part.quantity}
                        </TableCell>
                        <TableCell className="text-white">
                          {formatCurrency(part.totalCost)}
                        </TableCell>
                        <TableCell className="text-white">
                          {part.craneCount}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {formatCurrency(part.totalCost / part.quantity)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-border">
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <p className="text-lg">No hay datos de partes disponibles</p>
                          <p className="text-sm">
                            No se encontraron registros de partes para el período seleccionado.
                            Puede registrar partes desde la sección "Grúas" o verificar los filtros de fecha.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="insights" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-white">Grúas con Mayor Costo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-gray-300">Grúa</TableHead>
                      <TableHead className="text-gray-300">Costo Total</TableHead>
                      <TableHead className="text-gray-300">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictiveInsights.highCostCranes.map((crane) => (
                      <TableRow key={crane.craneId} className="border-border">
                        <TableCell className="text-white font-medium">
                          {crane.licensePlate}
                        </TableCell>
                        <TableCell className="text-white">
                          {formatCurrency(crane.totalCost)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTrendColor(crane.trend)}>
                            {getTrendLabel(crane.trend)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-white">Problemas Más Frecuentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-gray-300">Problema</TableHead>
                      <TableHead className="text-gray-300">Frecuencia</TableHead>
                      <TableHead className="text-gray-300">Costo Promedio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictiveInsights.frequentIssues.map((issue, index) => (
                      <TableRow key={index} className="border-border">
                        <TableCell className="text-white font-medium max-w-xs truncate">
                          {issue.issue}
                        </TableCell>
                        <TableCell className="text-white">
                          {issue.frequency}
                        </TableCell>
                        <TableCell className="text-white">
                          {formatCurrency(issue.avgCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
};