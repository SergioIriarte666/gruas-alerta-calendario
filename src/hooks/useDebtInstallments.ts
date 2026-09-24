import { businessClock } from '@/utils/businessClock';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useDebtInstallments");

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
    currency?: string;
    cost_center_id?: string | null;
    crane_id?: string | null;
    operator_id?: string | null;
    subcategory?: string | null;
    creditors?: { name: string; type: string };
  };
}

export const useDebtInstallments = (debtId?: string) => {
  return useQuery({
    queryKey: ['debt-installments', debtId],
    queryFn: async () => {
      let query = supabase
        .from('debt_installments')
        .select('*, debts(description, creditor_id, currency, cost_center_id, crane_id, operator_id, subcategory, creditors(name, type))')
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
  const target = monthDate || businessClock.todayDate();
  const start = format(startOfMonth(target), 'yyyy-MM-dd');
  const end = format(endOfMonth(target), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['debt-installments-monthly', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_installments')
        .select('*, debts(description, creditor_id, currency, cost_center_id, crane_id, operator_id, subcategory, creditors(name, type))')
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
      uf_value,
    }: {
      installment: DebtInstallment;
      paymentDate: string;
      method?: string;
      notes?: string;
      uf_value?: number | null;
    }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const previouslyPaid = Number(installment.paid_amount || 0);
      const installmentAmount = Number(installment.total_amount) - previouslyPaid;
      if (installmentAmount <= 0) {
        throw new Error('La cuota ya está completamente pagada');
      }
      const isUF = installment.debts?.currency === 'UF';
      const ufValue = isUF ? Number(uf_value || 0) : 0;
      if (isUF && (!ufValue || ufValue <= 0)) {
        throw new Error('Debe ingresar el valor de la UF para calcular el monto en CLP');
      }
      const clpAmount = isUF ? Math.round(installmentAmount * ufValue) : Math.round(installmentAmount);
      const installmentLabel = `Cuota ${installment.installment_number}`;

      // 1. Update installment
      const { error: uErr } = await supabase
        .from('debt_installments')
        .update({
          status: 'paid',
          paid_date: paymentDate,
          paid_amount: Number(installment.total_amount),
          updated_by: userId,
        })
        .eq('id', installment.id);
      if (uErr) {
        logger.error('[useDebtInstallments] Error actualizando cuota a pagada:', uErr);
        throw uErr;
      }

      // 2. Create debt_payment record
      const paymentNotes = [
        notes || null,
        isUF ? `UF: ${installmentAmount} | Valor UF: ${ufValue} | CLP: ${clpAmount}` : null,
      ].filter(Boolean).join(' · ') || null;

      const { error: pErr } = await supabase.from('debt_payments').insert({
        debt_installment_id: installment.id,
        amount: installmentAmount,
        payment_date: paymentDate,
        method: method || null,
        notes: paymentNotes,
        created_by: userId,
      });
      if (pErr) {
        logger.error('[useDebtInstallments] Error registrando pago de cuota:', pErr);
        throw pErr;
      }

      // 3. Find "Deudas y Obligaciones" category
      const { data: categories } = await supabase
        .from('cost_categories')
        .select('id')
        .ilike('name', 'Deudas y Obligaciones')
        .limit(1);

      const categoryId = categories?.[0]?.id;
      if (!categoryId) {
        logger.error('[useDebtInstallments] Categoría "Deudas y Obligaciones" no encontrada');
        throw new Error('Categoría "Deudas y Obligaciones" no encontrada');
      }

      const creditorName = installment.debts?.creditors?.name || 'Acreedor';
      const debtDesc = installment.debts?.description || 'Deuda';
      const debtCostCenterId = installment.debts?.cost_center_id || null;
      const debtCraneId = installment.debts?.crane_id || null;
      const debtOperatorId = installment.debts?.operator_id || null;
      const debtSubcategory = installment.debts?.subcategory || null;

      // 4. Create cost record
      const { error: cErr } = await supabase.from('costs').insert({
        description: `${installmentLabel} de ${debtDesc} - ${creditorName}`,
        amount: clpAmount,
        date: paymentDate,
        payment_date: paymentDate,
        category_id: categoryId,
        subcategory: debtSubcategory,
        cost_center_id: debtCostCenterId,
        crane_id: debtCraneId,
        operator_id: debtOperatorId,
        notes: paymentNotes,
        created_by: userId,
        entity: 'gruas_5_norte',
        paid_by: 'gruas_5_norte',
      });
      if (cErr) {
        logger.error('[useDebtInstallments] Error creando costo al pagar cuota:', cErr);
        throw cErr;
      }
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
