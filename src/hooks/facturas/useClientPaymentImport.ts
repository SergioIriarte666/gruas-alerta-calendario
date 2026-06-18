import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { parseClientPaymentExcel } from '@/utils/parseClientPaymentExcel';
import type {
  ClientPaymentImportError,
  ClientPaymentRow,
  ValidatedClientPaymentRow,
} from '@/types/clientPaymentImport';

const logger = createLogger('ClientPaymentImport');

function getImportErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Error inesperado';
}

export function useClientPaymentImport() {
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<ClientPaymentRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedClientPaymentRow[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<ClientPaymentImportError[]>([]);
  const [batchSummary, setBatchSummary] = useState<{ imported: number; skipped: number; totalAmount: number } | null>(null);

  const reset = () => {
    setFilename('');
    setRows([]);
    setValidatedRows([]);
    setStep(1);
    setIsValidating(false);
    setIsImporting(false);
    setProgress({ current: 0, total: 0 });
    setImportErrors([]);
    setBatchSummary(null);
  };

  const validateRows = async (sourceRows: ClientPaymentRow[]) => {
    setIsValidating(true);
    try {
      const seenRefs = new Set<string>();

      const result: ValidatedClientPaymentRow[] = [];
      for (const row of sourceRows) {
        if (seenRefs.has(row.referencia)) {
          result.push({ ...row, invoice: null, matchStatus: 'duplicate', incluir: false });
          continue;
        }
        seenRefs.add(row.referencia);

        const { data: invoice, error } = await supabase
          .from('invoices')
          .select('id, folio, numero_fiscal, total, remaining_amount, status, client_id')
          .eq('numero_fiscal', row.referencia.trim())
          .maybeSingle();

        if (error) {
          logger.error('Error validating row', row.referencia, error);
          result.push({ ...row, invoice: null, matchStatus: 'not_found', incluir: false });
          continue;
        }

        if (!invoice) {
          result.push({ ...row, invoice: null, matchStatus: 'not_found', incluir: false });
          continue;
        }

        if (invoice.status === 'paid') {
          result.push({ ...row, invoice, matchStatus: 'already_paid', incluir: false });
          continue;
        }

        const remaining = Number(invoice.remaining_amount ?? 0);
        if (remaining === row.monto) {
          result.push({ ...row, invoice, matchStatus: 'found', incluir: true });
        } else {
          result.push({ ...row, invoice, matchStatus: 'partial_mismatch', incluir: false });
        }
      }

      setValidatedRows(result);
    } finally {
      setIsValidating(false);
    }
  };

  const loadFile = async (file: File) => {
    const parsedRows = await parseClientPaymentExcel(file);
    setFilename(file.name);
    setRows(parsedRows);
    setStep(2);
    await validateRows(parsedRows);
  };

  const toggleIncluir = (id: string, incluir: boolean) => {
    setValidatedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, incluir } : row)),
    );
  };

  const toggleAll = (value: boolean) => {
    setValidatedRows((prev) =>
      prev.map((row) =>
        row.matchStatus === 'found' || row.matchStatus === 'partial_mismatch'
          ? { ...row, incluir: value }
          : row,
      ),
    );
  };

  const importRows = async () => {
    const eligible = validatedRows.filter(
      (row) => row.incluir && (row.matchStatus === 'found' || row.matchStatus === 'partial_mismatch') && row.invoice,
    );

    setIsImporting(true);
    setStep(3);
    setProgress({ current: 0, total: eligible.length });
    setImportErrors([]);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        source_module: 'client_payment_import',
        filename,
        status: 'pending',
        payload: { rows: eligible },
        created_by: userId,
      })
      .select('id')
      .single();

    if (batchError || !batch) {
      logger.error('Error creating import batch', batchError);
      setIsImporting(false);
      throw new Error('No se pudo crear el lote de importación');
    }

    let imported = 0;
    let totalAmount = 0;
    const errors: ClientPaymentImportError[] = [];

    for (const row of eligible) {
      if (!row.invoice) continue;
      try {
        if (!row.fechaPago) {
          errors.push({
            referencia: row.referencia,
            error: 'Fecha de pago inválida o vacía',
          });
          continue;
        }

        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .insert({
            client_id: row.invoice.client_id,
            amount: row.monto,
            payment_date: row.fechaPago,
            payment_method: 'transferencia',
            bank_reference: `NF-${row.referencia}`,
            notes: row.detalle || null,
            status: 'pending',
            created_by: userId,
          })
          .select('id')
          .single();

        if (paymentError) {
          const msg = paymentError.message || paymentError.details || JSON.stringify(paymentError);
          errors.push({ referencia: row.referencia, error: msg });
          continue;
        }

        if (!payment) throw new Error('Error al crear pago');

        const appliedAmount = Math.min(row.monto, row.invoice.remaining_amount);
        const { data: application, error: applicationError } = await supabase
          .from('payment_applications')
          .insert({
            payment_id: payment.id,
            invoice_id: row.invoice.id,
            applied_amount: appliedAmount,
            application_method: 'manual',
            notes: `Importación pago cliente | NF ${row.referencia}`,
            created_by: userId,
          })
          .select('id')
          .single();

        if (applicationError || !application) {
          const message = applicationError?.message?.includes('overpayment')
            ? `Monto supera saldo pendiente (NF-${row.referencia})`
            : applicationError?.message ?? 'Error al aplicar pago';
          throw new Error(message);
        }

        await supabase.from('import_batch_records').insert([
          { batch_id: batch.id, table_name: 'payments', record_id: payment.id },
          { batch_id: batch.id, table_name: 'payment_applications', record_id: application.id },
        ]);

        imported += 1;
        totalAmount += row.monto;
      } catch (error) {
        const message = getImportErrorMessage(error);
        errors.push({ referencia: row.referencia, error: message });
        logger.error('Error importing row', row.referencia, error);
      } finally {
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }));
      }
    }

    setImportErrors(errors);

    const summary = {
      total: eligible.length,
      imported,
      skipped: eligible.length - imported,
      errors: errors.length,
      total_amount: totalAmount,
    };

    await supabase
      .from('import_batches')
      .update({ status: 'completed', summary })
      .eq('id', batch.id);

    setBatchSummary({ imported, skipped: eligible.length - imported, totalAmount });
    setIsImporting(false);

    return { imported, errors };
  };

  return {
    filename,
    rows,
    validatedRows,
    step,
    isValidating,
    isImporting,
    progress,
    importErrors,
    batchSummary,
    loadFile,
    toggleIncluir,
    toggleAll,
    importRows,
    setStep,
    reset,
  };
}
