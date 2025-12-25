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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Service, ServiceStatus } from '@/types';
import { ServiceBatchUpdateData, useUpdateServicesBatch } from '@/hooks/useUpdateServicesBatch';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { Hash, Truck, User, FileText, Activity, X, Check } from 'lucide-react';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // Get client name from first service (assuming all are same client for batch)
  const clientName = selectedServices[0]?.client?.name || 'Cliente';

  const handleSubmit = async () => {
    const fields: ServiceBatchUpdateData['fields'] = {};

    if (enableStatus) fields.status = status;
    if (enableCrane) {
      fields.crane_id = craneId && craneId !== '__NONE__' ? craneId : null;
    }
    if (enableObservations) fields.observations = observations || null;

    batchProgress.start('ACTUALIZANDO SERVICIOS', selectedServices.length);

    const updateData: ServiceBatchUpdateData = {
      serviceIds: selectedServices.map(s => s.id),
      fields,
      appendObservations,
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

  const formatServiceDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5 text-primary" />
            Edición por Lotes - {clientName}
          </DialogTitle>
          <DialogDescription>
            Modifica estado, operador, grúa u observaciones para múltiples servicios
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Selected services badge and list */}
          <Badge variant="outline" className="text-sm font-normal">
            {selectedServices.length} servicios seleccionados
          </Badge>

          <ScrollArea className="max-h-32 rounded-md border bg-muted/30 p-3">
            <div className="space-y-2">
              {selectedServices.map((service, index) => (
                <div key={service.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <span className="font-medium">{service.folio}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{service.serviceType?.name || 'Sin tipo'}</span>
                  </div>
                  <span className="text-muted-foreground">{formatServiceDate(service.serviceDate)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Toggle sections */}
          <div className="space-y-3">
            {/* Status */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Estado</span>
                </div>
                <Switch
                  checked={enableStatus}
                  onCheckedChange={setEnableStatus}
                />
              </div>
              {enableStatus && (
                <div className="border-t bg-primary/5 p-4">
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
                </div>
              )}
            </div>

            {/* Operator */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Operador Principal</span>
                </div>
                <Switch
                  checked={enableOperator}
                  onCheckedChange={setEnableOperator}
                />
              </div>
              {enableOperator && (
                <div className="border-t bg-primary/5 p-4">
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
                </div>
              )}
            </div>

            {/* Crane */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Grúa</span>
                </div>
                <Switch
                  checked={enableCrane}
                  onCheckedChange={setEnableCrane}
                />
              </div>
              {enableCrane && (
                <div className="border-t bg-primary/5 p-4">
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
                </div>
              )}
            </div>

            {/* Observations */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Observaciones</span>
                </div>
                <Switch
                  checked={enableObservations}
                  onCheckedChange={setEnableObservations}
                />
              </div>
              {enableObservations && (
                <div className="border-t bg-primary/5 p-4 space-y-3">
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Observación común para todos los servicios"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="append-observations"
                      checked={appendObservations}
                      onCheckedChange={setAppendObservations}
                    />
                    <Label htmlFor="append-observations" className="text-sm text-muted-foreground">
                      Añadir a observaciones existentes
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isPending}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!hasChanges || isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {isPending ? 'Actualizando...' : 'Actualizar Servicios'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <BatchProgressModal 
        state={batchProgress.state} 
        onClose={batchProgress.close} 
      />
    </Dialog>
  );
};
