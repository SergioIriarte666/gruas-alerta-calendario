import { useState } from 'react';
import { useServiceClosures } from '@/hooks/useServiceClosures';
import { useClients } from '@/hooks/useClients';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import ClosureForm from '@/components/closures/ClosureForm';
import ClosuresHeader from '@/components/closures/ClosuresHeader';
import ClosuresStats from '@/components/closures/ClosuresStats';
import ClosuresSearch from '@/components/closures/ClosuresSearch';
import ClosuresTable from '@/components/closures/ClosuresTable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import ClosureReportForm from '@/components/closures/ClosureReportForm';

const Closures = () => {
  const { closures, loading, createClosure, deleteClosure, closeClosure } = useServiceClosures();
  const { clients } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);

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

  const handleCreateClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('Creating closure with data:', closureData);
      await createClosure(closureData);
      setShowCreateModal(false);
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
    </div>
  );
};

export default Closures;
