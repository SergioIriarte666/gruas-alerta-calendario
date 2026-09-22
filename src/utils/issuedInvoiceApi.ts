import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type {
  ImportedInvoiceResult,
  InvoiceCandidate,
  IssuedInvoiceDocument,
  IssuedInvoiceDraft,
} from './issuedInvoiceImport';

// Types for the additive migration, kept separate from the generated schema.
type ImportDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      issued_invoice_imports: {
        Row: {
          id: string;
          file_name: string;
          file_hash: string;
          storage_path: string;
          draft: Json;
          result: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      issued_invoice_candidates: {
        Args: { p_client_rut: string };
        Returns: Json;
      };
      save_issued_invoice_draft: {
        Args: {
          p_id: string | null;
          p_hash: string;
          p_name: string;
          p_path: string;
          p_draft: Json;
        };
        Returns: Json;
      };
      register_issued_invoice: {
        Args: { p_document_id: string; p_expected_draft: Json };
        Returns: Json;
      };
    };
  };
};
const db = supabase as unknown as SupabaseClient<ImportDatabase>;
export const INVOICE_PDF_BUCKET = 'issued-invoice-pdfs';
export async function listIssuedInvoiceDrafts(): Promise<
  IssuedInvoiceDocument[]
> {
  // Paginate: never silently lose pending drafts behind PostgREST's row limit.
  const all: IssuedInvoiceDocument[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from('issued_invoice_imports')
      .select('*')
      .is('result', null)
      .order('created_at')
      .order('id')
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        `No se pudieron cargar los lotes. Comprueba que la migración de importación esté aplicada. ${error.message}`,
      );
    all.push(...(data as unknown as IssuedInvoiceDocument[]));
    if (data.length < 500) break;
  }
  const recent = await db
    .from('issued_invoice_imports')
    .select('*')
    .not('result', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (recent.error) throw recent.error;
  all.push(...(recent.data as unknown as IssuedInvoiceDocument[]));
  return all;
}
export async function findIssuedInvoiceFile(hash: string) {
  const { data, error } = await db
    .from('issued_invoice_imports')
    .select('*')
    .eq('file_hash', hash)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as IssuedInvoiceDocument | null;
}
export async function saveIssuedInvoiceDraft(
  doc: Pick<
    IssuedInvoiceDocument,
    'file_hash' | 'file_name' | 'storage_path'
  > & { id?: string },
  draft: IssuedInvoiceDraft,
) {
  const { data, error } = await db.rpc('save_issued_invoice_draft', {
    p_id: doc.id || null,
    p_hash: doc.file_hash,
    p_name: doc.file_name,
    p_path: doc.storage_path,
    p_draft: JSON.parse(JSON.stringify(draft)) as Json,
  });
  if (error) throw error;
  return data as unknown as IssuedInvoiceDocument;
}
export async function getIssuedInvoiceCandidates(
  rut: string,
): Promise<InvoiceCandidate[]> {
  const { data, error } = await db.rpc('issued_invoice_candidates', {
    p_client_rut: rut,
  });
  if (error) throw error;
  return data as unknown as InvoiceCandidate[];
}
export async function registerIssuedInvoice(
  id: string,
  draft: IssuedInvoiceDraft,
): Promise<ImportedInvoiceResult> {
  const { data, error } = await db.rpc('register_issued_invoice', {
    p_document_id: id,
    p_expected_draft: JSON.parse(JSON.stringify(draft)) as Json,
  });
  if (error) throw error;
  return data as unknown as ImportedInvoiceResult;
}
export async function existingFiscalNumbers(numbers: string[]) {
  // Read all numeric folios so that legacy leading zeros cannot bypass duplicate detection.
  const wanted = new Set(
    numbers.filter((n) => /^\d+$/.test(n)).map((n) => BigInt(n).toString()),
  );
  const found = new Set<string>();
  if (!wanted.size) return found;
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, numero_fiscal')
      .not('numero_fiscal', 'is', null)
      .order('id')
      .range(offset, offset + 499);
    if (error) throw error;
    data.forEach((r) => {
      if (
        r.numero_fiscal &&
        /^\d+$/.test(r.numero_fiscal) &&
        wanted.has(BigInt(r.numero_fiscal).toString())
      )
        found.add(BigInt(r.numero_fiscal).toString());
    });
    if (data.length < 500) break;
  }
  return found;
}
export const fiscalKey = (value: string) =>
  /^\d+$/.test(value) ? BigInt(value).toString() : value;
