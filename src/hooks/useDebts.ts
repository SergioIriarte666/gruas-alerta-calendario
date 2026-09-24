import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMonths, addWeeks, format } from 'date-fns';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const _logger = createLogger('useDebts');

export interface Debt {
  id: string;
  creditor_id: string;
  description: string;
  total_amount: number;
  installments_count: number;
  frequency: string;
  first_due_date: string;
  interest_enabled: boolean;
  interest_rate: number | null;
  adjustment_enabled: boolean;
  adjustment_rate: number | null;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  cost_center_id?: string | null;
  crane_id?: string | null;
  operator_id?: string | null;
  subcategory?: string | null;
  creditors?: { name: string; type: string };
}

export interface DebtWithProgress extends Debt {
  paid_count: number;
  paid_amount: number;
  pending_amount: number;
  overdue_count: number;
}

export interface DebtFormData {
  creditor_id: string;
  description: string;
  total_amount: number;
  installments_count: number;
  frequency: string;
  first_due_date: string;
  interest_enabled: boolean;
  interest_rate?: number | null;
  adjustment_enabled: boolean;
  adjustment_rate?: number | null;
  currency?: string;
  down_payment_amount?: number | null;
  down_payment_date?: string | null;
  down_payment_paid?: boolean;
  down_payment_method?: string | null;
  down_payment_payment_date?: string | null;
  cost_center_id?: string | null;
  crane_id?: string | null;
  operator_id?: string | null;
  subcategory?: string | null;
}

const generateInstallmentDates = (firstDate: string, count: number, frequency: string) => {
  const dates: string[] = [];
  const base = new Date(firstDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    let d: Date;
    if (frequency === 'weekly') d = addWeeks(base, i);
    else if (frequency === 'biweekly') d = addWeeks(base, i * 2);
    else d = addMonths(base, i); // monthly default
    dates.push(format(d, 'yyyy-MM-dd'));
  }
  return dates;
};

