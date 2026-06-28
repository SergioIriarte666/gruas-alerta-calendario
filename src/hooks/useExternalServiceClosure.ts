import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { generateExternalServiceActaPdf } from '@/utils/pdf/externalServicePdfGenerator';
import type {
  ExternalEvidence,
  ExternalClosure,
  ExternalClosureInput,
  EvidenceUploadInput,
} from '@/types/externalServices';

const logger = createLogger('useExternalServiceClosure');
const BUCKET = 'external-evidence';

const mapEvidenceRow = (row: any): ExternalEvidence => ({
  id: row.id,
  serviceId: row.service_id,
  fileName: row.file_name,
  filePath: row.file_path,
  fileSize: row.file_size,
  mimeType: row.mime_type,
  evidenceType: row.evidence_type,
  notes: row.notes,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
  createdAt: row.created_at,
});

const mapClosureRow = (row: any): ExternalClosure => ({
  id: row.id,
  serviceId: row.service_id,
  adminUserId: row.admin_user_id,
  adminName: row.admin_name,
  adminSignature: row.admin_signature,
  thirdPartyProviderName: row.third_party_provider_name,
  thirdPartyProviderRut: row.third_party_provider_rut,
  thirdPartyServiceSummary: row.third_party_service_summary,
  closureNotes: row.closure_notes,
  pdfPath: row.pdf_path,
  emailSentTo: row.email_sent_to || [],
  emailSentAt: row.email_sent_at,
  emailSendCount: row.email_send_count ?? 0,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useServiceEvidence = (serviceId: string | undefined) => {
  return useQuery({
    queryKey: ['external-evidence', serviceId],
    queryFn: async (): Promise<ExternalEvidence[]> => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('service_external_evidence')
        .select('*')
        .eq('service_id', serviceId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapEvidenceRow);
    },
    enabled: !!serviceId,
  });
};

export const useServiceClosure = (serviceId: string | undefined) => {
  return useQuery({
    queryKey: ['external-closure', serviceId],
    queryFn: async (): Promise<ExternalClosure | null> => {
      if (!serviceId) return null;
      const { data, error } = await supabase
        .from('service_external_closures')
        .select('*')
        .eq('service_id', serviceId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapClosureRow(data) : null;
    },
    enabled: !!serviceId,
  });
};

export const useUploadEvidence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EvidenceUploadInput): Promise<ExternalEvidence> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const ext = input.file.name.split('.').pop() ?? 'bin';
      const uuid = crypto.randomUUID();
      const path = `evidence/${input.serviceId}/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { contentType: input.file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from('service_external_evidence')
        .insert({
          service_id: input.serviceId,
          file_name: input.file.name,
          file_path: path,
          file_size: input.file.size,
          mime_type: input.file.type,
          evidence_type: input.evidenceType,
          notes: input.notes ?? null,
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }

      return mapEvidenceRow(row);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['external-evidence', vars.serviceId] });
      toast.success('Evidencia subida correctamente');
    },
    onError: (e: any) => {
      logger.error('Error subiendo evidencia:', e);
      toast.error('Error al subir evidencia', { description: e.message });
    },
  });
};

export const useCloseExternalService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExternalClosureInput): Promise<ExternalClosure> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // 1. Upsert closure (permite re-intentar si un cierre anterior falló parcialmente)
      const { data: closureRow, error: closureError } = await supabase
        .from('service_external_closures')
        .upsert({
          service_id: input.serviceId,
          admin_user_id: user.id,
          admin_name: input.adminName,
          admin_signature: input.adminSignature,
          third_party_provider_name: input.thirdPartyProviderName,
          third_party_provider_rut: input.thirdPartyProviderRut ?? null,
          third_party_service_summary: input.thirdPartyServiceSummary,
          closure_notes: input.closureNotes ?? null,
        }, { onConflict: 'service_id' })
        .select('*')
        .single();
      if (closureError) throw closureError;

      // 2. Update service status
      const { error: serviceError } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', input.serviceId);
      if (serviceError) throw serviceError;

      // 3. Fetch datos para el PDF
      const { data: svc, error: svcError } = await supabase
        .from('services')
        .select(`
          folio, service_date, origin, destination,
          vehicle_brand, vehicle_model, license_plate, outsourced_cost,
          clients!services_client_id_fkey(name)
        `)
        .eq('id', input.serviceId)
        .single();
      if (svcError) throw svcError;

      const { data: evidenceRows } = await supabase
        .from('service_external_evidence')
        .select('*')
        .eq('service_id', input.serviceId)
        .order('uploaded_at', { ascending: false });

      // 4. Generar PDF
      const closure = mapClosureRow(closureRow);
      const evidences = (evidenceRows || []).map(mapEvidenceRow);
      const pdfBlob = await generateExternalServiceActaPdf({
        service: {
          folio: (svc as any).folio,
          serviceDate: (svc as any).service_date,
          clientName: (svc as any).clients?.name ?? null,
          vehicleBrand: (svc as any).vehicle_brand,
          vehicleModel: (svc as any).vehicle_model,
          licensePlate: (svc as any).license_plate,
          origin: (svc as any).origin,
          destination: (svc as any).destination,
          outsourcedCost: (svc as any).outsourced_cost,
        },
        closure,
        evidences,
      });

      // 5. Upload PDF
      const pdfPath = `actas/${(svc as any).folio}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) {
        logger.error('Error subiendo Acta PDF:', uploadError);
      } else {
        await supabase
          .from('service_external_closures')
          .update({ pdf_path: pdfPath })
          .eq('id', closure.id);
      }

      return { ...closure, pdfPath };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['external-services'] });
      queryClient.invalidateQueries({ queryKey: ['external-closure', vars.serviceId] });
      toast.success('Servicio cerrado y Acta generada');
    },
    onError: (e: any) => {
      logger.error('Error cerrando servicio externo:', e);
      toast.error('Error al cerrar servicio', { description: e.message });
    },
  });
};

