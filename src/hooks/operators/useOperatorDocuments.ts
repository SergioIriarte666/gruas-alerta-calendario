import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  OperatorDocument,
  OperatorDocumentInsert,
  DocumentType,
  DocumentStatus,
} from '@/types';

const logger = createLogger('useOperatorDocuments');
const OPERATOR_DOCUMENTS_BUCKET = 'operator-documents';
const SIGNED_URL_EXPIRY_SECONDS = 300;

const OPERATOR_DOCUMENTS_SELECT = `
  id,
  operator_id,
  document_type,
  file_url,
  file_name,
  file_size,
  content_type,
  expiry_date,
  issued_date,
  notes,
  uploaded_by,
  created_at,
  updated_at
`;

export function getDocumentStatus(expiryDate?: string | null): DocumentStatus {
  if (!expiryDate) return 'sin_fecha';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'por_vencer';
  return 'vigente';
}

export function getDaysUntilExpiry(expiryDate?: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapRow(row: any): OperatorDocument {
  return {
    id: row.id,
    operatorId: row.operator_id,
    documentType: row.document_type as DocumentType,
    filePath: extractStoragePath(row.file_url),
    fileName: row.file_name,
    fileSize: row.file_size,
    contentType: row.content_type,
    expiryDate: row.expiry_date ?? undefined,
    issuedDate: row.issued_date ?? undefined,
    notes: row.notes ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extractStoragePath(rawValue: string): string {
  if (!rawValue) return rawValue;

  try {
    const url = new URL(rawValue);
    const decodedPath = decodeURIComponent(url.pathname);
    const bucketMatch = decodedPath.match(/\/operator-documents\/(.+)$/);
    return bucketMatch?.[1] ?? rawValue;
  } catch {
    return rawValue.replace(/^\/?operator-documents\//, '');
  }
}

function operatorDocumentsTable() {
  return (supabase.from as any)('operator_documents');
}

export const useOperatorDocuments = (operatorId: string) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocumentAction, setActiveDocumentAction] = useState<'view' | 'download' | null>(null);

  const createDocumentSignedUrl = async (doc: OperatorDocument, options?: { download?: string }) => {
    const { data, error } = await supabase.storage
      .from(OPERATOR_DOCUMENTS_BUCKET)
      .createSignedUrl(doc.filePath, SIGNED_URL_EXPIRY_SECONDS, options);

    if (error || !data?.signedUrl) {
      throw error ?? new Error('No se pudo generar la URL firmada del documento');
    }

    return data.signedUrl;
  };

  const { data: documents = [], isLoading } = useQuery<OperatorDocument[]>({
    queryKey: ['operator-documents', operatorId],
    queryFn: async () => {
      const { data, error } = await operatorDocumentsTable()
        .select(OPERATOR_DOCUMENTS_SELECT)
        .eq('operator_id', operatorId)
        .order('document_type');
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    enabled: !!operatorId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ operatorId, documentType, file, expiryDate, issuedDate, notes }: OperatorDocumentInsert) => {
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const storagePath = `${operatorId}/${documentType}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(OPERATOR_DOCUMENTS_BUCKET)
          .upload(storagePath, file, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await operatorDocumentsTable()
          .upsert(
            {
              operator_id: operatorId,
              document_type: documentType,
              file_url: storagePath,
              file_name: file.name,
              file_size: file.size,
              content_type: file.type,
              expiry_date: expiryDate ?? null,
              issued_date: issuedDate ?? null,
              notes: notes ?? null,
              uploaded_by: user?.id,
            },
            { onConflict: 'operator_id,document_type' },
          )
          .select(OPERATOR_DOCUMENTS_SELECT)
          .single();

        if (error) throw error;
        return mapRow(data);
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-documents', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['operator-document-alerts'] });
      toast.success('Documento subido correctamente');
    },
    onError: (error: any) => {
      logger.error('Error al subir documento:', error);
      toast.error(error.message ?? 'Ocurrió un error al subir el documento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const doc = documents.find((d) => d.id === documentId);

      const { error } = await operatorDocumentsTable()
        .delete()
        .eq('id', documentId);
      if (error) throw error;

      if (doc) {
        try {
          await supabase.storage.from(OPERATOR_DOCUMENTS_BUCKET).remove([doc.filePath]);
        } catch {
          // Si falla la eliminación del storage no bloqueamos
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-documents', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['operator-document-alerts'] });
      toast.success('Documento eliminado');
    },
    onError: (error: any) => {
      logger.error('Error al eliminar documento:', error);
      toast.error(error.message ?? 'No se pudo eliminar el documento');
    },
  });

  const downloadDocument = async (doc: OperatorDocument) => {
    setActiveDocumentId(doc.id);
    setActiveDocumentAction('download');

    try {
      const signedUrl = await createDocumentSignedUrl(doc, { download: doc.fileName });
      const link = window.document.createElement('a');
      link.href = signedUrl;
      link.download = doc.fileName;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success(`Descargando ${doc.fileName}`);
    } catch (error) {
      logger.error('Error al descargar documento:', error);
      toast.error('No se pudo descargar el documento');
    } finally {
      setActiveDocumentId(null);
      setActiveDocumentAction(null);
    }
  };

  const openDocument = async (doc: OperatorDocument) => {
    setActiveDocumentId(doc.id);
    setActiveDocumentAction('view');

    try {
      const signedUrl = await createDocumentSignedUrl(doc);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      logger.error('Error al abrir documento:', error);
      toast.error('No se pudo abrir el documento');
    } finally {
      setActiveDocumentId(null);
      setActiveDocumentAction(null);
    }
  };

  const getDocumentByType = (type: DocumentType) =>
    documents.find((d) => d.documentType === type);

  return {
    documents,
    isLoading,
    uploading,
    uploadDocument: uploadMutation.mutate,
    deleteDocument: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    downloadDocument,
    openDocument,
    activeDocumentId,
    activeDocumentAction,
    getDocumentByType,
  };
};

// Hook ligero para el indicador de advertencia en la tabla
export const useOperatorDocumentAlerts = () => {
  return useQuery({
    queryKey: ['operator-document-alerts'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in30 = new Date(today);
      in30.setDate(in30.getDate() + 30);

      const in30ISO = in30.toISOString().slice(0, 10);

      const { data, error } = await operatorDocumentsTable()
        .select('operator_id, expiry_date')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', in30ISO);

      if (error) throw error;

      // Set de operator_ids con documentos por vencer o vencidos
      return new Set<string>((data ?? []).map((r: any) => r.operator_id as string));
    },
    staleTime: 5 * 60 * 1000,
  });
};
