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
export type DownloadOutcome = 'downloaded' | 'opened' | 'failed';

export interface ShareableDocument {
  /** Bucket de Storage donde vive el archivo. */
  bucket: string;
  /** Ruta dentro del bucket. */
  path: string;
  /** Título legible: encabeza el share sheet. */
  title: string;
  /** Nombre sugerido cuando el navegador puede compartir o descargar el archivo real. */
  fileName?: string;
}

/** URL firmada de vida corta, o null si el objeto ya no está en Storage. */
export const createDocumentSignedUrl = async (
  document: Pick<ShareableDocument, 'bucket' | 'path'>,
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

const fetchDocumentFile = async (
  url: string,
  document: ShareableDocument,
): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar el documento (${response.status})`);
  const blob = await response.blob();
  return new File(
    [blob],
    document.fileName || 'documento.pdf',
    { type: blob.type || 'application/pdf' },
  );
};

/** Descarga el archivo; si CORS no permite leerlo, abre el enlace privado como respaldo. */
export const downloadDocumentFromUrl = async (
  url: string,
  document: ShareableDocument,
): Promise<DownloadOutcome> => {
  try {
    const file = await fetchDocumentFile(url, document);
    const objectUrl = URL.createObjectURL(file);
    const link = window.document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    return 'downloaded';
  } catch (error) {
    logger.warn('No se pudo descargar como archivo; se abre el enlace temporal', error);
    return window.open(url, '_blank', 'noopener,noreferrer') ? 'opened' : 'failed';
  }
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
 * `signedUrl` puede venir precalculado por quien llama para evitar firmar dos
 * veces. Si el navegador no permite compartir archivos o pierde la activación
 * durante la descarga, se conserva la degradación segura al enlace temporal.
 */
export const shareDocument = async (
  document: ShareableDocument,
  signedUrl?: string | null,
): Promise<ShareOutcome> => {
  const url = signedUrl ?? await createDocumentSignedUrl(document);
  if (!url) return 'failed';

  // En móviles compatibles se comparte el PDF real. Así el cliente conserva el
  // formulario aunque el permiso temporal de R2 expire después del envío.
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = await fetchDocumentFile(url, document);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: document.title, files: [file] });
        return 'shared';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      logger.warn('No se pudo compartir el archivo; se degrada al enlace temporal', error);
    }
  }

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