export const getEvidenceSignedUrl = async (path: string, expiresIn = 3600): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};

/**
 * Descarga el Acta PDF del cierre externo directamente al equipo del usuario.
 * Si el PDF no existe en storage, intenta regenerarlo desde los datos disponibles.
 */
export const downloadExternalActa = async (pdfPath: string, folio: string): Promise<void> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(pdfPath);
  if (error || !data) {
    throw new Error(`No se pudo obtener el PDF: ${error?.message || 'archivo no encontrado'}`);
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Acta-Servicio-Externo-${folio}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Regenera el PDF del Acta y lo sube al storage.
 * Útil cuando el cierre quedó registrado pero el PDF no se generó.
 */
export const regenerateActaPdf = async (serviceId: string): Promise<string> => {
  const { data: closure, error: clErr } = await supabase
    .from('service_external_closures')
    .select('*')
    .eq('service_id', serviceId)
    .single();
  if (clErr || !closure) throw new Error('No se encontró el cierre del servicio');

  const { data: svc, error: svcErr } = await supabase
    .from('services')
    .select(`
      folio, service_date, origin, destination,
      vehicle_brand, vehicle_model, license_plate, outsourced_cost,
      clients!services_client_id_fkey(name)
    `)
    .eq('id', serviceId)
    .single();
  if (svcErr || !svc) throw new Error('No se encontró el servicio');

  const { data: evidenceRows } = await supabase
    .from('service_external_evidence')
    .select('*')
    .eq('service_id', serviceId)
    .order('uploaded_at', { ascending: false });

  const pdfBlob = await generateExternalServiceActaPdf({
    service: {
      folio: (svc as any).folio,
      serviceDate: (svc as any).service_date,
      clientName: (svc as any).clients?.name ?? null,
      vehicleBrand: (svc as any).vehicle_brand,
      vehicleModel: (svc as any).vehicle_model,
      licensePlate: (svc as any).license_plate,
      origin: (svc as any).origin,
      destination: (svc as any).destination,
      outsourcedCost: (svc as any).outsourced_cost,
    },
    closure: mapClosureRow(closure),
    evidences: (evidenceRows || []).map(mapEvidenceRow),
  });

  const pdfPath = `actas/${(svc as any).folio}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) throw new Error(`Error al subir PDF: ${uploadErr.message}`);

  await supabase
    .from('service_external_closures')
    .update({ pdf_path: pdfPath })
    .eq('id', closure.id);

  return pdfPath;
};

export interface SendActaEmailInput {
  serviceId: string;
  recipientEmail: string;
  recipientName?: string;
}

export const useSendExternalActaEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendActaEmailInput): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No autenticado');

      const { data, error } = await supabase.functions.invoke('send-external-service-email', {
        body: {
          serviceId: input.serviceId,
          recipientEmail: input.recipientEmail.trim(),
          recipientName: input.recipientName?.trim() ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['external-closure', vars.serviceId] });
      toast.success(`Acta enviada a ${vars.recipientEmail}`);
    },
    onError: (e: any) => {
      logger.error('Error enviando Acta:', e);
      toast.error('Error al enviar email', { description: e.message });
    },
  });
};
