import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, Wrench, DollarSign, FileText, User, Calendar as CalendarComponent, Gauge } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateMaintenance, useUpdateMaintenance, type MaintenanceRecord } from '@/hooks/useCraneMaintenance';
import { formatForDatabase, parseFromDatabase, formatForDisplayLong } from '@/utils/timezoneUtils';

interface MaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  craneId: string;
  editingRecord?: MaintenanceRecord | null;
}

type FormData = {
  description: string;
  maintenance_type: 'preventive' | 'corrective' | 'emergency';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  cost: number;
  provider?: string;
  notes?: string;
  kilometraje?: number;
};

export const MaintenanceForm = ({ isOpen, onClose, craneId, editingRecord }: MaintenanceFormProps) => {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    editingRecord?.scheduledDate ? parseFromDatabase(editingRecord.scheduledDate) : new Date()
  );
  const [completedDate, setCompletedDate] = useState<Date | undefined>(
    editingRecord?.completedDate ? parseFromDatabase(editingRecord.completedDate) : undefined
  );
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState<Date | undefined>(
    editingRecord?.nextMaintenanceDate ? parseFromDatabase(editingRecord.nextMaintenanceDate) : undefined
  );
  
  const createMutation = useCreateMaintenance();
  const updateMutation = useUpdateMaintenance();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      description: '',
      maintenance_type: 'preventive',
      status: 'scheduled',
      cost: 0,
      provider: '',
      notes: '',
      kilometraje: undefined,
    }
  });

  // Sync form with editingRecord when it changes
  useEffect(() => {
    if (editingRecord) {
      // Update form values
      reset({
        description: editingRecord.description,
        maintenance_type: editingRecord.maintenanceType,
        status: editingRecord.status,
        cost: editingRecord.cost,
        provider: editingRecord.provider || '',
        notes: editingRecord.notes || '',
        kilometraje: (editingRecord as any).kilometraje || undefined,
      });

      // Update date states
      setScheduledDate(editingRecord.scheduledDate ? parseFromDatabase(editingRecord.scheduledDate) : new Date());
      setCompletedDate(editingRecord.completedDate ? parseFromDatabase(editingRecord.completedDate) : undefined);
      setNextMaintenanceDate(editingRecord.nextMaintenanceDate ? parseFromDatabase(editingRecord.nextMaintenanceDate) : undefined);
    } else {
      // Reset to defaults for new records
      reset({
        description: '',
        maintenance_type: 'preventive',
        status: 'scheduled',
        cost: 0,
        provider: '',
        notes: '',
        kilometraje: undefined,
      });
      setScheduledDate(new Date());
      setCompletedDate(undefined);
      setNextMaintenanceDate(undefined);
    }
  }, [editingRecord, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({
          id: editingRecord.id,
          updates: {
            description: data.description,
            maintenanceType: data.maintenance_type,
            status: data.status,
            cost: data.cost,
            provider: data.provider,
            notes: data.notes,
            scheduledDate: scheduledDate ? formatForDatabase(scheduledDate) : null,
            completedDate: completedDate ? formatForDatabase(completedDate) : null,
            nextMaintenanceDate: nextMaintenanceDate ? formatForDatabase(nextMaintenanceDate) : null,
          },
          ...(data.kilometraje && { kilometraje: data.kilometraje })
        } as any);
      } else {
        await createMutation.mutateAsync({
          description: data.description,
          maintenanceType: data.maintenance_type,
          status: data.status,
          cost: data.cost,
          provider: data.provider,
          notes: data.notes,
          craneId: craneId,
          scheduledDate: scheduledDate ? formatForDatabase(scheduledDate) : null,
          completedDate: completedDate ? formatForDatabase(completedDate) : null,
          nextMaintenanceDate: nextMaintenanceDate ? formatForDatabase(nextMaintenanceDate) : null,
          kilometraje: data.kilometraje,
        } as any);
      }
      handleClose();
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleClose = () => {
    reset();
    setScheduledDate(new Date());
    setCompletedDate(undefined);
    setNextMaintenanceDate(undefined);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5 text-violet-500" />
            {editingRecord ? 'Editar Mantenimiento' : 'Agregar Mantenimiento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descripción
            </Label>
            <Textarea
              id="description"
              {...register('description', { required: 'La descripción es requerida' })}
              className="bg-background border-border text-foreground"
              placeholder="Descripción del mantenimiento..."
              rows={3}
            />
            {errors.description && (
              <span className="text-red-400 text-sm">{errors.description.message}</span>
            )}
          </div>

          {/* Type and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Tipo de Mantenimiento</Label>
              <Select onValueChange={(value) => setValue('maintenance_type', value as FormData['maintenance_type'])} defaultValue={watch('maintenance_type')}>
                <SelectTrigger className="bg-white/5 border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="bg-black border-tms-green/30">
                  <SelectItem value="preventive">Preventivo</SelectItem>
                  <SelectItem value="corrective">Correctivo</SelectItem>
                  <SelectItem value="emergency">Emergencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Estado</Label>
              <Select onValueChange={(value) => setValue('status', value as FormData['status'])} defaultValue={watch('status')}>
                <SelectTrigger className="bg-white/5 border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent className="bg-black border-tms-green/30">
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost, Kilometraje and Provider */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost" className="text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Costo
              </Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                {...register('cost', { 
                  required: 'El costo es requerido',
                  valueAsNumber: true,
                  min: { value: 0, message: 'El costo debe ser mayor o igual a 0' }
                })}
                className="bg-white/5 border-tms-green/30 text-white"
                placeholder="0.00"
              />
              {errors.cost && (
                <span className="text-red-400 text-sm">{errors.cost.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kilometraje" className="text-white flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Kilometraje (Opcional)
              </Label>
              <Input
                id="kilometraje"
                type="number"
                min="0"
                {...register('kilometraje', { 
                  valueAsNumber: true,
                  min: { value: 0, message: 'El kilometraje debe ser mayor o igual a 0' }
                })}
                className="bg-white/5 border-tms-green/30 text-white"
                placeholder="Ej: 50000"
              />
              {errors.kilometraje && (
                <span className="text-red-400 text-sm">{errors.kilometraje.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider" className="text-white flex items-center gap-2">
                <User className="w-4 h-4" />
                Proveedor (Opcional)
              </Label>
              <Input
                id="provider"
                {...register('provider')}
                className="bg-white/5 border-tms-green/30 text-white"
                placeholder="Nombre del proveedor"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Scheduled Date */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Fecha Programada
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-tms-green/30 hover:bg-tms-green/10"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? formatForDisplayLong(scheduledDate) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black border-tms-green/30">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Completed Date */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Fecha Completado
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-tms-green/30 hover:bg-tms-green/10"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {completedDate ? formatForDisplayLong(completedDate) : 'Sin completar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black border-tms-green/30">
                  <Calendar
                    mode="single"
                    selected={completedDate}
                    onSelect={setCompletedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Next Maintenance Date */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Próximo Mantenimiento
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-tms-green/30 hover:bg-tms-green/10"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nextMaintenanceDate ? formatForDisplayLong(nextMaintenanceDate) : 'Sin programar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black border-tms-green/30">
                  <Calendar
                    mode="single"
                    selected={nextMaintenanceDate}
                    onSelect={setNextMaintenanceDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notas (Opcional)
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              className="bg-white/5 border-tms-green/30 text-white"
              placeholder="Notas adicionales sobre el mantenimiento..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingRecord ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};