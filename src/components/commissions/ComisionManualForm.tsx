import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { useCreateManualCommission } from '@/hooks/commissions/useCreateManualCommission';
import { businessClock } from '@/utils/businessClock';
import { formatForDisplay, getCurrentChileDate, createLocalDateFromCalendar } from '@/utils/timezoneUtils';

const manualCommissionSchema = z.object({
  date: z.date({ required_error: 'La fecha es requerida' }),
  operatorId: z.string().min(1, 'El operador es requerido'),
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  description: z.string().trim().min(1, 'La descripción es requerida'),
  notes: z.string().optional(),
  serviceFolio: z.string().optional(),
  craneId: z.string().optional(),
});

type ManualCommissionFormValues = z.infer<typeof manualCommissionSchema>;

export const ComisionManualForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: operators = [] } = useOperatorsData();
  const { cranes } = useCranes(true);
  const createManualCommission = useCreateManualCommission();

  const form = useForm<ManualCommissionFormValues>({
    resolver: zodResolver(manualCommissionSchema),
    defaultValues: {
      date: getCurrentChileDate(),
      operatorId: '',
      amount: 0,
      description: '',
      notes: '',
      serviceFolio: '9999',
      craneId: '',
    },
  });

  const activeOperators = operators.filter((operator) => operator.isActive);

  const handleSubmit = (values: ManualCommissionFormValues) => {
    createManualCommission.mutate(
      {
        date: businessClock.format(values.date, 'yyyy-MM-dd'),
        operatorId: values.operatorId,
        amount: values.amount,
        description: values.description,
        notes: values.notes || undefined,
        serviceFolio: values.serviceFolio || '9999',
        craneId: values.craneId || undefined,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          form.reset({
            date: getCurrentChileDate(),
            operatorId: '',
            amount: 0,
            description: '',
            notes: '',
            serviceFolio: '9999',
            craneId: '',
          });
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="mr-2 size-4" />
          Nueva comisión manual
        </Button>
      </DialogTrigger>
      <DialogContent className="finance-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar comisión manual</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? formatForDisplay(field.value) : 'Seleccionar fecha'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(createLocalDateFromCalendar(date))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="operatorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operador</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar operador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeOperators.map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Comisiones Extras Abril 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notas adicionales..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceFolio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folio de referencia (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="craneId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grúa (opcional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin asociar</SelectItem>
                      {cranes.map((crane) => (
                        <SelectItem key={crane.id} value={crane.id}>
                          {crane.licensePlate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createManualCommission.isPending}>
                {createManualCommission.isPending ? 'Guardando...' : 'Registrar comisión'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
