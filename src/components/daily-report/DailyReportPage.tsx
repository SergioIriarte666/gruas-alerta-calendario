import { parseDateValue } from '@/utils/calendarDate';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useDailyReport } from '@/hooks/useDailyReport';
import { formatForInput } from '@/utils/timezoneUtils';
import { useSettings } from '@/hooks/useSettings';
import { exportDailyReport } from '@/utils/reportExporter';
import { useToast } from '@/components/ui/custom-toast';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Truck,
  Users,
  FileText,
  TrendingUp,
  Building2
} from 'lucide-react';
import { ServicesSection } from './sections/ServicesSection';
import { CalendarSection } from './sections/CalendarSection';
import { FinancialSection } from './sections/FinancialSection';
import { OperationsSection } from './sections/OperationsSection';
import { SuppliersSection } from './sections/SuppliersSection';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { CraneDetailsModal } from '@/components/cranes/CraneDetailsModal';
import { InvoiceDetailsModal } from '@/components/invoices/InvoiceDetailsModal';
import { PaymentDetailsModal } from '@/components/payments/PaymentDetailsModal';
import { EventDetailsModal } from '@/components/calendar/EventDetailsModal';
import { OperatorDetailsModal } from '@/components/operators/OperatorDetailsModal';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("DailyReportPage");
const DailyReportPage = () => {
  const [selectedDate, setSelectedDate] = useState(businessClock.today());
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal states
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedCrane, setSelectedCrane] = useState<any>(null);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCraneModalOpen, setIsCraneModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const { data, loading, refetch } = useDailyReport(selectedDate);
  const { settings } = useSettings();
  const { toast } = useToast();

  const handlePreviousDay = () => {
    const date = parseDateValue(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatForInput(date));
  };

  const handleNextDay = () => {
    const date = parseDateValue(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(formatForInput(date));
  };

  const handleToday = () => {
    setSelectedDate(businessClock.today());
  };

  const handleExportPDF = async () => {
    if (!data || !settings) {
      toast({
        title: "Error",
        description: "No hay datos disponibles para exportar",
        type: "error"
      });
      return;
    }

    try {
      setIsExporting(true);
      await exportDailyReport({
        format: 'pdf',
        data,
        settings,
        appliedFilters: { selectedDate }
      });
      
      toast({
        title: "Éxito",
        description: "Informe diario exportado a PDF correctamente",
        type: "success"
      });
    } catch (error) {
      logger.error('Error exporting to PDF:', error);
      toast({
        title: "Error",
        description: "Error al exportar el informe a PDF",
        type: "error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data || !settings) {
      toast({
        title: "Error", 
        description: "No hay datos disponibles para exportar",
        type: "error"
      });
      return;
    }

    try {
      setIsExporting(true);
      await exportDailyReport({
        format: 'excel',
        data,
        settings,
        appliedFilters: { selectedDate }
      });
      
      toast({
        title: "Éxito",
        description: "Informe diario exportado a Excel correctamente",
        type: "success"
      });
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Error al exportar el informe a Excel", 
        type: "error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Modal handlers
  const handleViewService = (service: any) => {
    setSelectedService(service);
    setIsServiceModalOpen(true);
  };

  const handleViewEvent = (event: any) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceModalOpen(true);
  };

  const handleViewPayment = (payment: any) => {
    setSelectedPayment(payment);
    setIsPaymentModalOpen(true);
  };

  const handleViewCrane = (crane: any) => {
    setSelectedCrane(crane);
    setIsCraneModalOpen(true);
  };

  const handleViewOperator = (operator: any) => {
    setSelectedOperator(operator);
    setIsOperatorModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="daily-report-concept space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="dashboard-section-kicker">Control de jornada</div>
          <h1 className="dashboard-section-title">Resumen del día</h1>
          <p className="dashboard-section-description">
            Servicios, compromisos, finanzas y recursos para {data?.selectedDate}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={isExporting || !data}>
            <Download className="size-4" />
            PDF
          </Button>

          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || !data}
            className="dashboard-report-button"
          >
            <Download className="size-4" />
            Excel
          </Button>
        </div>
      </div>

      <Card className="daily-report-toolbar">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handlePreviousDay}>
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline ml-1">Día Anterior</span>
            </Button>

            <div className="flex min-w-0 items-center gap-2">
              <DatePickerInput
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Seleccionar fecha"
              />
              <Button variant="outline" size="sm" onClick={handleToday} className="hidden sm:inline-flex">
                Hoy
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={handleNextDay}>
              <span className="hidden sm:inline mr-1">Día Siguiente</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            variant="control"
            title="Total de tareas"
            value={data.summary.totalTasks}
            tone="primary"
            icon={FileText}
            description="Compromisos de la jornada"
          />
          <MetricCard
            variant="control"
            title="Tareas críticas"
            value={data.summary.criticalTasks}
            tone={data.summary.criticalTasks > 0 ? 'danger' : 'muted'}
            icon={AlertTriangle}
            description="Requieren atención prioritaria"
          />
          <MetricCard
            variant="control"
            title="Completitud"
            value={`${data.summary.completionRate.toFixed(1)}%`}
            tone="success"
            icon={TrendingUp}
            description="Avance de tareas del día"
          />
          <MetricCard
            variant="control"
            title="Alertas"
            value={data.summary.alerts}
            tone={data.summary.alerts > 0 ? 'warning' : 'muted'}
            icon={AlertTriangle}
            description="Eventos que revisar"
          />
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="services" className="daily-report-content space-y-4">
        <TabsList className="daily-report-tabs flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="services" className="flex min-w-fit items-center gap-2 rounded-lg px-3 py-2">
            <Truck className="size-4" />
            Servicios
            {data && data.services.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.services.total}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="calendar" className="flex min-w-fit items-center gap-2 rounded-lg px-3 py-2">
            <Calendar className="size-4" />
            Agenda
            {data && data.calendar.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.calendar.total}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="financial" className="flex min-w-fit items-center gap-2 rounded-lg px-3 py-2">
            <DollarSign className="size-4" />
            Financiero
            {data && (data.financial.invoicesDue.length + data.financial.paymentsToMake.length) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {data.financial.invoicesDue.length + data.financial.paymentsToMake.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="suppliers" className="flex min-w-fit items-center gap-2 rounded-lg px-3 py-2">
            <Building2 className="size-4" />
            Proveedores
            {data && data.financial.supplierPayments && (
              (data.financial.supplierPayments.overdue?.length || 0) + 
              (data.financial.supplierPayments.dueToday?.length || 0) + 
              (data.financial.supplierPayments.dueThisWeek?.length || 0)
            ) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {(data.financial.supplierPayments.overdue?.length || 0) + 
                 (data.financial.supplierPayments.dueToday?.length || 0) + 
                 (data.financial.supplierPayments.dueThisWeek?.length || 0)}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="operations" className="flex min-w-fit items-center gap-2 rounded-lg px-3 py-2">
            <Users className="size-4" />
            Operaciones
            {data && data.operations.documentAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {data.operations.documentAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesSection 
            data={data?.services} 
            onViewService={handleViewService}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarSection 
            data={data?.calendar}
            onViewEvent={handleViewEvent}
          />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialSection 
            data={data?.financial}
            onViewInvoice={handleViewInvoice}
            onViewPayment={handleViewPayment}
            onViewServiceToInvoice={handleViewService}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersSection 
            data={data?.financial.supplierPayments}
            onViewPayment={handleViewPayment}
          />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsSection 
            data={data?.operations}
            onViewCrane={handleViewCrane}
            onViewOperator={handleViewOperator}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ServiceDetailsModal
        service={selectedService}
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
      />

      <EventDetailsModal
        event={selectedEvent}
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
      />

      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />

      <PaymentDetailsModal
        payment={selectedPayment}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />

      <CraneDetailsModal
        crane={selectedCrane}
        isOpen={isCraneModalOpen}
        onClose={() => setIsCraneModalOpen(false)}
        onEdit={() => {}} // Empty handler since we're just viewing
      />

      <OperatorDetailsModal
        operator={selectedOperator}
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
      />
    </div>
  );
};

export default DailyReportPage;
