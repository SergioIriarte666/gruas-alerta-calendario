import { businessClock } from '@/utils/businessClock';
import { addCalendarDays } from '@/utils/calendarDate';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useBusinessDocuments');

const BUCKET_NAME = 'business-documents';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 10;

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'xml'] as const;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'application/xml',
  'text/xml',
  '',
];

export const DOCUMENT_CATEGORIES = [
  { value: 'contratos', label: 'Contratos' },
  { value: 'permisos', label: 'Permisos' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'documentos_legales', label: 'Documentos legales' },
  { value: 'documentos_vehiculos', label: 'Documentos vehículos' },
  { value: 'documentos_operadores', label: 'Documentos operadores' },
  { value: 'proveedores', label: 'Proveedores' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'facturas_y_respaldo', label: 'Facturas y respaldo' },
  { value: 'otros', label: 'Otros' },
] as const;

export const RELATED_ENTITY_TYPES = [
  { value: 'service', label: 'Servicio' },
  { value: 'client', label: 'Cliente' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'operator', label: 'Operador' },
  { value: 'crane', label: 'Grúa' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'invoice', label: 'Factura' },
  { value: 'cost', label: 'Costo' },
  { value: 'other', label: 'Otro' },
] as const;

export type BusinessDocument = Database['public']['Tables']['business_documents']['Row'];
export type BusinessDocumentInsert = Database['public']['Tables']['business_documents']['Insert'];
export type BusinessDocumentUpdate = Database['public']['Tables']['business_documents']['Update'];

export interface BusinessDocumentFilters {
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  expiry?: 'all' | 'expired' | 'soon' | 'valid' | 'no_expiry';
  confidentiality?: 'all' | 'confidential' | 'public';
  relatedEntityType?: string;
}

export interface BusinessDocumentMetadata {
  title: string;
  description?: string | null;
  category: string;
  tags?: string[];
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  document_date?: string | null;
  expires_at?: string | null;
  is_confidential?: boolean;
}

const normalizeTags = (tags?: string[]) =>
  (tags || [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);

const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

export const validateBusinessDocumentFile = (file: File) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo supera el máximo permitido de 25 MB.');
  }

  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new Error('Formato no permitido. Usa PDF, DOC, DOCX, XLS, XLSX, JPG, PNG o XML.');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('El tipo MIME del archivo no está permitido.');
  }
};

export const useBusinessDocuments = (filters: BusinessDocumentFilters = {}) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const queryKey = useMemo(() => ['business-documents', filters], [filters]);

  const listDocuments = useCallback(async (activeFilters: BusinessDocumentFilters = filters) => {
    const todayIso = businessClock.today();
    const soonIso = addCalendarDays(todayIso, 30);

    let query = supabase
      .from('business_documents')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (activeFilters.category && activeFilters.category !== 'all') {
      query = query.eq('category', activeFilters.category);
    }

    if (activeFilters.relatedEntityType && activeFilters.relatedEntityType !== 'all') {
      query = query.eq('related_entity_type', activeFilters.relatedEntityType);
    }

    if (activeFilters.confidentiality === 'confidential') {
      query = query.eq('is_confidential', true);
    } else if (activeFilters.confidentiality === 'public') {
      query = query.eq('is_confidential', false);
    }

    if (activeFilters.dateFrom) {
      query = query.gte('document_date', activeFilters.dateFrom);
    }

    if (activeFilters.dateTo) {
      query = query.lte('document_date', activeFilters.dateTo);
    }

    if (activeFilters.expiry === 'expired') {
      query = query.lt('expires_at', todayIso);
    } else if (activeFilters.expiry === 'soon') {
      query = query.gte('expires_at', todayIso).lte('expires_at', soonIso);
    } else if (activeFilters.expiry === 'valid') {
      query = query.gt('expires_at', soonIso);
    } else if (activeFilters.expiry === 'no_expiry') {
      query = query.is('expires_at', null);
    }

    if (activeFilters.search?.trim()) {
      const term = activeFilters.search.trim();
      query = query.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,file_name.ilike.%${term}%,category.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }, [filters]);

  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => listDocuments(filters),
  });

  const uploadDocument = useCallback(async (file: File, metadata: BusinessDocumentMetadata) => {
    validateBusinessDocumentFile(file);
    setUploading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setUploading(false);
      throw authError || new Error('Debes iniciar sesión para subir documentos.');
    }

    const extension = getFileExtension(file.name);
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'documento';
    const filePath = `${authData.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      const payload: BusinessDocumentInsert = {
        title: metadata.title.trim(),
        description: metadata.description?.trim() || null,
        category: metadata.category,
        tags: normalizeTags(metadata.tags),
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || extension,
        file_size: file.size,
        related_entity_type: metadata.related_entity_type || null,
        related_entity_id: metadata.related_entity_id || null,
        document_date: metadata.document_date || null,
        expires_at: metadata.expires_at || null,
        is_confidential: Boolean(metadata.is_confidential),
        uploaded_by: authData.user.id,
      };

      const { data, error } = await supabase
        .from('business_documents')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw error;
      }

      return data;
    } finally {
      setUploading(false);
    }
  }, []);

  const uploadMutation = useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: BusinessDocumentMetadata }) =>
      uploadDocument(file, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-documents'] });
      toast.success('Documento subido correctamente');
    },
    onError: (error: Error) => {
      logger.error('Error uploading business document:', error);
      toast.error(error.message || 'No se pudo subir el documento');
    },
  });

  const updateDocument = useCallback(async (id: string, metadata: BusinessDocumentMetadata) => {
    const payload: BusinessDocumentUpdate = {
      title: metadata.title.trim(),
      description: metadata.description?.trim() || null,
      category: metadata.category,
      tags: normalizeTags(metadata.tags),
      related_entity_type: metadata.related_entity_type || null,
      related_entity_id: metadata.related_entity_id || null,
      document_date: metadata.document_date || null,
      expires_at: metadata.expires_at || null,
      is_confidential: Boolean(metadata.is_confidential),
    };

    const { data, error } = await supabase
      .from('business_documents')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: BusinessDocumentMetadata }) =>
      updateDocument(id, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-documents'] });
      toast.success('Documento actualizado');
    },
    onError: (error: Error) => {
      logger.error('Error updating business document:', error);
      toast.error(error.message || 'No se pudo actualizar el documento');
    },
  });

  const deleteDocument = useCallback(async (id: string) => {
    const { data: document, error: fetchError } = await supabase
      .from('business_documents')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (document?.file_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([document.file_path]);

      if (storageError) throw storageError;
    }

    const { error: deleteError } = await supabase
      .from('business_documents')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-documents'] });
      toast.success('Documento eliminado');
    },
    onError: (error: Error) => {
      logger.error('Error deleting business document:', error);
      toast.error(error.message || 'No se pudo eliminar el documento');
    },
  });

  const getSignedUrl = useCallback(async (document: Pick<BusinessDocument, 'file_path' | 'file_name'>) => {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS, {
        download: document.file_name,
      });

    if (error || !data?.signedUrl) {
      throw error || new Error('No se pudo generar el enlace seguro.');
    }

    return data.signedUrl;
  }, []);

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    isFetching: documentsQuery.isFetching,
    error: documentsQuery.error,
    refetch: documentsQuery.refetch,
    listDocuments,
    uploadDocument: uploadMutation.mutateAsync,
    updateDocument: updateMutation.mutateAsync,
    deleteDocument: deleteMutation.mutateAsync,
    getSignedUrl,
    uploading: uploading || uploadMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
};
