import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Wrench, Calendar, DollarSign, User, CheckCircle, Clock, AlertCircle, Edit, Trash2, Receipt, ExternalLink, Gauge } from 'lucide-react';
import { useCraneMaintenance, useDeleteMaintenance, type MaintenanceRecord } from '@/hooks/useCraneMaintenance';
import { useMaintenanceCostStatus, useToggleMaintenanceCostPayment } from '@/hooks/useMaintenanceCostStatus';
import { MaintenanceForm } from './forms/MaintenanceForm';
import { Crane } from '@/types';
import { formatForDisplayLong } from '@/utils/timezoneUtils';
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
import { isCranePermanentlyLocked } from '@/utils/craneStatus';

interface CraneMaintenanceProps {
  crane: Crane;
}

export const CraneMaintenance = ({ crane }: CraneMaintenanceProps) => {
  const isLocked = isCranePermanentlyLocked(crane);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  
  const { data: maintenanceRecords = [], isLoading } = useCraneMaintenance(crane.id);
  const { data: costStatusData = [] } = useMaintenanceCostStatus(maintenanceRecords.map(r => r.id));
  const deleteMutation = useDeleteMaintenance();
  const togglePayment = useToggleMaintenanceCostPayment();

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const handleDelete = (record: MaintenanceRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (recordToDelete) {
      try {
        await deleteMutation.mutateAsync(recordToDelete.id);
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
      } catch {
        // no-op: onError already handled it
      }
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-success/30 bg-success/10 text-success';
      case 'in_progress':
        return 'border-warning/30 bg-warning/10 text-warning';
      case 'scheduled':
        return 'border-info/30 bg-info/10 text-info';
      default:
        return 'border-border/70 bg-muted/40 text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Progreso';
      case 'scheduled':
        return 'Programado';
      default:
        return 'Desconocido';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'preventive':
        return 'border-info/30 bg-info/10 text-info';
      case 'corrective':
        return 'border-warning/30 bg-warning/10 text-warning';
      case 'emergency':
        return 'border-danger/30 bg-danger/10 text-danger';
      default:
        return 'border-border/70 bg-muted/40 text-muted-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'preventive':
        return 'Preventivo';
      case 'corrective':
        return 'Correctivo';
      case 'emergency':
        return 'Emergencia';
      default:
        return type;
    }
  };

  const getCostStatus = (maintenanceId: string) => {
    return costStatusData.find(status => status.maintenanceId === maintenanceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Cargando mantenimientos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Mantenimiento de la Grúa</h3>
          <p className="text-muted-foreground">Gestión de mantenimientos para {crane.licensePlate}</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} disabled={isLocked} title={isLocked ? 'Grúa con bloqueo permanente' : undefined}>
          <Plus className="size-4 mr-2" />
          Programar Mantenimiento
        </Button>
      </div>

      {/* Maintenance Records List */}
      {maintenanceRecords.length === 0 ? (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="mb-4 size-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No hay mantenimientos registrados</h3>
            <p className="mb-6 text-center text-muted-foreground">
              Comienza agregando el primer mantenimiento para esta grúa.
            </p>
            <Button onClick={() => setIsFormOpen(true)} disabled={isLocked}>
              <Plus className="size-4 mr-2" />
              Programar Primer Mantenimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {maintenanceRecords.map((record) => (
            <Card key={record.id} className="border-border/70 bg-card/80 transition-colors hover:border-primary/20 hover:shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 gap-y-3">
                    {/* Status and Type Badges */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className={getStatusColor(record.status)}>
                        {getStatusLabel(record.status)}
                      </Badge>
                      <Badge className={getTypeColor(record.maintenanceType)}>
                        {getTypeLabel(record.maintenanceType)}
                      </Badge>
                      {/* Cost Integration Status */}
                      {record.status === 'completed' && record.cost > 0 && (
                        getCostStatus(record.id)?.hasCost ? (
                          <Badge className="border-success/30 bg-success/10 text-success">
                            <Receipt className="size-3 mr-1" />
                            Costo Registrado
                          </Badge>
                        ) : (
                          <Badge className="border-warning/30 bg-warning/10 text-warning">
                            <AlertCircle className="size-3 mr-1" />
                            Sincronizando...
                          </Badge>
                        )
                      )}
                    </div>

                    {/* Description and Provider */}
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">{record.description}</h4>
                      {record.provider && (
                        <div className="flex items-center gap-2 mt-1">
                          <Wrench className="size-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Proveedor: {record.provider}</span>
                        </div>
                      )}
                      {record.performedBy && (
                        <div className="flex items-center gap-2 mt-1">
                          <User className="size-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Realizado por: {record.performedBy}</span>
                        </div>
                      )}
                      {record.creatorName && (
                        <div className="flex items-center gap-2 mt-1">
                          <User className="size-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Registrado por: {record.creatorName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {record.scheduledDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4" />
                          <span>Programado: {formatForDisplayLong(record.scheduledDate)}</span>
                        </div>
                      )}
                      {record.completedDate && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-success" />
                          <span>Completado: {formatForDisplayLong(record.completedDate)}</span>
                        </div>
                      )}
                      {record.nextMaintenanceDate && (
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-warning" />
                          <span>Próximo: {formatForDisplayLong(record.nextMaintenanceDate)}</span>
                        </div>
                      )}
                      {record.kilometraje && (
                        <div className="flex items-center gap-2">
                          <Gauge className="size-4 text-info" />
                          <span>Km: {record.kilometraje.toLocaleString('es-CL')}</span>
                        </div>
                      )}
                    </div>

                    {/* Cost with Integration Status */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-4 text-success" />
                        <span className="font-semibold text-success">
                          ${record.cost.toLocaleString('es-CL')}
                        </span>
                      </div>
                      
                      {/* Show associated cost info + payment toggle */}
                      {(() => {
                        const cs = getCostStatus(record.id);
                        if (!cs?.hasCost || !cs.costId) return null;
                        const isPaid = !!cs.paymentDate;
                        return (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ExternalLink className="size-3" />
                              <span>Vinculado a costos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`paid-${record.id}`}
                                checked={isPaid}
                                onCheckedChange={(checked) => {
                                  togglePayment.mutate({
                                    costId: cs.costId!,
                                    isPaid: !!checked,
                                  });
                                }}
                                disabled={togglePayment.isPending || isLocked}
                              />
                              <label
                                htmlFor={`paid-${record.id}`}
                                className={`cursor-pointer text-sm ${isPaid ? 'text-success' : 'text-muted-foreground'}`}
                              >
                                {isPaid ? 'Pagado' : 'Marcar como pagado'}
                              </label>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Notes */}
                    {record.notes && (
                      <p className="rounded-md border border-border/70 bg-background/50 p-3 text-sm text-muted-foreground">
                        {record.notes}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 lg:mt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(record)}
                      disabled={isLocked}
                      className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(record)}
                      disabled={isLocked}
                      className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {!isLocked && (
        <MaintenanceForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          craneId={crane.id}
          editingRecord={editingRecord}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar registro de mantenimiento?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción eliminará permanentemente el registro de mantenimiento "{recordToDelete?.description}".
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
