import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDailyReport } from '@/hooks/useDailyReport';
import { formatForInput, formatForDisplay } from '@/utils/timezoneUtils';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Truck,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react';
import { ServicesSection } from './sections/ServicesSection';
import { CalendarSection } from './sections/CalendarSection';
import { FinancialSection } from './sections/FinancialSection';
import { OperationsSection } from './sections/OperationsSection';

const DailyReportPage = () => {
  const [selectedDate, setSelectedDate] = useState(formatForInput(new Date()));
  const { data, loading, refetch } = useDailyReport(selectedDate);

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatForInput(date));
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(formatForInput(date));
  };

  const handleToday = () => {
    setSelectedDate(formatForInput(new Date()));
  };

  const handleExportPDF = () => {
    // TODO: Implementar exportación a PDF
    console.log('Exportar a PDF');
  };

  const handleExportExcel = () => {
    // TODO: Implementar exportación a Excel
    console.log('Exportar a Excel');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Informe Diario</h1>
          <p className="text-muted-foreground">
            Compromisos y tareas para {data?.selectedDate}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>

          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handlePreviousDay}>
              <ChevronLeft className="w-4 h-4" />
              Día Anterior
            </Button>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
              <Button variant="ghost" size="sm" onClick={handleToday}>
                Hoy
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleNextDay}>
              Día Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tareas</p>
                  <p className="text-2xl font-bold">{data.summary.totalTasks}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tareas Críticas</p>
                  <p className="text-2xl font-bold text-red-500">{data.summary.criticalTasks}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">% Completitud</p>
                  <p className="text-2xl font-bold text-green-500">
                    {data.summary.completionRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alertas</p>
                  <p className="text-2xl font-bold text-orange-500">{data.summary.alerts}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Servicios
            {data && data.services.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.services.total}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Agenda
            {data && data.calendar.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.calendar.total}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financiero
            {data && (data.financial.invoicesDue.length + data.financial.paymentsToMake.length) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.financial.invoicesDue.length + data.financial.paymentsToMake.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Operaciones
            {data && data.operations.documentAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {data.operations.documentAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesSection data={data?.services} />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarSection data={data?.calendar} />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialSection data={data?.financial} />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsSection data={data?.operations} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DailyReportPage;