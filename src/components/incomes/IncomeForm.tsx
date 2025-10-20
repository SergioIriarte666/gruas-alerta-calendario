import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { incomeSchema, IncomeFormValues } from '@/schemas/incomeSchema';
import { IncomeWithDetails } from '@/types/incomes';
import { useCreateIncome, useUpdateIncome } from '@/hooks/incomes/useIncomes';
import { useIncomeCategories } from '@/hooks/incomes/useIncomeCategories';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface IncomeFormProps {
  isOpen: boolean;
  onClose: () => void;
  income?: IncomeWithDetails | null;
}

export const IncomeForm = ({ isOpen, onClose, income }: IncomeFormProps) => {
  const { data: categories = [] } = useIncomeCategories();
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();

  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      income_date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      category_id: '',
      subcategory: '',
      payment_method: 'transferencia',
      bank_reference: '',
      client_id: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (income) {
      form.reset({
        income_date: income.income_date,
        amount: income.amount,
        description: income.description,
        category_id: income.category_id || '',
        subcategory: income.subcategory || '',
        payment_method: income.payment_method,
        bank_reference: income.bank_reference || '',
        client_id: income.client_id || '',
        notes: income.notes || '',
      });
    } else {
      form.reset({
        income_date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        category_id: '',
        subcategory: '',
        payment_method: 'transferencia',
        bank_reference: '',
        client_id: '',
        notes: '',
      });
    }
  }, [income, form]);

  const onSubmit = async (data: IncomeFormValues) => {
    try {
      // Remove empty optional fields
      const cleanData = {
        ...data,
        client_id: data.client_id || undefined,
        bank_reference: data.bank_reference || undefined,
        subcategory: data.subcategory || undefined,
        notes: data.notes || undefined,
      };

      if (income) {
        await updateIncome.mutateAsync({ ...cleanData, id: income.id } as any);
      } else {
        await createIncome.mutateAsync(cleanData as any);
      }
      onClose();
      form.reset();
    } catch (error) {
      console.error('Error saving income:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{income ? 'Editar Ingreso' : 'Registrar Nuevo Ingreso'}</DialogTitle>
          <DialogDescription>
            Complete los detalles del ingreso bancario
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="income_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Breve descripción del ingreso" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
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
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategoría</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opcional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de Pago *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="deposito">Depósito</SelectItem>
                        <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                        <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bank_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia Bancaria</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="N° de operación" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente Asociado (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin cliente asociado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sin cliente asociado</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Información adicional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createIncome.isPending || updateIncome.isPending}>
                {income ? 'Actualizar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
