import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMonths, addWeeks, format } from 'date-fns';

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

      const today = format(new Date(), 'yyyy-MM-dd');

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
          paid_amount: paid.reduce((s, i) => s + Number(i.paid_amount || 0), 0),
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
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      // Generate installments
      const dates = generateInstallmentDates(data.first_due_date, data.installments_count, data.frequency);
      const baseAmount = data.total_amount / data.installments_count;

      const installments = dates.map((dueDate, i) => ({
        debt_id: debt.id,
        installment_number: i + 1,
        due_date: dueDate,
        principal_amount: Math.round(baseAmount),
        interest_amount: data.interest_enabled && data.interest_rate
          ? Math.round(baseAmount * (data.interest_rate / 100))
          : 0,
        adjustment_amount: 0,
        total_amount: data.interest_enabled && data.interest_rate
          ? Math.round(baseAmount * (1 + data.interest_rate / 100))
          : Math.round(baseAmount),
        status: 'pending',
        created_by: userId,
      }));

      const { error: iErr } = await supabase.from('debt_installments').insert(installments);
      if (iErr) throw iErr;

      return debt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['debts-with-progress'] });
      qc.invalidateQueries({ queryKey: ['debt-installments'] });
      toast.success('Deuda creada con cuotas generadas');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
};
