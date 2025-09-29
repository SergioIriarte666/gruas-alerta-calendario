import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServiceClosures } from '@/hooks/useServiceClosures';
import { useClients } from '@/hooks/useClients';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import ClosureForm from '@/components/closures/ClosureForm';
import { EditClosureForm } from '@/components/closures/EditClosureForm';
import ClosuresHeader from '@/components/closures/ClosuresHeader';
import ClosuresStats from '@/components/closures/ClosuresStats';
import ClosuresSearch from '@/components/closures/ClosuresSearch';
import ClosuresTable from '@/components/closures/ClosuresTable';
import InvoiceConfirmationDialog from '@/components/closures/InvoiceConfirmationDialog';
import AutomatedClosureWorkflow from '@/components/closures/automation/AutomatedClosureWorkflow';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import ClosureReportForm from '@/components/closures/ClosureReportForm';
import { Bot, Zap } from 'lucide-react';

const Closures = () => {
  const { closures, loading, createClosure, updateClosure, deleteClosure, closeClosure } = useServiceClosures();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [editingClosure, setEditingClosure] = useState<ServiceClosure | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [createdClosure, setCreatedClosure] = useState<ServiceClosure | null>(null);
  const [showAutomation, setShowAutomation] = useState(false);

  console.log('Closures page render - closures:', closures.length, 'loading:', loading, 'showCreateModal:', showCreateModal);

  // Filter closures by search term and status
  const filteredClosures = closures.filter(closure => {
    const matchesSearch = closure.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         closure.status.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || closure.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string, folio: string) => {
    if (window.confirm(`¿Está seguro de eliminar el cierre "${folio}"?`)) {
      deleteClosure(id);
      toast.success("Cierre eliminado", {
        description: "El cierre ha sido eliminado exitosamente.",
      });
    }
  };

  const handleClose = (id: string, folio: string) => {
    if (window.confirm(`¿Está seguro de cerrar el periodo "${folio}"?`)) {
      closeClosure(id);
      toast.success("Cierre procesado", {
        description: "El cierre ha sido procesado exitosamente.",
      });
    }
  };

  const handleEdit = (closure: ServiceClosure) => {
    setEditingClosure(closure);
  };

  const handleUpdateClosure = async (data: any) => {
    if (!editingClosure) return;
    
    try {
      const updateData = {
        dateRange: {
          from: data.dateFrom,
          to: data.dateTo
        },
        clientId: data.clientId || undefined,
        status: data.status
      };
      
      await updateClosure(editingClosure.id, updateData);
      setEditingClosure(null);
      toast.success("Cierre actualizado", {
        description: "El cierre ha sido actualizado exitosamente.",
      });
    } catch (error) {
      console.error('Error updating closure:', error);
      toast.error("Error", {
        description: "No se pudo actualizar el cierre.",
      });
    }
  };

  const handleCreateClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('Creating closure with data:', closureData);
      const newClosure = await createClosure(closureData);
      setShowCreateModal(false);
      setCreatedClosure(newClosure);
      setShowInvoiceDialog(true);
      toast.success("Cierre creado", {
        description: "El cierre ha sido creado exitosamente.",
      });
    } catch (error) {
      console.error('Error creating closure:', error);
      toast.error("Error", {
        description: "No se pudo crear el cierre.",
      });
    }
  };

  const handleInvoiceConfirm = () => {
    if (createdClosure) {
      navigate('/invoices', { 
        state: { 
          preselectedClosureId: createdClosure.id 
        } 
      });
    }
    setShowInvoiceDialog(false);
    setCreatedClosure(null);
  };

  const handleInvoiceDialogClose = (open: boolean) => {
    setShowInvoiceDialog(open);
    if (!open) {
      setCreatedClosure(null);
    }
  };

  const handleShowCreateModal = () => {
    console.log('Opening create modal...');
    setShowCreateModal(true);
  };
  
  const handleShowReportSheet = () => {
    setShowReportSheet(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando cierres...</div>
      </div>
    );
  }

  if (editingClosure) {
    return (
      <div className="space-y-6">
        <EditClosureForm
          closure={editingClosure}
          onSubmit={handleUpdateClosure}
          onCancel={() => setEditingClosure(null)}
        />
      </div>
    );
  }

  if (showAutomation) {
    return <AutomatedClosureWorkflow onBack={() => setShowAutomation(false)} />;
  }

  return (
    <div className="space-y-6 closures-scope">
      <ClosuresHeader 
        onCreateClosure={handleShowCreateModal}
      />
      
      {/* Automation Button */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-foreground">Asistente de Automatización</h3>
                <p className="text-sm text-muted-foreground">
                  Automatiza el proceso de cierre por cliente y período
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowAutomation(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Zap className="h-4 w-4 mr-2" />
              Automatizar Cierres
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <ClosuresStats closures={closures} />
      
      <ClosuresSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
      
      <ClosuresTable
        closures={filteredClosures}
        clients={clients}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClose={handleClose}
      />

      {closures.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No hay cierres disponibles. Crea tu primer cierre para comenzar.</p>
        </div>
      )}

      <Sheet open={showReportSheet} onOpenChange={setShowReportSheet}>
        <SheetContent className="bg-background border-border text-foreground w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
          <SheetHeader>
            <SheetTitle>Generar Informe de Servicios</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Selecciona el rango de fechas y un cliente para generar el informe.
            </SheetDescription>
          </SheetHeader>
          <ClosureReportForm onClose={() => setShowReportSheet(false)} />
        </SheetContent>
      </Sheet>

      <ClosureForm
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreateClosure}
      />

      <InvoiceConfirmationDialog
        open={showInvoiceDialog}
        onOpenChange={handleInvoiceDialogClose}
        closure={createdClosure}
        onConfirm={handleInvoiceConfirm}
      />
    </div>
  );
};

export default Closures;
