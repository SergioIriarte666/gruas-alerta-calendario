import { businessClock } from '@/utils/businessClock';

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
    return businessClock.dateLabel(dateString, 'es-CL');
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
            <CardTitle className="text-foreground">Análisis Detallado por Grúa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-foreground">Grúa</TableHead>
                    <TableHead className="text-foreground">Marca/Modelo</TableHead>
                    <TableHead className="text-foreground">Costo Mantenimiento</TableHead>
                    <TableHead className="text-foreground">Costo Partes</TableHead>
                    <TableHead className="text-foreground">Total Intervenciones</TableHead>
                    <TableHead className="text-foreground">Último Mantenimiento</TableHead>
                    <TableHead className="text-foreground">Próximo Mantenimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.craneAnalysis
                    .sort((a, b) => (b.totalMaintenanceCost + b.totalPartsCost) - (a.totalMaintenanceCost + a.totalPartsCost))
                    .map((crane) => (
                    <TableRow key={crane.craneId} className="border-border">
                      <TableCell className="text-foreground font-medium">
                        {crane.licensePlate}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {crane.brand} {crane.model}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatCurrency(crane.totalMaintenanceCost)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatCurrency(crane.totalPartsCost)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {crane.interventionCount}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatDate(crane.lastMaintenance)}
                      </TableCell>
                      <TableCell className="text-foreground">
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
            <CardTitle className="text-foreground">Top Proveedores por Volumen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-foreground">Proveedor</TableHead>
                    <TableHead className="text-foreground">Costo Total</TableHead>
                    <TableHead className="text-foreground">Número de Intervenciones</TableHead>
                    <TableHead className="text-foreground">Costo Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProviders.map((provider, index) => (
                    <TableRow key={provider.provider} className="border-border">
                      <TableCell className="text-foreground font-medium">
                        #{index + 1} {provider.provider}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatCurrency(provider.totalCost)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {provider.interventionCount}
                      </TableCell>
                      <TableCell className="text-foreground">
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
            <CardTitle className="text-foreground">Análisis de Partes y Repuestos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-foreground">Parte</TableHead>
                    <TableHead className="text-foreground">Proveedor</TableHead>
                    <TableHead className="text-foreground">Cantidad Total</TableHead>
                    <TableHead className="text-foreground">Costo Total</TableHead>
                    <TableHead className="text-foreground">Grúas Afectadas</TableHead>
                    <TableHead className="text-foreground">Costo Unitario Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.partsAnalysis.length > 0 ? (
                    data.partsAnalysis
                      .sort((a, b) => b.totalCost - a.totalCost)
                      .slice(0, 20)
                      .map((part, _index) => (
                      <TableRow key={`${part.partName}-${part.supplier}`} className="border-border">
                        <TableCell className="text-foreground font-medium">
                          {part.partName}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {part.supplier}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {part.quantity}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatCurrency(part.totalCost)}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {part.craneCount}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatCurrency(part.totalCost / part.quantity)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-border">
                      <TableCell colSpan={6} className="text-center text-foreground py-8">
                        <div className="flex flex-col items-center gap-y-2">
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
              <CardTitle className="text-foreground">Grúas con Mayor Costo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                    <TableHead className="text-foreground">Grúa</TableHead>
                    <TableHead className="text-foreground">Costo Total</TableHead>
                    <TableHead className="text-foreground">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictiveInsights.highCostCranes.map((crane) => (
                      <TableRow key={crane.craneId} className="border-border">
                        <TableCell className="text-foreground font-medium">
                          {crane.licensePlate}
                        </TableCell>
                        <TableCell className="text-foreground">
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
              <CardTitle className="text-foreground">Problemas Más Frecuentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-foreground">Problema</TableHead>
                      <TableHead className="text-foreground">Frecuencia</TableHead>
                      <TableHead className="text-foreground">Costo Promedio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictiveInsights.frequentIssues.map((issue, index) => (
                      <TableRow key={index} className="border-border">
                        <TableCell className="text-foreground font-medium max-w-xs truncate">
                          {issue.issue}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {issue.frequency}
                        </TableCell>
                        <TableCell className="text-foreground">
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