import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PDF_BUCKET } from '@/utils/inspectionPdfUpload';
import type { AccessibleServiceDocument } from '@/utils/serviceDocumentAccess';

export interface ServiceDocument extends AccessibleServiceDocument {
  /** Estable por documento: `${inspectionId}:${phase}`. */
  id: string;
  label: string;
  createdAt: string | null;
}

export interface InspectionDocumentRow {
  id: string;
  created_at: string | null;
  pdf_url: string | null;
  pdf_retiro_url: string | null;
  r2_pdf_path: string | null;
  r2_pdf_retiro_path: string | null;
  storage_tier: string | null;
}

export const serviceDocumentsKey = (serviceId?: string | null) =>
  ['service-documents', serviceId] as const;

export const buildServiceDocuments = (
  rows: InspectionDocumentRow[],
): ServiceDocument[] => rows.flatMap((row) => {
  if (row.storage_tier === 'deleted') return [];

  const storageTier: ServiceDocument['storageTier'] =
    row.storage_tier === 'cold' ? 'cold' : 'hot';
  const initialPath = storageTier === 'cold' ? row.r2_pdf_path : row.pdf_url;
  const finalPath = storageTier === 'cold' ? row.r2_pdf_retiro_path : row.pdf_retiro_url;
  const documents: ServiceDocument[] = [];

  if (initialPath) {
    documents.push({
      id: `${row.id}:initial`,
      inspectionId: row.id,
      label: 'Inspección inicial',
      bucket: PDF_BUCKET,
      path: initialPath,
      phase: 'initial',
      storageTier,
      createdAt: row.created_at,
    });
  }
  if (finalPath) {
    documents.push({
      id: `${row.id}:final`,
      inspectionId: row.id,
      label: 'Entrega',
      bucket: PDF_BUCKET,
      path: finalPath,
      phase: 'final',
      storageTier,
      createdAt: row.created_at,
    });
  }

  return documents;
});

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
        .select('id, created_at, pdf_url, pdf_retiro_url, r2_pdf_path, r2_pdf_retiro_path, storage_tier')
        .eq('service_id', serviceId as string)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return buildServiceDocuments((data ?? []) as InspectionDocumentRow[]);
    },
  });
