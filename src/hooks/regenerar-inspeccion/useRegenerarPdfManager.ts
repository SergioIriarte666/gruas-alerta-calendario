import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { createLogger } from '@/lib/logger';
import { Service } from '@/types';
import { businessClock } from '@/utils/businessClock';
import { generateInspectionPDF } from '@/utils/inspectionPdfGenerator';
import { deleteInspectionPdf, uploadInspectionPdf } from '@/utils/inspectionPdfUpload';
import { PreviewPhoto, RegenerarYEnviarInput, RegenerarYEnviarResult } from '@/types/regenerar-inspeccion';

const logger = createLogger('RegenerarInspeccion');

const PHOTO_BUCKET = 'inspection-photos';
const BLANK_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lx0n3wAAAABJRU5ErkJggg==';

const SERVICE_SELECT = `
  id,
  folio,
  request_date,
  service_date,
  purchase_order,
  purchase_order_number,
  quote_number,
  vehicle_brand,
  vehicle_model,
  license_plate,
  origin,
  destination,
  value,
  operator_commission,
  status,
  observations,
  insured_name,
  contact_person,
  contact_phone,
  created_at,
  updated_at,
  client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active, created_at, updated_at),
  serviceType:service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at),
  crane:cranes(id, license_plate, brand, model, type, is_active, created_at, updated_at),
  operator:operators(id, name, rut, phone, operator_type, is_active, created_at, updated_at),
  service_resources!service_resources_service_id_fkey(
    id,
    resource_type,
    operator_id,
    crane_id,
    is_primary,
    operator:operators(id, name, rut, phone, operator_type, is_active, created_at, updated_at),
    crane:cranes(id, license_plate, brand, model, type, is_active, created_at, updated_at)
  ),
  inspections(
    id,
    operator_id,
    equipment_checklist,
    vehicle_observations,
    operator_signature,
    client_name,
    client_rut,
    photos_before_service,
    photos_client_vehicle,
    pdf_url,
    pdf_retiro_url,
    pdf_uploaded_at,
    pdf_retiro_uploaded_at,
    initial_vehicle_state
  )
`;

const normalizeEmbedded = (value: any): any => Array.isArray(value) ? value[0] ?? null : value ?? null;

