
import { MappedServiceData, MappingResult } from './types';
import { EntityFinders } from './entityFinders';
import { DataValidators } from './dataValidators';

export class RowMapper {
  constructor(
    private entityFinders: EntityFinders,
    private validators: DataValidators
  ) {}

  async mapRowData(rowData: any): Promise<MappingResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Find entities
      const client = this.entityFinders.findClientByRut(rowData.clientRut) || 
                    this.entityFinders.findClientByName(rowData.clientName);
      if (!client) {
        errors.push(`Cliente no encontrado: RUT ${rowData.clientRut} - ${rowData.clientName}`);
      }

      const crane = this.entityFinders.findCraneByPlate(rowData.craneLicensePlate);
      if (!crane) {
        errors.push(`Grúa no encontrada: ${rowData.craneLicensePlate}`);
      }

      const operator = this.entityFinders.findOperatorByRut(rowData.operatorRut);
      if (!operator) {
        errors.push(`Operador no encontrado: ${rowData.operatorRut}`);
      }

      const serviceType = this.entityFinders.findServiceTypeByName(rowData.serviceType);
      if (!serviceType) {
        errors.push(`Tipo de servicio no encontrado: ${rowData.serviceType}`);
      }

      // Validate dates
      const requestDateValidation = this.validators.validateDate(rowData.requestDate, 'Fecha de solicitud');
      if (!requestDateValidation.isValid) {
        errors.push(requestDateValidation.error!);
      }

      const serviceDateValidation = this.validators.validateDate(rowData.serviceDate, 'Fecha de servicio');
      if (!serviceDateValidation.isValid) {
        errors.push(serviceDateValidation.error!);
      }

      // Validate numeric values
      const valueValidation = this.validators.validateNumericValue(rowData.value, 'value');
      if (!valueValidation.isValid) {
        errors.push(valueValidation.error!);
      }

      const commissionValidation = this.validators.validateNumericValue(rowData.operatorCommission, 'operatorCommission');
      if (!commissionValidation.isValid) {
        errors.push(commissionValidation.error!);
      }

      // Validate vehicle information only if required for this service type
      if (serviceType && !serviceType.vehicleInfoOptional) {
        if (!rowData.vehicleBrand?.trim() || !rowData.vehicleModel?.trim() || !rowData.licensePlate?.trim()) {
          errors.push(`Información del vehículo es requerida para el tipo de servicio: ${serviceType.name}`);
        }
      }

      // Check for warnings
      if (client && rowData.clientName && client.name !== rowData.clientName) {
        warnings.push(`Nombre de cliente no coincide exactamente: "${rowData.clientName}" vs "${client.name}"`);
      }

      if (errors.length === 0) {
        const mappedData: MappedServiceData = {
          folio: rowData.folio.toString().trim(),
          requestDate: requestDateValidation.fixedDate!,
          serviceDate: serviceDateValidation.fixedDate!,
          clientId: client!.id,
          vehicleBrand: rowData.vehicleBrand ? rowData.vehicleBrand.toString().trim() : '',
          vehicleModel: rowData.vehicleModel ? rowData.vehicleModel.toString().trim() : '',
          licensePlate: rowData.licensePlate ? rowData.licensePlate.toString().toUpperCase().trim() : '',
          origin: rowData.origin.toString().trim(),
          destination: rowData.destination.toString().trim(),
          serviceTypeId: serviceType!.id,
          value: Math.round(parseFloat(rowData.value)),
          craneId: crane!.id,
          operatorId: operator!.id,
          operatorCommission: Math.round(parseFloat(rowData.operatorCommission)),
          observations: rowData.observations ? rowData.observations.toString().trim() : undefined
        };

        return {
          success: true,
          data: mappedData,
          errors: [],
          warnings
        };
      }

      return {
        success: false,
        errors,
        warnings
      };

    } catch (error) {
      console.error('Error mapping row data:', error);
      return {
        success: false,
        errors: [`Error interno al procesar datos: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        warnings
      };
    }
  }
}
