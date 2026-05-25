import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Wrench, Calendar, DollarSign, User, CheckCircle, Clock, AlertCircle, Edit, Trash2, Receipt, ExternalLink, Gauge } from 'lucide-react';
import { useCraneMaintenance, useDeleteMaintenance, type MaintenanceRecord } from '@/hooks/useCraneMaintenance';
import { useMaintenanceCostStatus, useToggleMaintenanceCostPayment } from '@/hooks/useMaintenanceCostStatus';
import { MaintenanceForm } from './forms/MaintenanceForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crane } from '@/types';
import { parseFromDatabase, formatForDisplayLong } from '@/utils/timezoneUtils';
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

interface CraneMaintenanceProps {
  crane: Crane;
}

export const CraneMaintenance = ({ crane }: CraneMaintenanceProps) => {
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
      await deleteMutation.mutateAsync(recordToDelete.id);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
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
        return 'bg-blue-500/20 text-blue-400';
      case 'corrective':
        return 'bg-orange-500/20 text-orange-400';
      case 'emergency':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
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
        <div className="text-gray-400">Cargando mantenimientos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Mantenimiento de la Grúa</h3>
          <p className="text-gray-400">Gestión de mantenimientos para {crane.licensePlate}</p>
        </div>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
        >
          <Plus className="size-4 mr-2" />
          Programar Mantenimiento
        </Button>
      </div>

      {/* Maintenance Records List */}
      {maintenanceRecords.length === 0 ? (
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="size-16 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay mantenimientos registrados</h3>
            <p className="text-gray-400 text-center mb-6">
              Comienza agregando el primer mantenimiento para esta grúa.
            </p>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
            >
              <Plus className="size-4 mr-2" />
              Programar Primer Mantenimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {maintenanceRecords.map((record) => (
            <Card key={record.id} className="bg-white/5 border-tms-green/30 hover:bg-white/10 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
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
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Receipt className="size-3 mr-1" />
                            Costo Registrado
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <AlertCircle className="size-3 mr-1" />
                            Sincronizando...
                          </Badge>
                        )
                      )}
                    </div>

                    {/* Description and Provider */}
                    <div>
                      <h4 className="text-lg font-semibold text-white">{record.description}</h4>
                      {record.provider && (
                        <div className="flex items-center gap-2 mt-1">
                          <Wrench className="size-4 text-gray-400" />
                          <span className="text-gray-300">Proveedor: {record.provider}</span>
                        </div>
                      )}
                      {record.performedBy && (
                        <div className="flex items-center gap-2 mt-1">
                          <User className="size-4 text-gray-400" />
                          <span className="text-gray-300">Realizado por: {record.performedBy}</span>
                        </div>
                      )}
                      {record.creatorName && (
                        <div className="flex items-center gap-2 mt-1">
                          <User className="size-4 text-gray-400" />
                          <span className="text-gray-300">Registrado por: {record.creatorName}</span>
                        </div>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                      {record.scheduledDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4" />
                          <span>Programado: {formatForDisplayLong(record.scheduledDate)}</span>
                        </div>
                      )}
                      {record.completedDate && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-green-400" />
                          <span>Completado: {formatForDisplayLong(record.completedDate)}</span>
                        </div>
                      )}
                      {record.nextMaintenanceDate && (
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-yellow-400" />
                          <span>Próximo: {formatForDisplayLong(record.nextMaintenanceDate)}</span>
                        </div>
                      )}
                      {record.kilometraje && (
                        <div className="flex items-center gap-2">
                          <Gauge className="size-4 text-blue-400" />
                          <span>Km: {record.kilometraje.toLocaleString('es-CL')}</span>
                        </div>
                      )}
                    </div>

                    {/* Cost with Integration Status */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-4 text-tms-green" />
                        <span className="text-tms-green font-semibold">
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
                            <div className="flex items-center gap-2 text-sm text-gray-400">
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
                                disabled={togglePayment.isPending}
                              />
                              <label
                                htmlFor={`paid-${record.id}`}
                                className={`text-sm cursor-pointer ${isPaid ? 'text-green-400' : 'text-gray-400'}`}
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
                      <p className="text-sm text-gray-400 bg-white/5 p-3 rounded-md">
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
                      className="border-tms-green/50 text-tms-green hover:bg-tms-green/10"
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(record)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
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
      <MaintenanceForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        craneId={crane.id}
        editingRecord={editingRecord}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-black border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar registro de mantenimiento?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Esta acción eliminará permanentemente el registro de mantenimiento "{recordToDelete?.description}".
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};