import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClosureAutomationCalendar from './ClosureAutomationCalendar';
import ClientClosureDashboard from './ClientClosureDashboard';
import ServiceReviewPanel from './ServiceReviewPanel';
import { useClosureAutomation } from '@/hooks/useClosureAutomation';
import { useServiceClosures } from '@/hooks/useServiceClosures';
import { ServiceClosure } from '@/types';
import { useToast } from '@/components/ui/custom-toast';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { detectPurchaseOrders } from '@/utils/closureUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Zap } from 'lucide-react';

interface ClientClosureData {
  client: any;
  services: any[];
  completedServices: number;
  pendingServices: number;
  totalAmount: number;
  hasIssues: boolean;
  issues: string[];
}

interface AutomatedClosureWorkflowProps {
  onBack: () => void;
}

const AutomatedClosureWorkflow = ({ onBack }: AutomatedClosureWorkflowProps) => {
  const [currentView, setCurrentView] = useState<'calendar' | 'dashboard' | 'review'>('calendar');
  const [selectedClient, setSelectedClient] = useState<ClientClosureData | null>(null);
  
  const {
    selectedMonth,
    setSelectedMonth,
    clientsData,
    loading,
    clientsSummary,
    completeService,
    refetch
  } = useClosureAutomation();
  
  const { createClosure } = useServiceClosures();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleMonthChange = (date: Date) => {
    setSelectedMonth(date);
    if (currentView === 'review') {
      setCurrentView('dashboard');
      setSelectedClient(null);
    }
  };

  const handleReviewClient = (clientData: ClientClosureData) => {
    setSelectedClient(clientData);
    setCurrentView('review');
  };

  const handleCreateClosure = async (clientData: ClientClosureData, selectedServices?: any[]) => {
    try {
      const servicesToInclude = selectedServices || clientData.services.filter(s => s.canInclude);
      
      if (servicesToInclude.length === 0) {
        toast({
          type: "error",
          title: "Error",
          description: "No hay servicios válidos para incluir en el cierre.",
        });
        return;
      }

      const dateFrom = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const dateTo = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
      
      const closureData = {
        dateRange: { 
          from: dateFrom.toISOString().split('T')[0], 
          to: dateTo.toISOString().split('T')[0] 
        },
        clientId: clientData.client.id,
        serviceIds: servicesToInclude.map(s => s.id),
        total: calculateClosureTotal(servicesToInclude),
        status: 'open' as const,
        purchaseOrder: detectPurchaseOrders(servicesToInclude)
      };

      const newClosure = await createClosure(closureData);
      
      toast({
        type: "success",
        title: "Cierre creado exitosamente",
        description: `Se creó el cierre para ${clientData.client.name} con ${servicesToInclude.length} servicio(s).`,
      });

      // Ask if user wants to proceed with invoicing
      const proceed = window.confirm(
        `¿Desea proceder con la facturación del cierre "${newClosure.folio}"?`
      );
      
      if (proceed) {
        navigate('/invoices', { 
          state: { 
            preselectedClosureId: newClosure.id 
          } 
        });
      } else {
        // Refresh data and return to dashboard
        await refetch();
        setCurrentView('dashboard');
        setSelectedClient(null);
      }
    } catch (error) {
      console.error('Error creating closure:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo crear el cierre. Inténtalo de nuevo.",
      });
    }
  };

  const handleCompleteService = async (serviceId: string) => {
    await completeService(serviceId);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'calendar':
        return (
          <ClosureAutomationCalendar
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            clientsSummary={clientsSummary}
          />
        );
      
      case 'dashboard':
        return (
          <ClientClosureDashboard
            selectedMonth={selectedMonth}
            clientsData={clientsData}
            loading={loading}
            onReviewClient={handleReviewClient}
            onCreateClosure={handleCreateClosure}
          />
        );
      
      case 'review':
        return selectedClient ? (
          <ServiceReviewPanel
            clientName={selectedClient.client.name}
            services={selectedClient.services}
            totalAmount={selectedClient.totalAmount}
            onBack={() => {
              setCurrentView('dashboard');
              setSelectedClient(null);
            }}
            onCreateClosure={(selectedServices) => 
              handleCreateClosure(selectedClient, selectedServices)
            }
            onCompleteService={handleCompleteService}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  Asistente de Automatización de Cierres
                  <Zap className="h-5 w-5 text-yellow-500" />
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Sistema inteligente para automatizar el proceso de cierre de servicios
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Navigation Breadcrumb */}
      {(currentView === 'dashboard' || currentView === 'review') && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setCurrentView('calendar')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Seleccionar período
              </button>
              <span className="text-muted-foreground">›</span>
              
              {currentView === 'dashboard' ? (
                <span className="text-foreground font-medium">Dashboard de clientes</span>
              ) : (
                <>
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dashboard de clientes
                  </button>
                  <span className="text-muted-foreground">›</span>
                  <span className="text-foreground font-medium">
                    Revisar servicios - {selectedClient?.client.name}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {currentView === 'calendar' && clientsSummary.total > 0 && (
        <Card className="border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Se encontraron <strong>{clientsSummary.total}</strong> cliente(s) con servicios en el período seleccionado
              </p>
              <Button
                onClick={() => setCurrentView('dashboard')}
                className="bg-primary hover:bg-primary/90"
              >
                Ver Dashboard de Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {renderCurrentView()}
    </div>
  );
};

export default AutomatedClosureWorkflow;