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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Service, ServiceStatus } from '@/types';
import { ServiceBatchUpdateData, useUpdateServicesBatch } from '@/hooks/useUpdateServicesBatch';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { 
  Hash, Truck, User, FileText, Activity, X, Check, 
  CheckSquare, Square, Layers, ArrowRight 
} from 'lucide-react';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { toTitleCase } from '@/lib/utils';

interface ServiceBatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServices: Service[];
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: ServiceStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
  { value: 'in_progress', label: 'En Progreso', color: 'bg-blue-500' },
  { value: 'completed', label: 'Completado', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-500' },
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

  // Excluded services state
  const [excludedServices, setExcludedServices] = useState<Set<string>>(new Set());

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

  // Active services (not excluded)
  const activeServices = useMemo(() => 
    selectedServices.filter(s => !excludedServices.has(s.id)),
    [selectedServices, excludedServices]
  );

  // Get client name from first service
  const clientName = selectedServices[0]?.client?.name ? toTitleCase(selectedServices[0].client.name) : 'Cliente';

  const toggleServiceExclusion = (serviceId: string) => {
    setExcludedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const selectAllServices = () => setExcludedServices(new Set());
  const deselectAllServices = () => setExcludedServices(new Set(selectedServices.map(s => s.id)));

  const handleSubmit = async () => {
    if (activeServices.length === 0) return;

    const fields: ServiceBatchUpdateData['fields'] = {};

    if (enableStatus) fields.status = status;
    if (enableCrane) {
      fields.crane_id = craneId && craneId !== '__NONE__' ? craneId : null;
    }
    if (enableObservations) fields.observations = observations || null;

    batchProgress.start('ACTUALIZANDO SERVICIOS', activeServices.length);

    const updateData: ServiceBatchUpdateData = {
      serviceIds: activeServices.map(s => s.id),
      fields,
      appendObservations,
      operatorId: enableOperator 
        ? (operatorId && operatorId !== '__NONE__' ? operatorId : null) 
        : undefined,
      onProgress: ({ current, currentItemId }) => {
        const service = activeServices.find(s => s.id === currentItemId);
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
    setExcludedServices(new Set());
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
      return format(new Date(dateString), 'dd/MM', { locale: es });
    } catch {
      return dateString;
    }
  };

  // Build summary of changes
  const changeSummary = useMemo(() => {
    const changes: string[] = [];
    if (enableStatus) {
      const statusLabel = STATUS_OPTIONS.find(s => s.value === status)?.label;
      changes.push(`Estado → ${statusLabel}`);
    }
    if (enableOperator) {
      const opName = operatorId && operatorId !== '__NONE__' 
        ? activeOperators.find(o => o.id === operatorId)?.name || 'Operador'
        : 'Sin operador';
      changes.push(`Operador → ${opName}`);
    }
    if (enableCrane) {
      const craneName = craneId && craneId !== '__NONE__'
        ? activeCranes.find(c => c.id === craneId)?.licensePlate || 'Grúa'
        : 'Sin grúa';
      changes.push(`Grúa → ${craneName}`);
    }
    if (enableObservations) {
      changes.push(appendObservations ? 'Añadir observación' : 'Reemplazar observación');
    }
    return changes;
  }, [enableStatus, enableOperator, enableCrane, enableObservations, status, operatorId, craneId, appendObservations, activeOperators, activeCranes]);

  const getStatusBadge = (serviceStatus?: string) => {
    const statusInfo = STATUS_OPTIONS.find(s => s.value === serviceStatus);
    return statusInfo ? (
      <span className={cn("h-2 w-2 rounded-full", statusInfo.color)} />
    ) : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Layers className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <span>Edición por Lotes</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">{clientName}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Services list */}
          <div className="w-[340px] border-r flex flex-col bg-muted/20">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Servicios</span>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={selectAllServices}
                  className="h-7 px-2 text-xs"
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  Todos
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={deselectAllServices}
                  className="h-7 px-2 text-xs"
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Ninguno
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-2 py-2">
              <div className="space-y-1">
                {selectedServices.map((service) => {
                  const isExcluded = excludedServices.has(service.id);
                  return (
                    <div 
                      key={service.id} 
                      onClick={() => toggleServiceExclusion(service.id)}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                        isExcluded 
                          ? "bg-muted/50 opacity-50" 
                          : "bg-card hover:bg-accent/50 border shadow-sm"
                      )}
                    >
                      <Checkbox 
                        checked={!isExcluded}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium text-sm",
                            isExcluded && "line-through"
                          )}>
                            {service.folio}
                          </span>
                          {getStatusBadge(service.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{service.serviceType?.name || 'Sin tipo'}</span>
                          <span>•</span>
                          <span>{formatServiceDate(service.serviceDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 border-t bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Seleccionados</span>
                <Badge variant={activeServices.length > 0 ? "default" : "secondary"}>
                  {activeServices.length} de {selectedServices.length}
                </Badge>
              </div>
            </div>
          </div>

          {/* Right panel - Edit fields */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b">
              <span className="text-sm font-medium">Campos a modificar</span>
              <p className="text-xs text-muted-foreground mt-0.5">Activa los campos que deseas actualizar</p>
            </div>

            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3">
                {/* Status card */}
                <div className={cn(
                  "rounded-xl border-2 transition-all overflow-hidden",
                  enableStatus ? "border-violet-500/50 bg-violet-500/5" : "border-transparent bg-card"
                )}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        enableStatus ? "bg-violet-500/20" : "bg-muted"
                      )}>
                        <Activity className={cn(
                          "h-5 w-5 transition-colors",
                          enableStatus ? "text-violet-500" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <span className="font-medium">Estado</span>
                        <p className="text-xs text-muted-foreground">Cambiar estado del servicio</p>
                      </div>
                    </div>
                    <Switch
                      checked={enableStatus}
                      onCheckedChange={setEnableStatus}
                    />
                  </div>
                  {enableStatus && (
                    <div className="px-4 pb-4 pt-0">
                      <Select value={status} onValueChange={(v) => setStatus(v as ServiceStatus)}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", opt.color)} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Operator card */}
                <div className={cn(
                  "rounded-xl border-2 transition-all overflow-hidden",
                  enableOperator ? "border-violet-500/50 bg-violet-500/5" : "border-transparent bg-card"
                )}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        enableOperator ? "bg-violet-500/20" : "bg-muted"
                      )}>
                        <User className={cn(
                          "h-5 w-5 transition-colors",
                          enableOperator ? "text-violet-500" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <span className="font-medium">Operador Principal</span>
                        <p className="text-xs text-muted-foreground">Asignar o cambiar operador</p>
                      </div>
                    </div>
                    <Switch
                      checked={enableOperator}
                      onCheckedChange={setEnableOperator}
                    />
                  </div>
                  {enableOperator && (
                    <div className="px-4 pb-4 pt-0">
                      <Select value={operatorId} onValueChange={setOperatorId}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Seleccionar operador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">
                            <span className="text-muted-foreground">Sin operador (quitar asignación)</span>
                          </SelectItem>
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

                {/* Crane card */}
                <div className={cn(
                  "rounded-xl border-2 transition-all overflow-hidden",
                  enableCrane ? "border-violet-500/50 bg-violet-500/5" : "border-transparent bg-card"
                )}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        enableCrane ? "bg-violet-500/20" : "bg-muted"
                      )}>
                        <Truck className={cn(
                          "h-5 w-5 transition-colors",
                          enableCrane ? "text-violet-500" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <span className="font-medium">Grúa</span>
                        <p className="text-xs text-muted-foreground">Asignar o cambiar grúa</p>
                      </div>
                    </div>
                    <Switch
                      checked={enableCrane}
                      onCheckedChange={setEnableCrane}
                    />
                  </div>
                  {enableCrane && (
                    <div className="px-4 pb-4 pt-0">
                      <Select value={craneId} onValueChange={setCraneId}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Seleccionar grúa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">
                            <span className="text-muted-foreground">Sin grúa (quitar asignación)</span>
                          </SelectItem>
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

                {/* Observations card */}
                <div className={cn(
                  "rounded-xl border-2 transition-all overflow-hidden",
                  enableObservations ? "border-violet-500/50 bg-violet-500/5" : "border-transparent bg-card"
                )}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        enableObservations ? "bg-violet-500/20" : "bg-muted"
                      )}>
                        <FileText className={cn(
                          "h-5 w-5 transition-colors",
                          enableObservations ? "text-violet-500" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <span className="font-medium">Observaciones</span>
                        <p className="text-xs text-muted-foreground">Añadir o reemplazar observaciones</p>
                      </div>
                    </div>
                    <Switch
                      checked={enableObservations}
                      onCheckedChange={setEnableObservations}
                    />
                  </div>
                  {enableObservations && (
                    <div className="px-4 pb-4 pt-0 space-y-3">
                      <Textarea
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Observación común para todos los servicios"
                        rows={3}
                        className="bg-background"
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
            </ScrollArea>
          </div>
        </div>

        {/* Footer with summary */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 text-sm">
            {hasChanges && activeServices.length > 0 ? (
              <>
                <ArrowRight className="h-4 w-4 text-violet-600" />
                <span className="text-muted-foreground">
                  Aplicando a <strong className="text-foreground">{activeServices.length}</strong> servicios:
                </span>
                <span className="text-violet-600 font-medium truncate">
                  {changeSummary.join(' • ')}
                </span>
              </>
            ) : !hasChanges ? (
              <span className="text-muted-foreground">Selecciona al menos un campo para modificar</span>
            ) : (
              <span className="text-muted-foreground">Selecciona al menos un servicio</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!hasChanges || isPending || activeServices.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {isPending ? 'Actualizando...' : `Actualizar ${activeServices.length} servicios`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <BatchProgressModal 
        state={batchProgress.state} 
        onClose={batchProgress.close} 
      />
    </Dialog>
  );
};
