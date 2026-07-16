import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { businessClock } from '@/utils/businessClock';
import {
  IntercompanyAdjustmentFormValues,
  IntercompanyAdjustmentRow,
  useCreateIntercompanyAdjustment,
  useDeleteIntercompanyAdjustment,
  useIntercompanyAdjustments,
  useIntercompanyBalance,
} from '@/hooks/siircv/useIntercompanyAdjustments';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

const schema = z.object({
  adjustment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha válida'),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  direction: z.enum(['lowboy_to_g5n', 'g5n_to_lowboy']),
  description: z.string().trim().min(1, 'Ingrese una descripción'),
  reference: z.string().trim().optional(),
});

const defaultValues: IntercompanyAdjustmentFormValues = {
  adjustment_date: businessClock.today(),
  amount: 0,
  direction: 'lowboy_to_g5n',
  description: '',
  reference: '',
};

interface IntercompanyAccountSectionProps {
  desde: string;
  hasta: string;
}

export function IntercompanyAccountSection({ desde, hasta }: IntercompanyAccountSectionProps) {
  const { isAdmin } = useUserPermissions();
  const { data: adjustments = [], isLoading: isLoadingAdjustments } = useIntercompanyAdjustments();
  const { data: balance, isLoading: isLoadingBalance } = useIntercompanyBalance(desde, hasta);
  const createAdjustment = useCreateIntercompanyAdjustment();
  const deleteAdjustment = useDeleteIntercompanyAdjustment();

  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<IntercompanyAdjustmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (formOpen) form.reset(defaultValues);
  }, [formOpen, form]);

  const handleSubmit = async (values: IntercompanyAdjustmentFormValues) => {
    await createAdjustment.mutateAsync(values);
    setFormOpen(false);
  };

  const balanceOwed = balance?.balanceOwed ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Financiamiento G5N → LowBoy</CardTitle>
        {isAdmin && (
          <Button type="button" size="sm" onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="size-4" /> Registrar abono
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financiado (período)</p>
              <p className="mt-1 text-xl font-bold">{formatCLP(balance?.financedInRange ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financiado (histórico)</p>
              <p className="mt-1 text-xl font-bold">{formatCLP(balance?.financedTotal ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abonado neto</p>
              <p className="mt-1 text-xl font-bold">{formatCLP(balance?.adjustmentsNet ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Saldo adeudado por LowBoy</p>
              <p className="mt-1 text-xl font-bold text-primary">{isLoadingBalance ? '…' : formatCLP(balanceOwed)}</p>
            </CardContent>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingAdjustments ? (
              <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="h-20 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow>
            ) : adjustments.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="h-20 text-center text-muted-foreground">Aún no hay abonos registrados.</TableCell></TableRow>
            ) : adjustments.map((adj: IntercompanyAdjustmentRow) => (
              <TableRow key={adj.id}>
                <TableCell>{adj.adjustment_date}</TableCell>
                <TableCell className="text-sm">{adj.direction === 'lowboy_to_g5n' ? 'LowBoy → G5N' : 'G5N → LowBoy'}</TableCell>
                <TableCell className="max-w-64 truncate">{adj.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{adj.reference || '—'}</TableCell>
                <TableCell className="text-right">{formatCLP(Number(adj.amount))}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeletingId(adj.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar abono intercompañía</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="adjustment_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl><Input type="number" min={0} step="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="direction" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="lowboy_to_g5n">LowBoy → G5N (abono a la deuda)</SelectItem>
                      <SelectItem value="g5n_to_lowboy">G5N → LowBoy (nuevo financiamiento manual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea {...field} rows={2} placeholder="Ej: Transferencia bancaria de LowBoy a G5N" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl><Input {...field} placeholder="N° de transferencia, comprobante, etc." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={createAdjustment.isPending}>Cancelar</Button>
                <Button type="submit" disabled={createAdjustment.isPending}>
                  {createAdjustment.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Registrar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este abono?</AlertDialogTitle>
            <AlertDialogDescription>El saldo adeudado se recalculará automáticamente. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAdjustment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAdjustment.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deletingId) return;
                await deleteAdjustment.mutateAsync(deletingId);
                setDeletingId(null);
              }}
            >
              {deleteAdjustment.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
