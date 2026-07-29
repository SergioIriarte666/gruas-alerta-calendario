import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PDF_BUCKET } from '@/utils/inspectionPdfUpload';

export interface ServiceDocument {
  /** Estable por documento: `${inspectionId}:${phase}`. */
  id: string;
  label: string;
  bucket: string;
  path: string;
  phase: 'initial' | 'final';
  createdAt: string | null;
}

export const serviceDocumentsKey = (serviceId?: string | null) =>
  ['service-documents', serviceId] as const;

/**
 * Documentos del expediente de un servicio.
 *
 * Hoy son los dos PDF de inspección —inicial y entrega—, que es lo que el
 * negocio entrega a mano al cliente. La forma del resultado es genérica a
 * propósito: cuando aparezca otro documento del expediente, se suma aquí y toda
 * la UI de recuperar/compartir lo hereda sin tocarse.
 *
 * Solo lista lo que EXISTE: una inspección sin PDF de entrega todavía no
 * aparece, en vez de ofrecer un botón que va a fallar.
 */
export const useServiceDocuments = (serviceId?: string | null) =>
  useQuery({
    queryKey: serviceDocumentsKey(serviceId),
    enabled: Boolean(serviceId),
    queryFn: async (): Promise<ServiceDocument[]> => {
      const { data, error } = await supabase
        .from('inspections')
        .select('id, created_at, pdf_url, pdf_retiro_url')
        .eq('service_id', serviceId as string)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Array<{
        id: string;
        created_at: string | null;
        pdf_url: string | null;
        pdf_retiro_url: string | null;
      }>;

      return rows.flatMap((row) => {
        const documents: ServiceDocument[] = [];
        if (row.pdf_url) {
          documents.push({
            id: `${row.id}:initial`,
            label: 'Inspección inicial',
            bucket: PDF_BUCKET,
            path: row.pdf_url,
            phase: 'initial',
            createdAt: row.created_at,
          });
        }
        if (row.pdf_retiro_url) {
          documents.push({
            id: `${row.id}:final`,
            label: 'Entrega',
            bucket: PDF_BUCKET,
            path: row.pdf_retiro_url,
            phase: 'final',
            createdAt: row.created_at,
          });
        }
        return documents;
      });
    },
  });
