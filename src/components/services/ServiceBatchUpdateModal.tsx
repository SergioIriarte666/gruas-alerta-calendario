import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Service, ServiceStatus } from '@/types';
import { ServiceBatchUpdateData, useUpdateServicesBatch } from '@/hooks/useUpdateServicesBatch';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { Settings2, Truck, User, FileText, Activity } from 'lucide-react';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

interface ServiceBatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServices: Service[];
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: ServiceStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

export const ServiceBatchUpdateModal = ({
  open,
  onOpenChange,
  selectedServices,
  onSuccess,
}: ServiceBatchUpdateModalProps) => {
  const { mutateAsync: updateBatch, isPending } = useUpdateServicesBatch();
  const { data: operators = [] } = useOperatorsData();
  const { cranes = [] } = useCranes();
  const batchProgress = useBatchProgress();

  // Toggle states
  const [enableStatus, setEnableStatus] = useState(false);
  const [enableOperator, setEnableOperator] = useState(false);
  const [enableCrane, setEnableCrane] = useState(false);
  const [enableObservations, setEnableObservations] = useState(false);

  // Field values
  const [status, setStatus] = useState<ServiceStatus>('pending');
  const [operatorId, setOperatorId] = useState<string>('');
  const [craneId, setCraneId] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [appendObservations, setAppendObservations] = useState(false);

  const activeOperators = operators.filter(op => op.isActive);
  const activeCranes = cranes.filter(c => c.isActive);

  const totalAmount = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + (service.value || 0), 0);
  }, [selectedServices]);

  const handleSubmit = async () => {
    const fields: ServiceBatchUpdateData['fields'] = {};

    if (enableStatus) fields.status = status;
    // Convert __NONE__ to null for crane
    if (enableCrane) {
      fields.crane_id = craneId && craneId !== '__NONE__' ? craneId : null;
    }
    if (enableObservations) fields.observations = observations || null;

    // Start progress modal
    batchProgress.start('ACTUALIZANDO SERVICIOS', selectedServices.length);

    const updateData: ServiceBatchUpdateData = {
      serviceIds: selectedServices.map(s => s.id),
      fields,
      appendObservations,
      // Convert __NONE__ to null for operator
      operatorId: enableOperator 
        ? (operatorId && operatorId !== '__NONE__' ? operatorId : null) 
        : undefined,
      onProgress: ({ current, currentItemId }) => {
        const service = selectedServices.find(s => s.id === currentItemId);
        batchProgress.update(current, service?.folio || `Servicio ${current}`);
      },
    };

    try {
      await updateBatch(updateData);
      batchProgress.complete();
      // Delay closing to show completion
      setTimeout(() => {
        batchProgress.close();
        onOpenChange(false);
        resetForm();
        onSuccess();
      }, 1500);
    } catch (error) {
      batchProgress.close();
      console.error('Error updating batch:', error);
    }
  };

  const resetForm = () => {
    setEnableStatus(false);
    setEnableOperator(false);
    setEnableCrane(false);
    setEnableObservations(false);
    setStatus('pending');
    setOperatorId('');
    setCraneId('');
    setObservations('');
    setAppendObservations(false);
  };

  const hasChanges = enableStatus || enableOperator || enableCrane || enableObservations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Edición por Lotes
          </DialogTitle>
          <DialogDescription>
            Modifica múltiples servicios simultáneamente. Solo se actualizarán los campos que habilites.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <Card className="bg-muted/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Servicios seleccionados</p>
                <p className="text-2xl font-bold">{selectedServices.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-violet-600">
                  ${totalAmount.toLocaleString('es-CL')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurable fields */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 flex-1">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="enable-status">Estado</Label>
                    <Switch
                      id="enable-status"
                      checked={enableStatus}
                      onCheckedChange={setEnableStatus}
                    />
                  </div>
                  {enableStatus && (
                    <Select value={status} onValueChange={(v) => setStatus(v as ServiceStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operator */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 flex-1">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="enable-operator">Operador Principal</Label>
                    <Switch
                      id="enable-operator"
                      checked={enableOperator}
                      onCheckedChange={setEnableOperator}
                    />
                  </div>
                  {enableOperator && (
                    <Select value={operatorId} onValueChange={setOperatorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar operador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Sin operador (quitar asignación)</SelectItem>
                        {activeOperators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crane */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 flex-1">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="enable-crane">Grúa</Label>
                    <Switch
                      id="enable-crane"
                      checked={enableCrane}
                      onCheckedChange={setEnableCrane}
                    />
                  </div>
                  {enableCrane && (
                    <Select value={craneId} onValueChange={setCraneId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar grúa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Sin grúa (quitar asignación)</SelectItem>
                        {activeCranes.map((crane) => (
                          <SelectItem key={crane.id} value={crane.id}>
                            {crane.licensePlate} - {crane.brand} {crane.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observations */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 flex-1">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="enable-observations">Observaciones</Label>
                    <Switch
                      id="enable-observations"
                      checked={enableObservations}
                      onCheckedChange={setEnableObservations}
                    />
                  </div>
                  {enableObservations && (
                    <>
                      <Textarea
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Observación común para todos los servicios"
                        rows={3}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          id="append-observations"
                          checked={appendObservations}
                          onCheckedChange={setAppendObservations}
                        />
                        <Label htmlFor="append-observations" className="text-sm text-muted-foreground">
                          Añadir a observaciones existentes
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {hasChanges && selectedServices.length <= 5 && (
          <Card className="bg-muted/20">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">Vista previa de cambios:</p>
              <div className="space-y-2">
                {selectedServices.slice(0, 5).map((service) => (
                  <div key={service.id} className="text-sm flex items-center gap-2">
                    <Badge variant="outline">{service.folio}</Badge>
                    <span className="text-muted-foreground">
                      {service.client?.name} - ${(service.value || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isPending}>
            {isPending ? 'Actualizando...' : `Actualizar ${selectedServices.length} Servicios`}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Batch Progress Modal */}
      <BatchProgressModal 
        state={batchProgress.state} 
        onClose={batchProgress.close} 
      />
    </Dialog>
  );
};
