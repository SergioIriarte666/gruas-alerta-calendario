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
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface UseServiceFormValidationProps {
  formData: ServiceFormData;
  selectedServiceType: ServiceType | undefined;
  complianceIssues?: ComplianceIssue[];
}

export const useServiceFormValidation = ({
  formData,
  selectedServiceType,
  complianceIssues = [],
}: UseServiceFormValidationProps) => {
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

    // Una ubicación escrita no es una ubicación confirmada. Para cualquier
    // servicio que tenga origen/destino, se exige seleccionar el resultado o
    // fijar el pin antes de persistirlo.
    if (selectedServiceType.originRequired && !hasOriginText) {
        errors.push({
          field: 'origin',
          message: `Debe especificar el lugar de origen para "${serviceTypeName}"`,
          severity: 'error'
        });
    } else if (hasOriginText && !hasOriginCoords) {
      errors.push({
        field: 'origin',
        message: 'Selecciona el origen del listado, pega su enlace de Google Maps o fija el pin',
        severity: 'error'
      });
    }

    if (selectedServiceType.destinationRequired && !hasDestinationText) {
        errors.push({
          field: 'destination',
          message: `Debe especificar el lugar de destino para "${serviceTypeName}"`,
          severity: 'error'
        });
    } else if (hasDestinationText && !hasDestinationCoords) {
      errors.push({
        field: 'destination',
        message: 'Selecciona el destino del listado, pega su enlace de Google Maps o fija el pin',
        severity: 'error'
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
  }, [formData, selectedServiceType]);

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

  const hasErrors = fieldErrors.filter(e => e.severity === 'error').length > 0;
  const hasWarnings = validationErrors.filter(e => e.severity === 'warning').length > 0;

  const getFieldError = (fieldName: string): ValidationError | undefined => {
    return fieldErrors.find(e => e.field === fieldName);
  };

  const isFieldInvalid = (fieldName: string): boolean => {
    return fieldErrors.some(e => e.field === fieldName && e.severity === 'error');
  };

  return {
    fieldErrors,
    complianceBlockingErrors,
    validationErrors,
    hasErrors,
    hasWarnings,
    getFieldError,
    isFieldInvalid,
    isFormValid: !hasErrors
  };
};
