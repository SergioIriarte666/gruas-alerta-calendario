import React, { useState } from 'react';
import { usePaymentMetrics, useSupplierPaymentSummary } from '@/hooks/useSupplierPayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  DollarSign,
  AlertTriangle,
  Calendar,
  Users
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import PaymentMetricsDashboard from '@/components/dashboard/PaymentMetricsDashboard';
import { exportSupplierPaymentReport } from '@/utils/reports/supplierPaymentExporter';
import { useSettings } from '@/hooks/useSettings';
import { subDays, subWeeks, subMonths, subQuarters, subYears, format } from 'date-fns';

interface ReportFilters {
  period: 'week' | 'month' | 'quarter' | 'year';
  supplier_id?: string;
  status?: string;
}

export const SupplierPaymentReports: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({ period: 'month' });
  const [activeReport, setActiveReport] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  
  const { data: metrics, isLoading: metricsLoading } = usePaymentMetrics();
  const { data: supplierSummary, isLoading: summaryLoading } = useSupplierPaymentSummary();
  const { settings } = useSettings(); // Cambiar de { data: settings } a { settings }

  const getDateRange = () => {
    const today = new Date();
    let from: Date;
    
    switch (filters.period) {
      case 'week':
        from = subWeeks(today, 1);
        break;
      case 'quarter':
        from = subQuarters(today, 1);
        break;
      case 'year':
        from = subYears(today, 1);
        break;
      default: // month
        from = subMonths(today, 1);
    }
    
    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd')
    };
  };

  const exportToPDF = async () => {
    // El código usa las configuraciones reales si están disponibles
    const settingsToUse = settings || {
    // Solo usa estos valores por defecto si no se pueden cargar las configuraciones
    company: {
      name: 'Gruas 5 Norte',
      address: 'Panamericana Norte Km. 841, Copiapó',
      phone: '+56 9 62380627',
      email: 'asistencia@gruas5norte.cl',
      taxId: '76.769.841-0',
      logo: '/lovable-uploads/78862b77-e5f2-481b-a598-e35d7aca2690.png', // Usar el logotipo disponible
      folioFormat: 'SRV-{number}'
    },
    user: {
      language: 'es',
      theme: 'system',
      timezone: 'America/Santiago',
      useSystemTimezone: true,
      notifications: true,
      dateFormat: 'DD/MM/YYYY',
      currency: 'CLP'
    },
    system: {
      autoBackup: true,
      backupFrequency: 'daily',
      dataRetention: 12,
      maintenanceMode: false
    },
    notifications: {
      emailNotifications: true,
      serviceReminders: true,
      invoiceAlerts: true,
      overdueNotifications: true,
      systemUpdates: false
    }
  };
  
    // Permitir exportación incluso si supplierSummary está vacío
    const summaryToUse = supplierSummary || [];
    
    setIsExporting(true);
    try {
      const dateRange = getDateRange();
      await exportSupplierPaymentReport({
        format: 'pdf',
        metrics,
        supplierSummary: summaryToUse,
        upcomingPayments: metrics.upcoming_payments_7_days || [],
        overduePayments: metrics.overdue_payments || [],
        settings: settingsToUse,
        appliedFilters: {
          period: filters.period,
          supplier_id: filters.supplier_id,
          status: filters.status,
          dateRange
        }
      });
      toast.success('Reporte PDF generado exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al generar el reporte PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    // Validación más flexible y con fallbacks
    console.log('Datos para exportación:', { metrics, supplierSummary, settings });
    
    if (!metrics) {
      toast.error('No se pudieron cargar las métricas de pagos');
      return;
    }
    
    // Usar las mismas configuraciones mejoradas para Excel
    const settingsToUse = settings || {
      company: {
        name: 'Gruas 5 Norte',
        address: 'Panamericana Norte Km. 841, Copiapó',
        phone: '+56 9 62380627',
        email: 'asistencia@gruas5norte.cl',
        taxId: '76.769.841-0',
        logo: '/lovable-uploads/78862b77-e5f2-481b-a598-e35d7aca2690.png',
        folioFormat: 'SRV-{number}'
      },
      user: {
        language: 'es',
        theme: 'system',
        timezone: 'America/Santiago',
        useSystemTimezone: true,
        notifications: true,
        dateFormat: 'DD/MM/YYYY',
        currency: 'CLP'
      },
      system: {
        autoBackup: true,
        backupFrequency: 'daily',
        dataRetention: 12,
        maintenanceMode: false
      },
      notifications: {
        emailNotifications: true,
        serviceReminders: true,
        invoiceAlerts: true,
        overdueNotifications: true,
        systemUpdates: false
      }
    };
    
    // Permitir exportación incluso si supplierSummary está vacío
    const summaryToUse = supplierSummary || [];
    
    setIsExporting(true);
    try {
      const dateRange = getDateRange();
      await exportSupplierPaymentReport({
        format: 'excel',
        metrics,
        supplierSummary: summaryToUse,
        upcomingPayments: metrics.upcoming_payments_7_days || [],
        overduePayments: metrics.overdue_payments || [],
        settings: settingsToUse,
        appliedFilters: {
          period: filters.period,
          supplier_id: filters.supplier_id,
          status: filters.status,
          dateRange
        }
      });
      toast.success('Reporte Excel generado exitosamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Error al generar el reporte Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (metricsLoading || summaryLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reportes y Análisis</h2>
          <p className="text-gray-600">Análisis detallado de pagos a proveedores</p>
        </div>
        <div className="flex gap-2">
          <Select value={filters.period} onValueChange={(value: any) => setFilters({...filters, period: value})}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="quarter">Este Trimestre</SelectItem>
              <SelectItem value="year">Este Año</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={exportToPDF}
            disabled={isExporting || metricsLoading || summaryLoading}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isExporting ? 'Generando...' : 'PDF'}
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToExcel}
            disabled={isExporting || metricsLoading || summaryLoading}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Generando...' : 'Excel'}
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Pendiente</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.total_pending || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pagos Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(metrics?.total_overdue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Este Mes</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.total_scheduled_this_month || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Proveedores</p>
                <p className="text-2xl font-bold">{metrics?.suppliers_count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de reportes */}
      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="suppliers">Por Proveedor</TabsTrigger>
          <TabsTrigger value="cashflow">Flujo de Caja</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PaymentMetricsDashboard 
            onSchedulePayment={() => toast.info('Abrir programador de pagos')}
            onViewPayment={(paymentId) => toast.info(`Ver pago: ${paymentId}`)}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supplierSummary?.map((supplier) => (
                  <div key={supplier.supplier_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{supplier.supplier_name}</h4>
                      <div className="flex gap-4 text-sm text-gray-600 mt-1">
                        <span>Facturas: {supplier.invoices_count}</span>
                        <span>Términos: {supplier.average_payment_terms} días</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(supplier.total_pending)}</p>
                      {supplier.total_overdue > 0 && (
                        <p className="text-sm text-red-600">
                          Vencido: {formatCurrency(supplier.total_overdue)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proyección de Flujo de Caja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Gráfico de flujo de caja en desarrollo</p>
                <p className="text-sm mt-2">Se mostrará la proyección de pagos por período</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Tendencias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Análisis de tendencias en desarrollo</p>
                <p className="text-sm mt-2">Se mostrarán patrones de pago y análisis predictivo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};