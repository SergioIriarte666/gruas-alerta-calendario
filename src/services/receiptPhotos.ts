import { supabase } from '@/integrations/supabase/client';

export interface SignedReceiptPhoto { path: string; signedUrl: string; error?: string | null }
export const isManualPurchasePhoto = (path: string) => /^[0-9a-f-]{36}\/manual-purchases\/[0-9a-f-]{36}\.jpg$/.test(path);

export async function createReceiptSignedUrls(paths: string[]): Promise<{ data: SignedReceiptPhoto[]; error: Error | null }> {
  const results = new Map<string, SignedReceiptPhoto>();
  const manual = paths.filter(isManualPurchasePhoto);
  const legacy = paths.filter(path => !isManualPurchasePhoto(path));
  try {
    for (let offset = 0; offset < manual.length; offset += 20) {
      const batch = manual.slice(offset, offset + 20);
      const { data, error } = await supabase.functions.invoke('purchase-receipts', { body: { action: 'urls', paths: batch } });
      if (error || data?.error || !Array.isArray(data?.data)) throw new Error('No se pudo abrir el respaldo privado de Cloudflare.');
      for (const path of batch) {
        const result = (data.data as SignedReceiptPhoto[]).find(item => item.path === path);
        results.set(path, result || { path, signedUrl: '', error: 'Respaldo no disponible' });
      }
    }
    if (legacy.length) {
      const { data, error } = await supabase.storage.from('quick-entry-photos').createSignedUrls(legacy, 600);
      if (error) throw new Error('No se pudieron abrir los respaldos anteriores.');
      for (const result of data || []) if (result.path) results.set(result.path, { path: result.path, signedUrl: result.signedUrl || '', error: result.error });
    }
    return { data: paths.map(path => results.get(path) || { path, signedUrl: '', error: 'Respaldo no disponible' }), error: null };
  } catch (cause) {
    return { data: [], error: cause instanceof Error ? cause : new Error('No se pudieron abrir los respaldos.') };
  }
}

export async function createReceiptSignedUrl(path: string) {
  const { data, error } = await createReceiptSignedUrls([path]);
  return { data: data[0] || null, error };
}

export async function migratePurchaseReceiptPhotos(after = '') {
  const { data, error } = await supabase.functions.invoke('purchase-receipts', { body: { action: 'migrate', after, limit: 5 } });
  if (error || data?.error) throw new Error(data?.error || 'No se pudo trasladar los respaldos a Cloudflare.');
  return data as { results: { path: string; migrated: boolean; error?: string }[]; nextCursor: string | null };
}

export async function checkPurchaseReceiptPhotos() {
  const { data, error } = await supabase.functions.invoke('purchase-receipts', { body: { action: 'check' } });
  if (error || data?.error || data?.success !== true) throw new Error(data?.error || 'No se pudo verificar el acceso al bucket de Cloudflare. No se trasladó ningún respaldo.');
  return data as { success: true; bucket: string };
}
