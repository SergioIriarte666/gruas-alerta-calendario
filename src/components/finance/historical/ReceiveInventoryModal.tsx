import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { businessClock } from '@/utils/businessClock';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { useInventoryItems, useInventoryLocations, useCreateInventoryMovement, useInventoryMovementsByReference } from '@/hooks/useInventory';
import { Loader2, Plus, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ReceiveInventoryModal");
const inventoryItemSchema = z.object({
  item_id: z.string().min(1, 'Selecciona un producto'),
  quantity: z.coerce.number().min(1, 'La cantidad debe ser mayor a 0'),
  unit_cost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  location_id: z.string().min(1, 'Selecciona una ubicación'),
});

const receiveInventorySchema = z.object({
  items: z.array(inventoryItemSchema).min(1, 'Agrega al menos un producto'),
  observations: z.string().optional(),
  generateCost: z.boolean().default(true),
});

type ReceiveInventoryFormValues = z.infer<typeof receiveInventorySchema>;

interface ReceiveInventoryModalProps {
  invoice: SupplierInvoiceWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiveInventoryModal = ({
  invoice,
  isOpen,
  onClose,
}: ReceiveInventoryModalProps) => {
  const { data: inventoryItems } = useInventoryItems();
  const { data: locations } = useInventoryLocations();
  const { mutateAsync: createMovement, isPending } = useCreateInventoryMovement();

  // Fetch existing movements for this invoice to show history
  const { data: existingMovements, isLoading: _isLoadingMovements } = useInventoryMovementsByReference(
    isOpen ? invoice?.invoice_number || null : null
  );

  const form = useForm<ReceiveInventoryFormValues>({
    resolver: zodResolver(receiveInventorySchema),
    defaultValues: {
      items: [
        {
          item_id: '',
          quantity: 1,
          unit_cost: 0,
          location_id: '',
        },
      ],
      observations: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && invoice) {
      form.reset({
        items: [
          {
            item_id: '',
            quantity: 1,
            unit_cost: 0,
            location_id: locations?.[0]?.id || '',
          },
        ],
        observations: `Recepción de factura ${invoice.invoice_number} - ${invoice.supplier?.name || 'Proveedor'}`,
      });
    }
  }, [isOpen, invoice, locations, form]);

  const onSubmit = async (data: ReceiveInventoryFormValues) => {
    if (!invoice) return;

    try {
      // Process all items sequentially
      for (const item of data.items) {
        await createMovement({
          item_id: item.item_id,
          location_id: item.location_id,
          movement_type: 'entry',
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          movement_date: businessClock.nowISO(), // Use current date for reception
          observations: data.observations,
          supplier_id: invoice.supplier_id || undefined,
          supplier_name: invoice.supplier?.name,
          reference_document: invoice.invoice_number,
          generateCost: data.generateCost,
        });
      }

      toast.success('Inventario recibido correctamente');
      onClose();
    } catch (error) {
      logger.error('Error receiving inventory:', error);
      // Toast is handled by mutation hook error handler usually, but here we loop so maybe catch global
    }
  };

  const updateUnitCost = (index: number, itemId: string) => {
    const item = inventoryItems?.find((i) => i.id === itemId);
    if (item) {
      form.setValue(`items.${index}.unit_cost`, item.unit_cost);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibir en Inventario</DialogTitle>
          <DialogDescription>
            Registra el ingreso de productos asociados a la factura {invoice?.invoice_number}
          </DialogDescription>
        </DialogHeader>

        {existingMovements && existingMovements.length > 0 && (
          <div className="mb-4 space-y-3 p-4 border rounded-md bg-muted/20">
            <h4 className="text-sm font-medium flex items-center gap-2 text-primary">
              <PackageCheck className="size-4" />
              Inventario ya recibido ({existingMovements.length})
            </h4>
            <div className="rounded-md border bg-background overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-2 border-b text-xs font-medium text-muted-foreground bg-muted/50">
                <div className="col-span-6">Producto</div>
                <div className="col-span-2 text-center">Cant.</div>
                <div className="col-span-2 text-right">Costo</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {existingMovements.map((mov) => (
                  <div key={mov.id} className="grid grid-cols-12 gap-2 p-2 border-b last:border-0 text-xs items-center hover:bg-muted/10">
                    <div className="col-span-6 font-medium truncate" title={mov.item?.name}>
                      {mov.item?.name || 'Item eliminado'}
                    </div>
                    <div className="col-span-2 text-center">
                      {mov.quantity}
                    </div>
                    <div className="col-span-2 text-right">
                      {mov.unit_cost ? formatCurrency(mov.unit_cost) : '-'}
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {mov.unit_cost ? formatCurrency(mov.unit_cost * mov.quantity) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end border p-4 rounded-md bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                    <FormField
                      control={form.control}
                      name={`items.${index}.item_id`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Producto</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              updateUnitCost(index, value);
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar producto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inventoryItems?.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.unit_of_measure})
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
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_cost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo Unit.</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.location_id`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Ubicación</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar ubicación" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations?.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    item_id: '',
                    quantity: 1,
                    unit_cost: 0,
                    location_id: locations?.[0]?.id || '',
                  })
                }
                className="w-full border-dashed"
              >
                <Plus className="mr-2 size-4" />
                Agregar otro producto
              </Button>
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Generar Costo</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Crear automáticamente un registro de costo asociado a esta recepción.
                </div>
              </div>
              <FormField
                control={form.control}
                name="generateCost"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles adicionales..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Registrar Ingreso
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
