import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';

const logger = createLogger('LowboyRutResolver');

/** Pausa entre llamadas seriales a la API para no gatillar rate limits. */
const LOOKUP_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Guarda una razón social resuelta en la caché compartida (rut_directory). */
async function cacheRazonSocial(rut: string, razonSocial: string): Promise<void> {
  const { error } = await supabase
    .from('rut_directory')
    .upsert(
      { rut, razon_social: razonSocial, source: 'sre_lookup', updated_at: new Date().toISOString() },
      { onConflict: 'rut' },
    );
  if (error) logger.warn('No se pudo cachear razón social en rut_directory', rut, error.message);
}

/** Consulta sre-lookup para un RUT y, si hay resultado, lo cachea. Devuelve null si falla. */
async function lookupFromApi(rut: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('sre-lookup', { body: { rut } });
    if (error) {
      logger.warn('sre-lookup falló', rut, error.message);
      return null;
    }
    if (data?.error) {
      logger.warn('sre-lookup sin resultado', rut, data.error);
      return null;
    }
    const razon = typeof data?.razon_social === 'string' ? data.razon_social.trim() : '';
    if (!razon) return null;
    await cacheRazonSocial(rut, razon);
    return razon;
  } catch (e) {
    logger.warn('Excepción consultando sre-lookup', rut, e);
    return null;
  }
}

/**
 * Resuelve la razón social de un RUT con caché:
 *   a. rut_directory (sin llamar API)
 *   b. sre-lookup (y cachea el resultado)
 *   c. null si nada resuelve (el flujo no se rompe)
 */
export async function resolveRazonSocial(rut: string): Promise<string | null> {
  const key = normalizeRut(rut);
  if (!key) return null;

  const { data: cached, error } = await supabase
    .from('rut_directory')
    .select('razon_social')
    .eq('rut', key)
    .maybeSingle();
  if (error) logger.warn('Error leyendo rut_directory', key, error.message);
  if (cached?.razon_social) return cached.razon_social;

  return lookupFromApi(key);
}

/**
 * Resuelve varios RUTs devolviendo un Map<rutNormalizado, razonSocial> solo con
 * los que se lograron resolver. Deduplica, consulta la caché en bloque (una sola
 * query) y solo llama la API para los que faltan, en serie con pausa de 200ms.
 * Garantiza UNA sola llamada por RUT y CERO llamadas si todo está en caché.
 */
export async function resolveRazonSocialesForRuts(
  ruts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, string>> {
  const unique = [...new Set(ruts.map((r) => normalizeRut(r)).filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  // a. Caché en bloque
  const { data: cachedRows, error } = await supabase
    .from('rut_directory')
    .select('rut, razon_social')
    .in('rut', unique);
  if (error) logger.warn('Error leyendo rut_directory en bloque', error.message);

  const cachedMap = new Map((cachedRows ?? []).map((row) => [row.rut, row.razon_social]));
  const missing: string[] = [];
  for (const rut of unique) {
    const hit = cachedMap.get(rut);
    if (hit) result.set(rut, hit);
    else missing.push(rut);
  }
  onProgress?.(result.size, unique.length);

  // b. API en serie solo para los faltantes
  for (let i = 0; i < missing.length; i++) {
    const razon = await lookupFromApi(missing[i]);
    if (razon) result.set(missing[i], razon);
    onProgress?.(unique.length - missing.length + i + 1, unique.length);
    if (i < missing.length - 1) await sleep(LOOKUP_DELAY_MS);
  }

  return result;
}
