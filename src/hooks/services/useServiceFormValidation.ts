import { useMemo } from 'react';
import { ServiceType } from '@/types';
import { ServiceOperator } from '@/types/serviceDetails';
import { ComplianceIssue, formatComplianceIssueMessage } from './useResourceCompliance';

interface ServiceFormData {
  serviceType: string;
  crane: string;
  operators: ServiceOperator[];
  origin: string;
  originLat: number | null;
  originLng: number | null;
  destination: string;
  destinationLat: number | null;
  destinationLng: number | null;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  purchaseOrder: string;
  status: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Contexto que decide si la falta de coordenadas frena el guardado o sólo se
 * comenta. Sin esto, un servicio histórico sin pin dejaba el formulario entero
 * inmovilizado: quien sólo venía a escribir el número de OC no podía guardar.
 */
export interface ServiceLocationEnforcement {
  /** false = alta; true = edición de un servicio existente */
  isEditing: boolean;
  /** Estado persistido en la base al abrir el formulario */
  persistedStatus?: string | null;
  /** El usuario tocó el campo en esta sesión del formulario */
  originDirty?: boolean;
  destinationDirty?: boolean;
  /** Hay link de seguimiento vivo: la base rechaza dejarlo sin coordenadas */
  hasActiveTrackingLink?: boolean;
}

// Los únicos estados donde el tracking, la ETA y los geocercos leen las
// coordenadas. En el resto (completed, cancelled, invoiced, …) el snapshot
// ya no alimenta a nadie.
const COORDINATE_CONSUMING_STATUSES = new Set(['pending', 'in_progress']);

/**
 * La ubicación bloquea el guardado sólo cuando las coordenadas se van a usar
 * de verdad. En cualquier otro caso el aviso es informativo.
 */
export const shouldEnforceLocation = ({
  fieldRequired,
  fieldDirty,
  isEditing,
  persistedStatus,
  formStatus,
  hasActiveTrackingLink,
}: {
  fieldRequired: boolean;
  fieldDirty: boolean;
  isEditing: boolean;
  persistedStatus?: string | null;
  formStatus?: string | null;
  hasActiveTrackingLink?: boolean;
}): boolean => {
  // 1. Alta y el tipo de servicio exige el campo
  if (!isEditing && fieldRequired) return true;
  // 2. El usuario editó el campo en esta sesión (alta o edición)
  if (fieldDirty) return true;
  // 3. El servicio está —o va a quedar— en un estado que consume coordenadas
  if (COORDINATE_CONSUMING_STATUSES.has(persistedStatus ?? '')) return true;
  if (COORDINATE_CONSUMING_STATUSES.has(formStatus ?? '')) return true;
  // 4. Hay seguimiento compartido vivo: el trigger de la base lo rechazaría
  if (hasActiveTrackingLink) return true;
  return false;
};

interface UseServiceFormValidationProps {
  formData: ServiceFormData;
  selectedServiceType: ServiceType | undefined;
  complianceIssues?: ComplianceIssue[];
  locationEnforcement?: ServiceLocationEnforcement;
}

export const useServiceFormValidation = ({
  formData,
  selectedServiceType,
  complianceIssues = [],
  locationEnforcement,
}: UseServiceFormValidationProps) => {
  const {
    isEditing = false,
    persistedStatus = null,
    originDirty = false,
    destinationDirty = false,
    hasActiveTrackingLink = false,
  } = locationEnforcement ?? {};
  const fieldErrors = useMemo(() => {
    const errors: ValidationError[] = [];
    
    if (!selectedServiceType) {
      return errors;
    }

    const serviceTypeName = selectedServiceType.name;

    // Validación de operador
    if (selectedServiceType.operatorRequired) {
      const hasValidOperator = formData.operators?.some(op => op.operatorId && op.operatorId.trim() !== '');
      if (!hasValidOperator) {
        errors.push({
          field: 'operators',
          message: `El tipo de servicio "${serviceTypeName}" requiere asignar al menos un operador`,
          severity: 'error'
        });
      }
    }

    // Validación de grúa
    if (selectedServiceType.craneRequired) {
      if (!formData.crane || formData.crane.trim() === '') {
        errors.push({
          field: 'crane',
          message: `El tipo de servicio "${serviceTypeName}" requiere seleccionar una grúa`,
          severity: 'error'
        });
      }
    }

    const hasOriginText = formData.origin.trim() !== '';
    const hasOriginCoords = formData.originLat != null && formData.originLng != null;
    const hasDestinationText = formData.destination.trim() !== '';
    const hasDestinationCoords = formData.destinationLat != null && formData.destinationLng != null;

    // Decide si la FALTA DE TEXTO de un campo requerido frena el guardado. La
    // falta de coordenada ya no bloquea nunca (salvo seguimiento vivo): la
    // etiqueta y el punto son independientes.
    const originBlocks = shouldEnforceLocation({
      fieldRequired: !!selectedServiceType.originRequired,
      fieldDirty: originDirty,
      isEditing,
      persistedStatus,
      formStatus: formData.status,
      hasActiveTrackingLink,
    });

    if (selectedServiceType.originRequired && !hasOriginText) {
      errors.push({
        field: 'origin',
        message: originBlocks
          ? `Debe especificar el lugar de origen para "${serviceTypeName}"`
          : 'Este servicio no tiene origen registrado. Puedes guardarlo igual; complétalo si vas a usar seguimiento.',
        severity: originBlocks ? 'error' : 'warning'
      });
    } else if (hasOriginText && !hasOriginCoords) {
      // Escribir una referencia que ningún geocodificador puede resolver
      // ("camino a Mantoverde, km 12, poste 45") es el caso NORMAL del negocio:
      // avisar sí, bloquear no. La única excepción es el link de seguimiento
      // vivo, donde el trigger de la base rechaza el UPDATE de todas formas.
      errors.push({
        field: 'origin',
        message: hasActiveTrackingLink
          ? 'Este servicio tiene seguimiento compartido: fija el pin del origen antes de guardar'
          : 'El origen no tiene coordenada. Puedes guardarlo igual; sin punto no hay seguimiento ni métricas de ruta.',
        severity: hasActiveTrackingLink ? 'error' : 'warning'
      });
    }

    const destinationBlocks = shouldEnforceLocation({
      fieldRequired: !!selectedServiceType.destinationRequired,
      fieldDirty: destinationDirty,
      isEditing,
      persistedStatus,
      formStatus: formData.status,
      hasActiveTrackingLink,
    });

    if (selectedServiceType.destinationRequired && !hasDestinationText) {
      errors.push({
        field: 'destination',
        message: destinationBlocks
          ? `Debe especificar el lugar de destino para "${serviceTypeName}"`
          : 'Este servicio no tiene destino registrado. Puedes guardarlo igual; complétalo si vas a usar seguimiento.',
        severity: destinationBlocks ? 'error' : 'warning'
      });
    } else if (hasDestinationText && !hasDestinationCoords) {
      errors.push({
        field: 'destination',
        message: hasActiveTrackingLink
          ? 'Este servicio tiene seguimiento compartido: fija el pin del destino antes de guardar'
          : 'El destino no tiene coordenada. Puedes guardarlo igual; sin punto no hay seguimiento ni métricas de ruta.',
        severity: hasActiveTrackingLink ? 'error' : 'warning'
      });
    }

    // Validación de marca de vehículo
    if (selectedServiceType.vehicleBrandRequired) {
      if (!formData.vehicleBrand || formData.vehicleBrand.trim() === '') {
        errors.push({
          field: 'vehicleBrand',
          message: `La marca del vehículo es requerida para "${serviceTypeName}"`,
          severity: 'error'
        });
      }
    }

    // Validación de modelo de vehículo
    if (selectedServiceType.vehicleModelRequired) {
      if (!formData.vehicleModel || formData.vehicleModel.trim() === '') {
        errors.push({
          field: 'vehicleModel',
          message: `El modelo del vehículo es requerido para "${serviceTypeName}"`,
          severity: 'error'
        });
      }
    }

    // Validación de patente
    if (selectedServiceType.licensePlateRequired) {
      if (!formData.licensePlate || formData.licensePlate.trim() === '') {
        errors.push({
          field: 'licensePlate',
          message: `La patente del vehículo es requerida para "${serviceTypeName}"`,
          severity: 'error'
        });
      }
    }

    // Validación de orden de compra
    if (selectedServiceType.purchaseOrderRequired) {
      if (!formData.purchaseOrder || formData.purchaseOrder.trim() === '') {
        errors.push({
          field: 'purchaseOrder',
          message: `La orden de compra es requerida para "${serviceTypeName}"`,
          severity: 'error'
        });
      }
    }

    return errors;
  }, [
    formData,
    selectedServiceType,
    isEditing,
    persistedStatus,
    originDirty,
    destinationDirty,
    hasActiveTrackingLink,
  ]);

  const complianceValidationErrors = useMemo(
    () =>
      complianceIssues.map((issue) => ({
        field: `compliance:${issue.resource_type}:${issue.item}`,
        message: formatComplianceIssueMessage(issue),
        severity: issue.level,
      })) satisfies ValidationError[],
    [complianceIssues],
  );

  const complianceBlockingErrors = useMemo(
    () => complianceValidationErrors.filter((error) => error.severity === 'error'),
    [complianceValidationErrors],
  );

  const validationErrors = useMemo(
    () => [...fieldErrors, ...complianceValidationErrors],
    [complianceValidationErrors, fieldErrors],
  );

  // El botón Guardar depende ÚNICAMENTE de blockingErrors. Los advisories se
  // pintan y no frenan nada.
  const blockingErrors = useMemo(
    () => fieldErrors.filter((error) => error.severity === 'error'),
    [fieldErrors],
  );

  const advisories = useMemo(
    () => validationErrors.filter((error) => error.severity === 'warning'),
    [validationErrors],
  );

  const hasErrors = blockingErrors.length > 0;
  const hasWarnings = advisories.length > 0;

  const getFieldError = (fieldName: string): ValidationError | undefined => {
    return fieldErrors.find(e => e.field === fieldName);
  };

  const isFieldInvalid = (fieldName: string): boolean => {
    return fieldErrors.some(e => e.field === fieldName && e.severity === 'error');
  };

  return {
    fieldErrors,
    blockingErrors,
    advisories,
    complianceBlockingErrors,
    validationErrors,
    hasErrors,
    hasWarnings,
    getFieldError,
    isFieldInvalid,
    isFormValid: !hasErrors
  };
};
