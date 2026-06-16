
import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/dialog';
import { CraneForm } from '@/components/cranes/CraneForm';
import { CraneDetailsModal } from '@/components/cranes/CraneDetailsModal';
import { useCranes } from '@/hooks/useCranes';
import { Crane } from '@/types';
import { AppPagination } from '@/components/shared/AppPagination';
import { CranesHeader } from '@/components/cranes/CranesHeader';
import { CranesFilters } from '@/components/cranes/CranesFilters';
import { CranesTable, CraneSortField, SortDirection } from '@/components/cranes/CranesTable';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MaintenanceForm } from '@/components/cranes/forms/MaintenanceForm';
import { MetricCard } from '@/components/ui/metric-card';
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
import { CheckCircle2, Shield, Truck, TriangleAlert } from 'lucide-react';
import { businessClock } from '@/utils/businessClock';


const Cranes = () => {
  const { cranes, loading, createCrane, updateCrane, deleteCrane, toggleCraneStatus } = useCranes();
  const location = useLocation() as any;
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | undefined>();
  const [selectedCrane, setSelectedCrane] = useState<Crane | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<CraneSortField>('licensePlate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const ITEMS_PER_PAGE = 10;
  const [quickMaintenancePrefill, setQuickMaintenancePrefill] = useState<any | null>(location?.state?.prefilledData || null);
  const [intakeOpen, setIntakeOpen] = useState<boolean>(!!quickMaintenancePrefill);
  const [intakeCraneId, setIntakeCraneId] = useState<string>('');
  const [maintenanceOpen, setMaintenanceOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'toggle'; crane: Crane } | null>(null);

  const handleSort = (field: CraneSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedCranes = useMemo(() => {
    const filtered = cranes.filter(crane =>
      (crane.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (crane.ownerCompanyRut || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (crane.ownerCompanyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      crane.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crane.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'licensePlate':
          comparison = (a.licensePlate || '').localeCompare(b.licensePlate || '');
          break;
        case 'ownerCompanyRut':
          comparison = (a.ownerCompanyRut || a.ownerCompanyName || '').localeCompare(b.ownerCompanyRut || b.ownerCompanyName || '');
          break;
        case 'brand': {
          const brandA = `${a.brand} ${a.model}`;
          const brandB = `${b.brand} ${b.model}`;
          comparison = brandA.localeCompare(brandB);
          break;
        }
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'technicalReviewExpiry':
          comparison = parseFromDatabase(a.technicalReviewExpiry).getTime() - parseFromDatabase(b.technicalReviewExpiry).getTime();
          break;
        case 'insuranceExpiry':
          comparison = parseFromDatabase(a.insuranceExpiry).getTime() - parseFromDatabase(b.insuranceExpiry).getTime();
          break;
        case 'circulationPermitExpiry':
          comparison = parseFromDatabase(a.circulationPermitExpiry).getTime() - parseFromDatabase(b.circulationPermitExpiry).getTime();
          break;
        case 'isActive':
          comparison = (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [cranes, searchTerm, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedCranes.length / ITEMS_PER_PAGE);
  const paginatedCranes = filteredAndSortedCranes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const craneMetrics = useMemo(() => {
    const today = businessClock.todayDate();
    const next30Days = businessClock.todayDate();
    next30Days.setDate(next30Days.getDate() + 30);

    const dueSoon = cranes.filter((crane) => {
      const dates = [crane.technicalReviewExpiry, crane.insuranceExpiry, crane.circulationPermitExpiry]
        .map((value) => parseFromDatabase(value))
        .filter((date) => !Number.isNaN(date.getTime()));
      return dates.some((date) => date >= today && date <= next30Days);
    }).length;

    return {
      active: cranes.filter((crane) => crane.isActive).length,
      inactive: cranes.filter((crane) => !crane.isActive).length,
      dueSoon,
    };
  }, [cranes]);

  const handleCreate = () => {
    setEditingCrane(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (crane: Crane) => {
    setEditingCrane(crane);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCrane) {
      updateCrane(editingCrane.id, data);
    } else {
      createCrane(data);
    }
    setIsDialogOpen(false);
    setEditingCrane(undefined);
  };

  const handleDelete = (crane: Crane) => {
    setPendingAction({ type: 'delete', crane });
  };

  const handleToggleStatus = (crane: Crane) => {
    setPendingAction({ type: 'toggle', crane });
  };

  const handleViewDetails = (crane: Crane) => {
    setSelectedCrane(crane);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedCrane(undefined);
  };

  const handleEditFromDetails = (crane: Crane) => {
    setIsDetailsModalOpen(false);
    setEditingCrane(crane);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={intakeOpen} onOpenChange={(open) => {
        setIntakeOpen(open);
        if (!open) {
          if (navigate) navigate(location.pathname, { replace: true });
          setQuickMaintenancePrefill(null);
        }
      }}>
        <DialogContent className="border-border/70 bg-popover/95">
          <DialogHeader>
            <DialogTitle>Crear mantenimiento desde Registro Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-foreground">Seleccione Grúa</label>
              <select
                className="mt-2 w-full rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-foreground"
                value={intakeCraneId}
                onChange={(e) => setIntakeCraneId(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {cranes.map(c => (
                  <option key={c.id} value={c.id}>{c.licensePlate || `${c.brand} ${c.model}`}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
              <div><span className="text-muted-foreground">Descripción:</span> {quickMaintenancePrefill?.description || '-'}</div>
              <div><span className="text-muted-foreground">Costo:</span> {quickMaintenancePrefill?.amount ?? quickMaintenancePrefill?.cost ?? 0}</div>
              <div><span className="text-muted-foreground">Fecha:</span> {quickMaintenancePrefill?.date || '-'}</div>
              {quickMaintenancePrefill?.notes && <div><span className="text-muted-foreground">Notas:</span> {quickMaintenancePrefill.notes}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setIntakeOpen(false); setQuickMaintenancePrefill(null); }}>Cancelar</Button>
              <Button
                disabled={!intakeCraneId}
                onClick={() => {
                  setIntakeOpen(false);
                  setMaintenanceOpen(true);
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {maintenanceOpen && intakeCraneId && (
        <MaintenanceForm
          isOpen={maintenanceOpen}
          onClose={() => setMaintenanceOpen(false)}
          craneId={intakeCraneId}
          prefill={{
            description: quickMaintenancePrefill?.description,
            cost: quickMaintenancePrefill?.amount ?? quickMaintenancePrefill?.cost ?? 0,
            notes: quickMaintenancePrefill?.notes,
            status: 'scheduled',
            maintenance_type: 'preventive',
            date: quickMaintenancePrefill?.date || undefined,
          }}
          receiptPhotoPaths={quickMaintenancePrefill?.receipt_photo_paths || null}
          quickEntryId={quickMaintenancePrefill?.quickEntryId || null}
          onCreated={() => {
            setQuickMaintenancePrefill(null);
          }}
        />
      )}
      <CranesHeader onNewCrane={handleCreate} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Activas" value={craneMetrics.active} description="Disponibles en el parque" icon={CheckCircle2} tone="success" />
        <MetricCard title="Inactivas" value={craneMetrics.inactive} description="Fuera de operación actual" icon={Truck} tone="warning" />
        <MetricCard title="Vigencias Próximas" value={craneMetrics.dueSoon} description="Documentos que vencen en 30 días" icon={TriangleAlert} tone="danger" />
        <MetricCard title="Total Grúas" value={cranes.length} description="Unidades registradas" icon={Shield} tone="primary" />
      </div>

      <CranesFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <CranesTable
        cranes={paginatedCranes}
        totalCranes={filteredAndSortedCranes.length}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onViewDetails={handleViewDetails}
        onNewCrane={handleCreate}
        searchTerm={searchTerm}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {totalPages > 1 && (
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <CraneDetailsModal
        crane={selectedCrane}
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        onEdit={handleEditFromDetails}
      />

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setEditingCrane(undefined);
        }
      }}>
        <CraneForm
          crane={editingCrane}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsDialogOpen(false);
            setEditingCrane(undefined);
          }}
        />
      </Dialog>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent className="border-border/70 bg-popover/95">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'delete' ? 'Eliminar grúa' : `${pendingAction?.crane.isActive ? 'Desactivar' : 'Activar'} grúa`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'delete'
                ? `Se eliminará la grúa "${pendingAction.crane.licensePlate}". Esta acción no se puede deshacer.`
                : `La grúa "${pendingAction?.crane.licensePlate}" pasará a estado ${pendingAction?.crane.isActive ? 'inactivo' : 'activo'}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction?.type === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.type === 'delete') {
                  deleteCrane(pendingAction.crane.id);
                } else {
                  toggleCraneStatus(pendingAction.crane.id);
                }
                setPendingAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cranes;
