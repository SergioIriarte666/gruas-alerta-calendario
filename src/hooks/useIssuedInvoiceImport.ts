import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readIssuedInvoicePdf } from '@/utils/readIssuedInvoicePdf';
import {
  normalizeInvoiceRut,
  parseIssuedInvoiceText,
  reconciliationErrors,
  type InvoiceCandidate,
  type IssuedInvoiceDocument,
  type IssuedInvoiceDraft,
} from '@/utils/issuedInvoiceImport';
import {
  existingFiscalNumbers,
  findIssuedInvoiceFile,
  fiscalKey,
  getIssuedInvoiceCandidates,
  INVOICE_PDF_BUCKET,
  listIssuedInvoiceDrafts,
  registerIssuedInvoice,
  saveIssuedInvoiceDraft,
} from '@/utils/issuedInvoiceApi';

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : (error as { message?: string })?.message ||
      'No se pudo completar la operación.';
export function useIssuedInvoiceImport() {
  const cache = useQueryClient();
  const [documents, setDocuments] = useState<IssuedInvoiceDocument[]>([]);
  const [candidates, setCandidates] = useState<
    Record<string, InvoiceCandidate[]>
  >({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const refresh = useCallback(async (docs: IssuedInvoiceDocument[]) => {
    const next: Record<string, InvoiceCandidate[]> = {};
    const issues: Record<string, string> = {};
    const byRut = new Map<string, InvoiceCandidate[]>();
    for (const doc of docs.filter((d) => !d.result)) {
      const rut = normalizeInvoiceRut(doc.draft.fields.clientRut || '');
      if (!rut) {
        issues[doc.id] = 'Completa el RUT receptor para buscar servicios.';
        continue;
      }
      try {
        if (!byRut.has(rut))
          byRut.set(rut, await getIssuedInvoiceCandidates(rut));
        next[doc.id] = byRut.get(rut)!;
      } catch (e) {
        issues[doc.id] = message(e);
      }
    }
    const duplicates = await existingFiscalNumbers(
      docs.filter((d) => !d.result).map((d) => d.draft.fields.fiscalNumber),
    );
    setCandidates(next);
    setProblems(issues);
    setExisting(duplicates);
  }, []);
  const load = useCallback(async () => {
    setBusy('Cargando borradores guardados…');
    setError('');
    try {
      const docs = await listIssuedInvoiceDrafts();
      setDocuments(docs);
      setSelected(new Set());
      await refresh(docs);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  }, [refresh]);
  const upload = async (files: File[]) => {
    setBusy('Preparando documentos…');
    setError('');
    setFileErrors([]);
    const docs = [...documents];
    const errors: string[] = [];
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user)
        throw new Error('Inicia sesión para guardar el lote.');
      for (const [i, file] of files.entries()) {
        setBusy(`Leyendo ${i + 1}/${files.length}: ${file.name}`);
        try {
          if (!/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024)
            throw new Error('Debe ser PDF y no superar 20 MB.');
          const bytes = await file.arrayBuffer();
          const hash = [
            ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          ]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          let doc = await findIssuedInvoiceFile(hash);
          if (!doc) {
            const text = await readIssuedInvoicePdf(file);
            const path = `${user.id}/${hash}.pdf`;
            const { error: uploadError } = await supabase.storage
              .from(INVOICE_PDF_BUCKET)
              .upload(path, file, {
                contentType: 'application/pdf',
                upsert: false,
              });
            // A prior attempt may have uploaded the original before losing connectivity.
            if (
              uploadError &&
              !['409', 'Duplicate'].includes(
                String((uploadError as { statusCode?: string }).statusCode),
              ) &&
              !/already exists/i.test(uploadError.message)
            )
              throw uploadError;
            doc = await saveIssuedInvoiceDraft(
              { file_hash: hash, file_name: file.name, storage_path: path },
              {
                fields: parseIssuedInvoiceText(text),
                selectedKeys: [],
                reviewed: false,
                manualReason: '',
              },
            );
          }
          if (!docs.some((d) => d.id === doc.id)) docs.push(doc);
          setDocuments([...docs]);
        } catch (e) {
          errors.push(`${file.name}: ${message(e)}`);
          setFileErrors([...errors]);
        }
      }
      await refresh(docs);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  };
  const save = async (
    doc: IssuedInvoiceDocument,
    draft: IssuedInvoiceDraft,
  ) => {
    setBusy('Guardando revisión…');
    setError('');
    try {
      const saved = await saveIssuedInvoiceDraft(doc, draft);
      const docs = documents.map((d) => (d.id === saved.id ? saved : d));
      setDocuments(docs);
      setSelected((prev) => new Set([...prev].filter((id) => id !== doc.id)));
      await refresh(docs);
    } finally {
      setBusy('');
    }
  };
  const issues = useMemo(
    () =>
      Object.fromEntries(
        documents.map((doc) => {
          if (doc.result) return [doc.id, []];
          const reasons = reconciliationErrors(
            doc.draft,
            candidates[doc.id] || [],
          );
          if (problems[doc.id]) reasons.unshift(problems[doc.id]);
          if (
            documents.some(
              (other) =>
                other.id !== doc.id &&
                !other.result &&
                other.draft.selectedKeys.some((key) =>
                  doc.draft.selectedKeys.includes(key),
                ),
            )
          )
            reasons.unshift(
              'Un servicio y tipo de monto está asignado a varias facturas del lote. Revisa la distribución.',
            );
          const key = fiscalKey(doc.draft.fields.fiscalNumber);
          if (key && existing.has(key))
            reasons.unshift('Ya registrada en TMS.');
          if (
            key &&
            documents.filter(
              (d) =>
                !d.result && fiscalKey(d.draft.fields.fiscalNumber) === key,
            ).length > 1
          )
            reasons.unshift(
              'Folio repetido en los documentos del lote. Revisa el folio o procesa un solo documento de origen.',
            );
          return [doc.id, reasons];
        }),
      ),
    [documents, candidates, problems, existing],
  );
  const ready = documents.filter(
    (d) => !d.result && issues[d.id]?.length === 0,
  );
  const run = async () => {
    const pending = ready.filter((d) => selected.has(d.id));
    if (!pending.length) return;
    setBusy('Verificando y registrando…');
    setError('');
    const docs = [...documents];
    try {
      for (const [i, doc] of pending.entries()) {
        setBusy(
          `Registrando ${i + 1}/${pending.length} · Factura ${doc.draft.fields.fiscalNumber}`,
        );
        try {
          const result = await registerIssuedInvoice(doc.id, doc.draft);
          const index = docs.findIndex((d) => d.id === doc.id);
          docs[index] = { ...doc, result };
          setDocuments([...docs]);
          setSelected(
            (prev) => new Set([...prev].filter((id) => id !== doc.id)),
          );
        } catch (e) {
          // A successful server commit with a lost response is recovered on retry.
          setProblems((prev) => ({ ...prev, [doc.id]: message(e) }));
          setError(`Revisa los resultados. ${doc.file_name}: ${message(e)}`);
        }
      }
      await Promise.all(
        [
          'invoices',
          'closures',
          'closures-for-invoices',
          'services',
          'serviceDetails',
          'enhanced-service-details',
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
      window.dispatchEvent(new CustomEvent('invoice-created'));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  };
  return {
    documents,
    candidates,
    issues,
    problems,
    selected,
    setSelected,
    busy,
    error,
    fileErrors,
    ready,
    load,
    upload,
    save,
    run,
    retry: async () => {
      setBusy('Actualizando disponibilidad…');
      try {
        await refresh(documents);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy('');
      }
    },
    removeFromView: (id: string) => {
      setDocuments((d) => d.filter((x) => x.id !== id));
      setSelected((s) => new Set([...s].filter((x) => x !== id)));
    },
  };
}
