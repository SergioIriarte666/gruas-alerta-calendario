import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCraneDocuments");
export interface CraneDocument {
  id: string;
  craneId: string;
  documentType: 'technical_review' | 'insurance' | 'circulation_permit';
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  contentType?: string;
  expiryDate?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface UploadDocumentData {
  craneId: string;
  documentType: string;
  file: File;
  expiryDate?: string;
}

const CRANE_DOCUMENTS_SELECT = `
  id,
  crane_id,
  document_type,
  file_url,
  file_name,
  file_size,
  content_type,
  expiry_date,
  uploaded_at,
  uploaded_by
`;

export const useCraneDocuments = (craneId: string) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Fetch documents for a crane
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['crane-documents', craneId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crane_documents')
        .select(CRANE_DOCUMENTS_SELECT)
        .eq('crane_id', craneId);

      if (error) throw error;

      return data.map((doc): CraneDocument => ({
        id: doc.id,
        craneId: doc.crane_id,
        documentType: doc.document_type as CraneDocument['documentType'],
        fileUrl: doc.file_url,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        contentType: doc.content_type,
        expiryDate: doc.expiry_date,
        uploadedAt: doc.uploaded_at,
        uploadedBy: doc.uploaded_by
      }));
    }
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ craneId, documentType, file, expiryDate }: UploadDocumentData) => {
      setUploading(true);
      
      try {
        // Create file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${craneId}/${documentType}_${Date.now()}.${fileExt}`;

        // Upload file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('crane-documents')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get signed URL (bucket is private)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('crane-documents')
          .createSignedUrl(fileName, 31536000); // 1 year expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          throw signedUrlError || new Error('Failed to create signed URL');
        }
        const fileUrl = signedUrlData.signedUrl;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Save document metadata (this will trigger the crane expiry update via trigger)
        const { data, error } = await supabase
          .from('crane_documents')
          .upsert({
            crane_id: craneId,
            document_type: documentType,
            file_url: fileUrl,
            file_name: file.name,
            file_size: file.size,
            content_type: file.type,
            expiry_date: expiryDate || null,
            uploaded_by: user?.id
          }, {
            onConflict: 'crane_id,document_type'
          })
          .select(CRANE_DOCUMENTS_SELECT)
          .single();

        if (error) throw error;

        return data;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crane-documents', craneId] });
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-compliance'] });
      toast.success("Documento subido correctamente y fecha de vencimiento actualizada");
    },
    onError: (error: any) => {
      logger.error('Error uploading document:', error);
      toast.error(error.message || "Ocurrió un error al subir el documento");
    }
  });

  // Download document
  const downloadDocument = async (doc: CraneDocument) => {
    try {
      // For public buckets, we can directly use the file URL
      const link = window.document.createElement('a');
      link.href = doc.fileUrl;
      link.download = doc.fileName;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      toast.success(`Descargando ${doc.fileName}`);
    } catch (error) {
      logger.error('Error downloading document:', error);
      toast.error("No se pudo descargar el documento");
    }
  };

  // Get document by type
  const getDocumentByType = (type: CraneDocument['documentType']) => {
    return documents.find(doc => doc.documentType === type);
  };

  return {
    documents,
    isLoading,
    uploading,
    uploadDocument: uploadMutation.mutate,
    downloadDocument,
    getDocumentByType
  };
};
