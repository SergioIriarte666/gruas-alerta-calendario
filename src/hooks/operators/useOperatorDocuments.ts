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
    fileUrl: row.file_url,
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

export const useOperatorDocuments = (operatorId: string) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['operator-documents', operatorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_documents')
        .select(OPERATOR_DOCUMENTS_SELECT)
        .eq('operator_id', operatorId)
        .order('document_type');
      if (error) throw error;
      return data.map(mapRow);
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
          .from('operator-documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('operator-documents')
          .createSignedUrl(storagePath, 31536000);
        if (signedUrlError || !signedUrlData?.signedUrl) {
          throw signedUrlError ?? new Error('No se pudo crear la URL firmada');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from('operator_documents')
          .upsert(
            {
              operator_id: operatorId,
              document_type: documentType,
              file_url: signedUrlData.signedUrl,
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

      const { error } = await supabase
        .from('operator_documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;

      if (doc) {
        // Extraer path relativo de la URL firmada para eliminar del Storage
        try {
          const url = new URL(doc.fileUrl);
          const pathMatch = url.pathname.match(/operator-documents\/(.+)$/);
          if (pathMatch?.[1]) {
            await supabase.storage.from('operator-documents').remove([pathMatch[1]]);
          }
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
    try {
      const link = window.document.createElement('a');
      link.href = doc.fileUrl;
      link.download = doc.fileName;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success(`Descargando ${doc.fileName}`);
    } catch (error) {
      logger.error('Error al descargar documento:', error);
      toast.error('No se pudo descargar el documento');
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

      const todayISO = today.toISOString().slice(0, 10);
      const in30ISO = in30.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('operator_documents')
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
