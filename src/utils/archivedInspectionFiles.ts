import { supabase } from '@/integrations/supabase/client';

export interface ArchivedInspectionFilesResponse {
  tier: 'hot' | 'cold' | 'deleted';
  archivedAt?: string | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  pdfUrl?: string | null;
  pdfRetiroUrl?: string | null;
  photos?: {
    beforeService?: Array<string | null>;
    clientVehicle?: Array<string | null>;
    equipmentUsed?: Array<string | null>;
  };
}

type ArchivedInspectionLookup =
  | { inspectionId: string; serviceId?: never; folio?: never }
  | { serviceId: string; inspectionId?: never; folio?: never }
  | { folio: string; inspectionId?: never; serviceId?: never };

/**
 * Solicita enlaces privados y efímeros para una inspección archivada en R2.
 * Ninguna URL se persiste en la base de datos ni se expone sin una sesión válida.
 */
export const getArchivedInspectionFiles = async (
  lookup: ArchivedInspectionLookup,
): Promise<ArchivedInspectionFilesResponse> => {
  const { data, error } = await supabase.functions.invoke('get-archived-inspection-files', {
    body: lookup,
  });

  if (error) {
    throw new Error(`No se pudo recuperar el archivo histórico: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || !('tier' in data)) {
    throw new Error('El archivo histórico devolvió una respuesta inválida');
  }

  return data as ArchivedInspectionFilesResponse;
};

export const archivedPdfUrlForPhase = (
  files: ArchivedInspectionFilesResponse,
  phase: 'initial' | 'final',
): string | null => {
  if (files.tier !== 'cold') return null;
  return phase === 'initial' ? files.pdfUrl || null : files.pdfRetiroUrl || null;
};