const toService = (raw: any): Service => {
  const resources = raw.service_resources || [];
  const primaryOperatorResource = resources.find((r: any) => r.resource_type === 'operator' && r.is_primary)
    || resources.find((r: any) => r.resource_type === 'operator');
  const primaryCraneResource = resources.find((r: any) => r.resource_type === 'crane' && r.is_primary)
    || resources.find((r: any) => r.resource_type === 'crane');

  const client = normalizeEmbedded(raw.client) || {};
  const serviceType = normalizeEmbedded(raw.serviceType) || {};
  const operator = normalizeEmbedded(primaryOperatorResource?.operator ?? raw.operator);
  const crane = normalizeEmbedded(primaryCraneResource?.crane ?? raw.crane);

  return {
    id: raw.id,
    folio: raw.folio,
    requestDate: raw.request_date,
    serviceDate: raw.service_date,
    client: {
      id: client.id || '',
      name: client.name || 'Sin cliente',
      rut: client.rut || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      department: client.department || '',
      isActive: client.is_active ?? true,
      createdAt: client.created_at || businessClock.nowISO(),
      updatedAt: client.updated_at || businessClock.nowISO(),
    },
    purchaseOrder: raw.purchase_order || '',
    purchaseOrderNumber: raw.purchase_order_number || '',
    quoteNumber: raw.quote_number || '',
    vehicleBrand: raw.vehicle_brand || '',
    vehicleModel: raw.vehicle_model || '',
    licensePlate: raw.license_plate || '',
    origin: raw.origin || '',
    destination: raw.destination || '',
    serviceType: {
      id: serviceType.id || '',
      name: serviceType.name || 'Tipo no disponible',
      description: serviceType.description || '',
      basePrice: serviceType.base_price || null,
      isActive: serviceType.is_active ?? true,
      vehicleInfoOptional: serviceType.vehicle_info_optional || false,
      purchaseOrderRequired: serviceType.purchase_order_required || false,
      originRequired: serviceType.origin_required !== false,
      destinationRequired: serviceType.destination_required !== false,
      craneRequired: serviceType.crane_required !== false,
      operatorRequired: serviceType.operator_required !== false,
      vehicleBrandRequired: serviceType.vehicle_brand_required !== false,
      vehicleModelRequired: serviceType.vehicle_model_required !== false,
      licensePlateRequired: serviceType.license_plate_required !== false,
      createdAt: serviceType.created_at || businessClock.nowISO(),
      updatedAt: serviceType.updated_at || businessClock.nowISO(),
    },
    value: Number(raw.value || 0),
    crane: crane ? {
      id: crane.id,
      licensePlate: crane.license_plate,
      brand: crane.brand,
      model: crane.model,
      type: crane.type,
      isActive: crane.is_active,
      createdAt: crane.created_at,
      updatedAt: crane.updated_at,
    } : null,
    operator: operator ? {
      id: operator.id,
      name: operator.name,
      rut: operator.rut,
      phone: operator.phone,
      operatorType: operator.operator_type || 'crane_operator',
      isActive: operator.is_active,
      createdAt: operator.created_at,
      updatedAt: operator.updated_at,
    } : null,
    operatorCommission: Number(raw.operator_commission || 0),
    status: raw.status || 'pending',
    observations: raw.observations || '',
    insuredName: raw.insured_name || undefined,
    contactPerson: raw.contact_person || undefined,
    contactPhone: raw.contact_phone || undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
};

const categoryFromPath = (path: string, index: number): PreviewPhoto['category'] => {
  const categories: PreviewPhoto['category'][] = ['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'];
  const base = (path.split('/').pop() || '').toLowerCase();
  const token = base.replace('set_fotografico_', '').split('-')[0];
  return categories.includes(token as PreviewPhoto['category'])
    ? token as PreviewPhoto['category']
    : categories[index % categories.length];
};

const urlToDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar foto (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const listPhotos = async (serviceId: string): Promise<PreviewPhoto[]> => {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(serviceId, {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) throw new Error(`No se pudieron listar fotos: ${error.message}`);

  const files = (data || []).filter((item) => item.name && !item.name.endsWith('/'));
  return Promise.all(files.map(async (file, index) => {
    const path = `${serviceId}/${file.name}`;
    const { data: signed, error: signedError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      throw new Error(`No se pudo firmar foto ${file.name}: ${signedError?.message || 'sin URL'}`);
    }

    return {
      path,
      fileName: file.name,
      category: categoryFromPath(file.name, index),
      signedUrl: signed.signedUrl,
      dataUrl: await urlToDataUrl(signed.signedUrl),
    };
  }));
};

const fetchRawService = async (serviceId: string) => {
  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_SELECT)
    .eq('id', serviceId)
    .single();

  if (error || !data) {
    throw new Error(`No se pudo cargar el servicio: ${error?.message || 'sin datos'}`);
  }

  return data as any;
};

const buildInspectionValues = (
  rawInspection: any | null,
  service: Service,
  photos: PreviewPhoto[],
  isFinal: boolean,
): InspectionFormValues => {
  const storedState = rawInspection?.initial_vehicle_state && typeof rawInspection.initial_vehicle_state === 'object'
    ? rawInspection.initial_vehicle_state
    : {};

  return {
    equipment: rawInspection?.equipment_checklist?.length
      ? rawInspection.equipment_checklist
      : ['regenerado-administrativamente'],
    vehicleObservations: rawInspection?.vehicle_observations || service.observations || 'Regenerado administrativamente desde evidencia disponible.',
    kilometraje: typeof storedState.kilometraje === 'string' ? storedState.kilometraje : '',
    combustible: ['0', '1/4', '1/2', '3/4', 'full'].includes(String(storedState.combustible))
      ? storedState.combustible
      : undefined,
    llaves: storedState.llaves === 'si' || storedState.llaves === 'no' ? storedState.llaves : undefined,
    documentacion: storedState.documentacion === 'si' || storedState.documentacion === 'no' ? storedState.documentacion : undefined,
    operatorName: service.operator?.name || 'Operador',
    operatorSignature: rawInspection?.operator_signature || BLANK_SIGNATURE,
    clientName: rawInspection?.client_name || service.client.name || '',
    clientRut: rawInspection?.client_rut || service.client.rut || '',
    clientSignature: rawInspection?.client_signature || BLANK_SIGNATURE,
    vehicleReceptionSignature: isFinal ? BLANK_SIGNATURE : undefined,
    receptionPersonName: service.client.name || 'Recepción',
    photographicSet: photos.map((photo) => ({
      fileName: photo.fileName,
      category: photo.category,
      storageUrl: photo.dataUrl || photo.signedUrl,
    })),
  };
};

export const fetchRegenerarInspectionPreview = async (serviceId: string) => {
  const [raw, photos] = await Promise.all([fetchRawService(serviceId), listPhotos(serviceId)]);
  const service = toService(raw);
  const inspection = normalizeEmbedded(raw.inspections);

  return {
    service,
    inspection: buildInspectionValues(inspection, service, photos, false),
    photos,
    currentPdfPath: inspection?.pdf_url || null,
    currentFinalPdfPath: inspection?.pdf_retiro_url || null,
  };
};

export const useRegenerarPdfManager = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, kind, enviarWhatsapp, motivo }: RegenerarYEnviarInput): Promise<RegenerarYEnviarResult> => {
      const isFinal = kind === 'final';
      const raw = await fetchRawService(serviceId);
      const service = toService(raw);
      const rawInspection = normalizeEmbedded(raw.inspections);
      const previousPdfPath = isFinal ? rawInspection?.pdf_retiro_url || null : rawInspection?.pdf_url || null;

      if (previousPdfPath && !motivo?.trim()) {
        throw new Error('El motivo de regeneración es obligatorio al sobrescribir un PDF existente.');
      }

      const operatorId = rawInspection?.operator_id || service.operator?.id;
      if (!operatorId) {
        throw new Error('El servicio no tiene operador asociado; no se puede crear el row de inspección mínimo.');
      }

      const photos = await listPhotos(serviceId);
      if (photos.length === 0) {
        throw new Error('No hay fotos disponibles en Storage para regenerar la inspección.');
      }

      const inspection = buildInspectionValues(rawInspection, service, photos, isFinal);
      const footer = `Regenerado administrativamente - ${businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm')}`;
      const pdfBlob = await generateInspectionPDF({ service, inspection, regenerationFooter: footer }, isFinal);

      let uploadedPath: string | null = null;
      try {
        const upload = await uploadInspectionPdf(pdfBlob, serviceId, service.folio, isFinal ? 'entrega' : 'inicial');
        uploadedPath = upload.path;

        if (rawInspection?.id) {
          const { error: updateError } = await supabase
            .from('inspections')
            .update(isFinal
              ? { pdf_retiro_url: upload.path, pdf_retiro_uploaded_at: businessClock.nowISO() }
              : { pdf_url: upload.path, pdf_uploaded_at: businessClock.nowISO() })
            .eq('id', rawInspection.id);

          if (updateError) throw new Error(`No se pudo actualizar inspections: ${updateError.message}`);
        } else {
          const { error: insertError } = await supabase
            .from('inspections')
            .insert({
              service_id: serviceId,
              operator_id: operatorId,
              equipment_checklist: inspection.equipment || ['regenerado-administrativamente'],
              vehicle_observations: inspection.vehicleObservations || null,
              operator_signature: inspection.operatorSignature || BLANK_SIGNATURE,
              client_name: inspection.clientName || null,
              client_rut: inspection.clientRut || null,
              photos_before_service: isFinal ? [] : photos.map((photo) => photo.path),
              photos_client_vehicle: isFinal ? photos.map((photo) => photo.path) : [],
              ...(isFinal
                ? { pdf_retiro_url: upload.path, pdf_retiro_uploaded_at: businessClock.nowISO() }
                : { pdf_url: upload.path, pdf_uploaded_at: businessClock.nowISO() }),
              initial_vehicle_state: {
                equipment: inspection.equipment || [],
                kilometraje: inspection.kilometraje || '',
                combustible: inspection.combustible || null,
                llaves: inspection.llaves || null,
                documentacion: inspection.documentacion || null,
              },
            });

          if (insertError) throw new Error(`No se pudo crear inspections: ${insertError.message}`);
        }

        let whatsappSent = false;
        let whatsappSkippedReason: string | undefined;
        if (enviarWhatsapp) {
          const { data, error } = await supabase.functions.invoke(
            isFinal ? 'send-whatsapp-retiro' : 'send-whatsapp-inspection',
            {
              body: {
                folio: service.folio,
                serviceId,
                clientName: service.client.name || '',
                clientPhone: service.client.phone || '',
                contactPhone: service.contactPhone || '',
                contactPerson: service.contactPerson || '',
                pdfUrl: upload.signedUrl,
                serviceDate: service.serviceDate,
                operatorName: service.operator?.name || '',
              },
            },
          );

          if (error) throw new Error(`WhatsApp falló: ${error.message}`);
          whatsappSent = Boolean(data?.sent);
          whatsappSkippedReason = data?.reason;
        }

        await supabase.rpc('log_audit_entry', {
          p_table_name: 'inspections',
          p_operation: 'regenerate_inspection_pdf',
          p_old_data: previousPdfPath ? { service_id: serviceId, pdf_path: previousPdfPath, kind } : null,
          p_new_data: {
            service_id: serviceId,
            folio: service.folio,
            kind,
            new_pdf_path: upload.path,
            previous_pdf_path: previousPdfPath,
            reason: motivo || null,
            whatsapp_sent: whatsappSent,
            regenerated_at: businessClock.nowISO(),
          },
        });

        return { pdfPath: upload.path, signedUrl: upload.signedUrl, whatsappSent, whatsappSkippedReason };
      } catch (error) {
        if (uploadedPath) {
          try {
            await deleteInspectionPdf(uploadedPath);
          } catch (cleanupError) {
            logger.error('No se pudo limpiar PDF regenerado tras fallo:', { uploadedPath, cleanupError });
            toast.error(`Falló la regeneración y no se pudo limpiar ${uploadedPath}.`);
          }
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      toast.success(result.whatsappSent
        ? 'PDF regenerado y enviado por WhatsApp'
        : `PDF regenerado${result.whatsappSkippedReason ? ` (${result.whatsappSkippedReason})` : ''}`, {
        action: {
          label: 'Abrir PDF',
          onClick: () => window.open(result.signedUrl, '_blank', 'noopener,noreferrer'),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['regenerar-inspeccion-elegibles'] });
    },
    onError: (error) => {
      logger.error('Error regenerando inspección:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo regenerar la inspección');
    },
  });
};
