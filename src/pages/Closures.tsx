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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import ClosureReportForm from '@/components/closures/ClosureReportForm';

const Closures = () => {
  const { closures, loading, createClosure, updateClosure, deleteClosure, closeClosure } = useServiceClosures();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [editingClosure, setEditingClosure] = useState<ServiceClosure | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [createdClosure, setCreatedClosure] = useState<ServiceClosure | null>(null);

  console.log('Closures page render - closures:', closures.length, 'loading:', loading, 'showCreateModal:', showCreateModal);

  // Filter closures by search term
  const filteredClosures = closures.filter(closure =>
    closure.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
    closure.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="text-white">Cargando cierres...</div>
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

  return (
    <div className="space-y-6">
      <ClosuresHeader 
        onCreateClosure={handleShowCreateModal}
        onGenerateReport={handleShowReportSheet}
      />
      
      <ClosuresStats closures={closures} />
      
      <ClosuresSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
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
          <p className="text-gray-400">No hay cierres disponibles. Crea tu primer cierre para comenzar.</p>
        </div>
      )}

      <Sheet open={showReportSheet} onOpenChange={setShowReportSheet}>
        <SheetContent className="bg-gray-900 border-gray-800 text-white w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
          <SheetHeader>
            <SheetTitle>Generar Informe de Servicios</SheetTitle>
            <SheetDescription className="text-gray-400">
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
