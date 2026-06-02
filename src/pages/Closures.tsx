import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServiceClosures } from '@/hooks/useServiceClosures';
import { useClients } from '@/hooks/useClients';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';
import ClosureForm from '@/components/closures/ClosureForm';
import { EditClosureForm } from '@/components/closures/EditClosureForm';
import ClosuresHeader from '@/components/closures/ClosuresHeader';
import ClosuresStats from '@/components/closures/ClosuresStats';
import ClosuresSearch from '@/components/closures/ClosuresSearch';
import ClosuresTable, { ClosureSortField, SortDirection } from '@/components/closures/ClosuresTable';
import InvoiceConfirmationDialog from '@/components/closures/InvoiceConfirmationDialog';

import { ClosureDetailsModal } from '@/components/closures/ClosureDetailsModal';
import { ClosureDeleteConfirmDialog } from '@/components/closures/ClosureDeleteConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import ClosureReportForm from '@/components/closures/ClosureReportForm';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ClosuresPage');

const Closures = () => {
  const { closures, loading, createClosure, updateClosure, deleteClosure, closeClosure } = useServiceClosures();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [editingClosure, setEditingClosure] = useState<ServiceClosure | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [createdClosure, setCreatedClosure] = useState<ServiceClosure | null>(null);
  
  const [sortField, setSortField] = useState<ClosureSortField>('dateFrom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedClosure, setSelectedClosure] = useState<ServiceClosure | null>(null);
  const [closureToDelete, setClosureToDelete] = useState<ServiceClosure | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [closureToClose, setClosureToClose] = useState<ServiceClosure | null>(null);

  

  const handleSort = (field: ClosureSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return toTitleCase(client?.name || 'Cliente desconocido');
  };

  // Filter and sort closures
  const filteredAndSortedClosures = useMemo(() => {
    const filtered = closures.filter(closure => {
      const matchesSearch = closure.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           closure.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getClientName(closure.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || closure.status === statusFilter;
      const matchesClient = clientFilter === 'all' || closure.clientId === clientFilter;
      return matchesSearch && matchesStatus && matchesClient;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'folio':
          comparison = a.folio.localeCompare(b.folio);
          break;
        case 'dateFrom':
          comparison = parseFromDatabase(a.dateRange.from).getTime() - parseFromDatabase(b.dateRange.from).getTime();
          break;
        case 'clientId': {
          const clientA = getClientName(a.clientId);
          const clientB = getClientName(b.clientId);
          comparison = clientA.localeCompare(clientB);
          break;
        }
        case 'serviceCount':
          comparison = a.serviceIds.length - b.serviceIds.length;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'status': {
          const statusOrder = { open: 0, closed: 1, invoiced: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [closures, searchTerm, statusFilter, clientFilter, sortField, sortDirection, clients]);

  const handleDelete = (id: string) => {
    const closure = closures.find(c => c.id === id);
    if (!closure) return;
    if (closure.status === 'invoiced') {
      toast.error('No se puede eliminar un cierre facturado');
      return;
    }
    setClosureToDelete(closure);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (closure: ServiceClosure) => {
    await deleteClosure(closure.id);
    toast.success("Cierre eliminado", {
      description: "El cierre ha sido eliminado exitosamente.",
    });
    setIsDeleteDialogOpen(false);
    setClosureToDelete(null);
  };

  const handleClose = (id: string) => {
    const closure = closures.find((item) => item.id === id);
    if (closure) setClosureToClose(closure);
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
      logger.error('Error updating closure:', error);
      toast.error("Error", {
        description: "No se pudo actualizar el cierre.",
      });
    }
  };

  const handleCreateClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    logger.debug('manualCreateClosure - start');
    try {
      
      const newClosure = await createClosure(closureData);
      setShowCreateModal(false);
      setCreatedClosure(newClosure);
      
      // Use setTimeout to allow modal to close and UI to update before showing dialog
      setTimeout(() => {
        setShowInvoiceDialog(true);
        toast.success("Cierre creado", {
          description: "El cierre ha sido creado exitosamente.",
        });
      }, 300);
      
    } catch (error) {
      logger.error('Error creating closure:', error);
      toast.error("Error", {
        description: "No se pudo crear el cierre.",
      });
    } finally {
      logger.debug('manualCreateClosure - end');
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
    
    setShowCreateModal(true);
  };
  
  const handleShowReportSheet = () => {
    setShowReportSheet(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[420px] w-full" />
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
        onOpenReport={handleShowReportSheet}
      />
      
      
      <ClosuresStats closures={closures} />
      
      <ClosuresSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        clientFilter={clientFilter}
        onClientFilterChange={setClientFilter}
        clients={clients}
      />
      
      <ErrorBoundary name="ClosuresTable">
        <ClosuresTable
          closures={filteredAndSortedClosures}
          clients={clients}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={handleClose}
          onViewDetails={setSelectedClosure}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </ErrorBoundary>

      <ClosureDetailsModal
        closure={selectedClosure}
        clientName={selectedClosure ? getClientName(selectedClosure.clientId) : undefined}
        isOpen={!!selectedClosure}
        onClose={() => setSelectedClosure(null)}
      />

      <ClosureDeleteConfirmDialog
        closure={closureToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirmDelete={handleConfirmDelete}
      />

      {closures.length === 0 && !loading && (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No hay cierres disponibles. Crea tu primer cierre para comenzar.</p>
          </CardContent>
        </Card>
      )}

      <Sheet open={showReportSheet} onOpenChange={setShowReportSheet}>
        <SheetContent className="bg-background border-border text-foreground w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
          <SheetHeader>
            <SheetTitle>Generar Informe de Servicios</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Selecciona el rango de fechas y un cliente para generar el informe.
            </SheetDescription>
          </SheetHeader>
          <ClosureReportForm closures={closures} onClose={() => setShowReportSheet(false)} />
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

      <AlertDialog open={!!closureToClose} onOpenChange={(open) => !open && setClosureToClose(null)}>
        <AlertDialogContent className="border-border/70 bg-popover/95">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar periodo</AlertDialogTitle>
            <AlertDialogDescription>
              {closureToClose
                ? `Se cerrará el periodo "${closureToClose.folio}" y quedará listo para su facturación.`
                : 'Esta acción confirmará el cierre del periodo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!closureToClose) return;
                closeClosure(closureToClose.id);
                toast.success("Cierre procesado", {
                  description: "El cierre ha sido procesado exitosamente.",
                });
                setClosureToClose(null);
              }}
            >
              Confirmar cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Closures;
