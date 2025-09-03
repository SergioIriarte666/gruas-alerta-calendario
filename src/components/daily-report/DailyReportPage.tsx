import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDailyReport } from '@/hooks/useDailyReport';
import { formatForInput, formatForDisplay } from '@/utils/timezoneUtils';
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
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { CraneDetailsModal } from '@/components/cranes/CraneDetailsModal';
import { InvoiceDetailsModal } from '@/components/invoices/InvoiceDetailsModal';
import { PaymentDetailsModal } from '@/components/payments/PaymentDetailsModal';
import { EventDetailsModal } from '@/components/calendar/EventDetailsModal';
import { OperatorDetailsModal } from '@/components/operators/OperatorDetailsModal';

const DailyReportPage = () => {
  const [selectedDate, setSelectedDate] = useState(formatForInput(new Date()));
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
      console.error('Error exporting to PDF:', error);
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
      console.error('Error exporting to Excel:', error);
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

          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting || !data}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>

          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting || !data}>
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