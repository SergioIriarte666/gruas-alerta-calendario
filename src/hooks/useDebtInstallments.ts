import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface DebtInstallment {
  id: string;
  debt_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  adjustment_amount: number;
  total_amount: number;
  paid_amount: number;
  paid_date: string | null;
  status: string;
  debts?: {
    description: string;
    creditor_id: string;
    creditors?: { name: string; type: string };
  };
}

export const useDebtInstallments = (debtId?: string) => {
  return useQuery({
    queryKey: ['debt-installments', debtId],
    queryFn: async () => {
      let query = supabase
        .from('debt_installments')
        .select('*, debts(description, creditor_id, creditors(name, type))')
        .order('due_date');

      if (debtId) query = query.eq('debt_id', debtId);

      const { data, error } = await query;
      if (error) throw error;
      return data as DebtInstallment[];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useMonthlyInstallments = (monthDate?: Date) => {
  const target = monthDate || new Date();
  const start = format(startOfMonth(target), 'yyyy-MM-dd');
  const end = format(endOfMonth(target), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['debt-installments-monthly', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_installments')
        .select('*, debts(description, creditor_id, creditors(name, type))')
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date');
      if (error) throw error;
      return data as DebtInstallment[];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const usePayInstallment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      installment,
      paymentDate,
      method,
      notes,
    }: {
      installment: DebtInstallment;
      paymentDate: string;
      method?: string;
      notes?: string;
    }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const amount = Number(installment.total_amount);

      // 1. Update installment
      const { error: uErr } = await supabase
        .from('debt_installments')
        .update({
          status: 'paid',
          paid_date: paymentDate,
          paid_amount: amount,
          updated_by: userId,
        })
        .eq('id', installment.id);
      if (uErr) throw uErr;

      // 2. Create debt_payment record
      const { error: pErr } = await supabase.from('debt_payments').insert({
        debt_installment_id: installment.id,
        amount,
        payment_date: paymentDate,
        method: method || null,
        notes: notes || null,
        created_by: userId,
      });
      if (pErr) throw pErr;

      // 3. Find "Deudas y Obligaciones" category
      const { data: categories } = await supabase
        .from('cost_categories')
        .select('id')
        .ilike('name', 'Deudas y Obligaciones')
        .limit(1);

      const categoryId = categories?.[0]?.id;
      if (!categoryId) throw new Error('Categoría "Deudas y Obligaciones" no encontrada');

      const creditorName = installment.debts?.creditors?.name || 'Acreedor';
      const debtDesc = installment.debts?.description || 'Deuda';

      // 4. Create cost record
      const { error: cErr } = await supabase.from('costs').insert({
        description: `Cuota ${installment.installment_number} de ${debtDesc} - ${creditorName}`,
        amount,
        date: paymentDate,
        payment_date: paymentDate,
        category_id: categoryId,
        created_by: userId,
      });
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-installments'] });
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['debts-with-progress'] });
      qc.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Pago registrado y costo creado');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
};
