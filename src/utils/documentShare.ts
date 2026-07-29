import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DocumentShare');

/**
 * Vida del enlace firmado: 15 minutos.
 *
 * Suficiente para que el destinatario lo abra en el momento y corto para que un
 * reenvío del mensaje días después no siga sirviendo el documento. El expediente
 * no es público: lo que se comparte es un permiso temporal, no el archivo.
 */
export const DOCUMENT_SIGNED_URL_SECONDS = 15 * 60;

export type ShareOutcome = 'shared' | 'copied' | 'opened' | 'cancelled' | 'failed';

export interface ShareableDocument {
  /** Bucket de Storage donde vive el archivo. */
  bucket: string;
  /** Ruta dentro del bucket. */
  path: string;
  /** Título legible: encabeza el share sheet. */
  title: string;
}

/** URL firmada de vida corta, o null si el objeto ya no está en Storage. */
export const createDocumentSignedUrl = async (
  document: ShareableDocument,
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(document.bucket)
    .createSignedUrl(document.path, DOCUMENT_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.warn('No se pudo firmar el documento', { path: document.path, error: error?.message });
    return null;
  }

  return data.signedUrl;
};

/**
 * Abre el panel de compartir del sistema con el documento del expediente.
 *
 * Mientras los envíos automáticos al cliente están apagados a propósito, la
 * entrega de documentos es manual: hoy obligaba a descargar el PDF al teléfono
 * y reenviarlo a mano. Esto es el puente —recuperar y compartir, nada más— sin
 * registros ni flujos nuevos.
 *
 * Degradación en cascada, nunca un error a secas: share nativo -> copiar el
 * enlace -> abrirlo. En cualquiera de los tres el usuario se queda con algo
 * utilizable.
 *
 * `signedUrl` puede venir precalculado por quien llama. Vale la pena: en iOS la
 * activación transitoria del gesto expira durante el await de red y
 * `navigator.share` rechaza con NotAllowedError (fue exactamente lo que rompió
 * el compartir del link de seguimiento el 26/07).
 */
export const shareDocument = async (
  document: ShareableDocument,
  signedUrl?: string | null,
): Promise<ShareOutcome> => {
  const url = signedUrl ?? await createDocumentSignedUrl(document);
  if (!url) return 'failed';

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: document.title, text: document.title, url });
      return 'shared';
    } catch (error) {
      // Cancelar el panel nativo es una decisión del usuario, no un fallo.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      logger.warn('El panel de compartir no se abrió, se degrada a copiar', error);
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (error) {
    logger.warn('El portapapeles no aceptó el enlace', error);
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return 'opened';
};
