import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/utils/imageCompression';
import type { Database, Json } from '@/integrations/supabase/types';

export async function preparePurchasePhoto(file: File): Promise<File> {
  if (file.size > 20 * 1024 * 1024) throw new Error('La foto supera 20 MB. Usa una imagen de menor tamaño.');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Usa una foto JPG, PNG, WEBP o HEIC.');
  let input: Blob = file;
  try {
    const blob = await compressImage(input, { maxDimension: 2600, quality: 0.9 });
    if (blob.size > 5 * 1024 * 1024) throw new Error('La foto preparada supera 5 MB. Reduce su tamaño.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (error) {
    if (!/heic|heif/i.test(file.type + file.name)) throw error;
    const { heicTo } = await import('heic-to/csp');
    input = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
    const blob = await compressImage(input, { maxDimension: 2600, quality: 0.9 });
    if (blob.size > 5 * 1024 * 1024) throw new Error('La foto preparada supera 5 MB. Reduce su tamaño.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  }
}

export async function extractPurchasePhoto(file: File): Promise<unknown> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'));
    reader.readAsDataURL(file);
  });
  const { data, error } = await supabase.functions.invoke('parse-receipt-image', { body: { imageBase64: base64, imageMimeType: 'image/jpeg', mode: 'invoice' } });
  if (error || data?.error) throw new Error(data?.error || 'No se pudo leer la foto. Puedes completar los datos manualmente y conservarla como respaldo.');
  return data;
}

export type InventoryPurchaseArgs = Database['public']['Functions']['import_xml_inventory_invoice']['Args'];

export async function uploadManualPurchasePhoto(requestId: string, photo: File | null) {
  let receiptPath: string | null = null;
  if (photo) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Inicia sesión nuevamente antes de guardar la compra.');
    receiptPath = `${user.id}/manual-purchases/${requestId}.jpg`;
    const form = new FormData();
    form.append('requestId', requestId);
    form.append('photo', photo);
    const { data, error } = await supabase.functions.invoke('purchase-receipts', { body: form });
    if (error || data?.error || data?.path !== receiptPath || data?.storage !== 'r2') throw new Error('No se pudo guardar y verificar la foto en Cloudflare R2. No se registró la compra.');
  }
  return receiptPath;
}

export async function registerManualPurchase(requestId: string, args: InventoryPurchaseArgs, photo: File | null) {
  const receiptPath = await uploadManualPurchasePhoto(requestId, photo);
  const { data, error } = await supabase.rpc('register_manual_inventory_purchase', { p_request_id: requestId, p_data: args as unknown as Json, p_receipt_path: receiptPath });
  if (error) throw new Error(error.message);
  return data;
}
