import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ServiceRateWithRelations, ServiceRateFormData } from '@/types/serviceRates';
import { useClients } from '@/hooks/useClients';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { Loader2 } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';

const formSchema = z.object({
  client_id: z.string().min(1, 'Seleccione un cliente'),
  service_type_id: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  value: z.coerce.number().min(0, 'El valor debe ser mayor o igual a 0'),
  is_active: z.boolean(),
  notes: z.string().optional(),
});

interface ServiceRateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceRateFormData) => Promise<void>;
  rate?: ServiceRateWithRelations | null;
}

export const ServiceRateForm: React.FC<ServiceRateFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  rate,
}) => {
  const { clients } = useClients();
  const { serviceTypes } = useServiceTypes();
  const isEditing = !!rate;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: '',
      service_type_id: '',
      origin: '',
      destination: '',
      value: 0,
      is_active: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (rate) {
      form.reset({
        client_id: rate.client_id,
        service_type_id: rate.service_type_id || '',
        origin: rate.origin,
        destination: rate.destination || '',
        value: Number(rate.value),
        is_active: rate.is_active,
        notes: rate.notes || '',
      });
    } else {
      form.reset({
        client_id: '',
        service_type_id: '',
        origin: '',
        destination: '',
        value: 0,
        is_active: true,
        notes: '',
      });
    }
  }, [rate, form, isOpen]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    await onSubmit({
      client_id: values.client_id,
      service_type_id: values.service_type_id || null,
      origin: values.origin?.trim() || null,
      destination: values.destination || null,
      value: values.value,
      is_active: values.is_active,
      notes: values.notes || null,
    });
    onClose();
  };

  const activeClients = clients.filter((c) => c.isActive !== false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="configuration-dialog max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Tarifa' : 'Nueva Tarifa'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la tarifa'
              : 'Define un precio predeterminado por cliente y ruta'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {toTitleCase(client.name)} {client.department && `(${client.department})`}
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
              name="service_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Servicio (opcional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los tipos" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__NONE__">Todos los tipos</SelectItem>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Santiago Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Aeropuerto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor del Servicio (CLP) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      {...field}
                    />
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
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones adicionales..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Tarifa Activa</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Las tarifas inactivas no se aplicarán automáticamente
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                )}
                {isEditing ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