export const useDebts = () => {
  return useQuery({
    queryKey: ['debts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debts')
        .select('*, creditors(name, type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Debt[];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useDebtsWithProgress = () => {
  return useQuery({
    queryKey: ['debts-with-progress'],
    queryFn: async () => {
      const { data: debts, error: dErr } = await supabase
        .from('debts')
        .select('*, creditors(name, type)')
        .in('status', ['active', 'overdue'])
        .order('created_at', { ascending: false });
      if (dErr) throw dErr;

      const { data: installments, error: iErr } = await supabase
        .from('debt_installments')
        .select('debt_id, status, total_amount, paid_amount, due_date');
      if (iErr) throw iErr;

      const today = businessClock.today();

      return (debts || []).map((debt) => {
        const di = (installments || []).filter((i) => i.debt_id === debt.id);
        const paid = di.filter((i) => i.status === 'paid');
        const overdue = di.filter((i) => i.status === 'pending' && i.due_date < today);
        const pendingAmount = di
          .filter((i) => i.status !== 'paid')
          .reduce((s, i) => s + Number(i.total_amount) - Number(i.paid_amount || 0), 0);
        return {
          ...debt,
          paid_count: paid.length,
          paid_amount: di.reduce((s, i) => s + Number(i.paid_amount || 0), 0),
          pending_amount: pendingAmount,
          overdue_count: overdue.length,
        } as DebtWithProgress;
      });
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateDebt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DebtFormData) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Create debt
      const { data: debt, error } = await supabase
        .from('debts')
        .insert({
          creditor_id: data.creditor_id,
          description: data.description,
          total_amount: data.total_amount,
          installments_count: data.installments_count,
          frequency: data.frequency,
          first_due_date: data.first_due_date,
          interest_enabled: data.interest_enabled,
          interest_rate: data.interest_rate || null,
          adjustment_enabled: data.adjustment_enabled,
          adjustment_rate: data.adjustment_rate || null,
          currency: data.currency || 'CLP',
          cost_center_id: data.cost_center_id || null,
          crane_id: data.crane_id || null,
          operator_id: data.operator_id || null,
          subcategory: data.subcategory || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      // Generate installments
      const hasDownPayment = !!data.down_payment_amount;
      const installmentsCount = data.installments_count;
      const remainingCount = hasDownPayment ? (installmentsCount - 1) : installmentsCount;
      if (remainingCount <= 0) throw new Error('Cantidad de cuotas inválida');
      const dates = generateInstallmentDates(data.first_due_date, remainingCount, data.frequency);
      const isUF = (data.currency || 'CLP') === 'UF';
      const remainingTotal = hasDownPayment ? (data.total_amount - Number(data.down_payment_amount)) : data.total_amount;
      if (remainingTotal < 0) throw new Error('El pie no puede ser mayor al monto total');
      const baseAmount = remainingCount > 0 ? remainingTotal / remainingCount : 0;
      const normalizedBase = isUF ? Number(baseAmount.toFixed(4)) : Math.round(baseAmount);

      const installments = [
        ...(hasDownPayment
          ? [{
              debt_id: debt.id,
              installment_number: 1,
              due_date: String(data.down_payment_date || data.first_due_date),
              principal_amount: isUF ? Number(Number(data.down_payment_amount).toFixed(4)) : Math.round(Number(data.down_payment_amount)),
              interest_amount: 0,
              adjustment_amount: 0,
              total_amount: isUF ? Number(Number(data.down_payment_amount).toFixed(4)) : Math.round(Number(data.down_payment_amount)),
              status: 'pending',
              paid_amount: 0,
              paid_date: null,
              created_by: userId,
            }] : []),
        ...dates.map((dueDate, i) => ({
          debt_id: debt.id,
          installment_number: hasDownPayment ? i + 2 : i + 1,
          due_date: dueDate,
          principal_amount: normalizedBase,
          interest_amount: data.interest_enabled && data.interest_rate
            ? (isUF
              ? Number((normalizedBase * (data.interest_rate / 100)).toFixed(4))
              : Math.round(normalizedBase * (data.interest_rate / 100)))
            : 0,
          adjustment_amount: 0,
          total_amount: data.interest_enabled && data.interest_rate
            ? (isUF
              ? Number((normalizedBase * (1 + data.interest_rate / 100)).toFixed(4))
              : Math.round(normalizedBase * (1 + data.interest_rate / 100)))
            : normalizedBase,
          status: 'pending',
          paid_amount: 0,
          paid_date: null,
          created_by: userId,
        }))
      ];

      const { error: iErr } = await supabase.from('debt_installments').insert(installments);
      if (iErr) throw iErr;

      // Marcar el pie como pagado solo si el usuario así lo decide
      if (hasDownPayment && data.down_payment_paid) {
        const { data: firstInstallment } = await supabase
          .from('debt_installments')
          .select('id,total_amount')
          .eq('debt_id', debt.id)
          .eq('installment_number', 1)
          .limit(1)
          .single();
        if (firstInstallment?.id) {
          const paymentDate = String(data.down_payment_payment_date || data.down_payment_date || data.first_due_date);
          const pieAmount = (data.currency || 'CLP') === 'UF'
            ? Number(Number(data.down_payment_amount).toFixed(4))
            : Math.round(Number(data.down_payment_amount));

          const { error: uErr } = await supabase
            .from('debt_installments')
            .update({
              status: 'paid',
              paid_amount: pieAmount,
              paid_date: paymentDate,
              updated_by: userId,
            })
            .eq('id', firstInstallment.id);
          if (uErr) throw uErr;

          const { error: pErr } = await supabase.from('debt_payments').insert({
            debt_installment_id: firstInstallment.id,
            amount: pieAmount,
            payment_date: paymentDate,
            method: data.down_payment_method || 'initial',
            notes: 'Pago inicial (pie) registrado al crear la deuda',
            created_by: userId,
          });
          if (pErr) throw pErr;

          // Crear costo solo para CLP (UF requiere valor UF y se genera al pagar desde el modal)
          if ((data.currency || 'CLP') === 'CLP') {
            const { data: categories } = await supabase
              .from('cost_categories')
              .select('id')
              .ilike('name', 'Deudas y Obligaciones')
              .limit(1);
            const categoryId = categories?.[0]?.id;
            const { data: creditor } = await supabase
              .from('creditors')
              .select('name')
              .eq('id', data.creditor_id)
              .limit(1)
              .single();
            if (categoryId) {
              const { error: cErr } = await supabase.from('costs').insert({
                description: `Cuota 1 de ${data.description} - ${creditor?.name || 'Acreedor'}`,
                amount: pieAmount,
                date: paymentDate,
                payment_date: paymentDate,
                category_id: categoryId,
                subcategory: data.subcategory || null,
                cost_center_id: data.cost_center_id || null,
                crane_id: data.crane_id || null,
                operator_id: data.operator_id || null,
                created_by: userId,
                entity: 'gruas_5_norte',
                paid_by: 'gruas_5_norte',
              });
              if (cErr) throw cErr;
            }
          }
        }
      }

      return debt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['debts-with-progress'] });
      qc.invalidateQueries({ queryKey: ['debt-installments'] });
      qc.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Deuda creada con cuotas generadas');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
};

export const useUpdateDebt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DebtFormData> }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const updateData: any = {
        description: data.description,
        total_amount: data.total_amount,
        installments_count: data.installments_count,
        frequency: data.frequency,
        first_due_date: data.first_due_date,
        interest_enabled: data.interest_enabled,
        interest_rate: data.interest_enabled ? (data.interest_rate ?? null) : null,
        adjustment_enabled: data.adjustment_enabled,
        adjustment_rate: data.adjustment_enabled ? (data.adjustment_rate ?? null) : null,
        currency: data.currency,
        cost_center_id: data.cost_center_id ?? undefined,
        crane_id: data.crane_id ?? undefined,
        operator_id: data.operator_id ?? undefined,
        subcategory: data.subcategory ?? undefined,
        updated_by: userId,
        updated_at: businessClock.nowISO(),
      };
      Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);
      const { error } = await supabase.from('debts').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['debts-with-progress'] });
      toast.success('Deuda actualizada');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}
