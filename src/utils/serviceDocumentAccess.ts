import {
  archivedPdfUrlForPhase,
  getArchivedInspectionFiles,
} from '@/utils/archivedInspectionFiles';
import {
  createDocumentSignedUrl,
} from '@/utils/documentShare';

export interface AccessibleServiceDocument {
  bucket: string;
  path: string;
  inspectionId: string;
  phase: 'initial' | 'final';
  storageTier: 'hot' | 'cold';
}

/** Resuelve el origen correcto sin rehidratar el archivo en Supabase Storage. */
export const createServiceDocumentUrl = async (
  document: AccessibleServiceDocument,
): Promise<string | null> => {
  if (document.storageTier === 'hot') {
    return await createDocumentSignedUrl(document);
  }

  const archived = await getArchivedInspectionFiles({
    inspectionId: document.inspectionId,
  });
  return archivedPdfUrlForPhase(archived, document.phase);
};
