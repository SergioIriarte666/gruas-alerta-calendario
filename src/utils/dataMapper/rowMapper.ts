
import { EntityFinders } from './entityFinders';
import { DataValidators } from './dataValidators';
import { MappingResult, MappedServiceCostDetail, MappedServiceData } from './types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RowMapper');

export class RowMapper {
  constructor(
    private entityFinders: EntityFinders,
    private validators: DataValidators
  ) {}

  async mapRowData(rowData: any): Promise<MappingResult> {
    logger.debug('🔄 Mapping row data:', rowData);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate and fix dates
      logger.debug('📅 Validating dates...');
      const requestDateValidation = this.validators.validateDate(rowData.requestDate, 'Fecha Solicitud');
      const serviceDateValidation = this.validators.validateDate(rowData.serviceDate, 'Fecha Servicio');

      logger.debug('📅 Request date validation:', requestDateValidation);
      logger.debug('📅 Service date validation:', serviceDateValidation);

      if (!requestDateValidation.isValid) {
        logger.debug('❌ Request date invalid:', requestDateValidation.error);
        errors.push(requestDateValidation.error!);
      }
      if (!serviceDateValidation.isValid) {
        logger.debug('❌ Service date invalid:', serviceDateValidation.error);
        errors.push(serviceDateValidation.error!);
      }

      // Find client - handle with or without department
      logger.debug('👤 Finding client by RUT:', rowData.clientRut, 'and department:', rowData.clientDepartment);
      logger.debug('👤 Client name from data:', rowData.clientName);
      let client = null;
      
      if (rowData.clientDepartment) {
        // Try with department first if available
        client = this.entityFinders.findClientByRutAndDepartment(rowData.clientRut, rowData.clientDepartment);
        
        if (!client) {
          logger.debug('👤 Client not found by RUT+department, trying RUT only:', rowData.clientRut);
          client = this.entityFinders.findClientByRut(rowData.clientRut);
          
          if (client) {
            logger.debug('⚠️ Client found by RUT only but department mismatch:', client.department, 'vs', rowData.clientDepartment);
            warnings.push(`Cliente encontrado pero departamento no coincide: esperado "${rowData.clientDepartment}", encontrado "${client.department}"`);
          }
        }
      } else {
        // No department provided, search by RUT only
        logger.debug('👤 No department provided, searching by RUT only:', rowData.clientRut);
        client = this.entityFinders.findClientByRut(rowData.clientRut);
        
        if (client) {
          logger.debug('⚠️ Cliente encontrado sin departamento especificado, usando:', client.department);
          warnings.push(`Departamento no especificado, usando cliente existente con departamento: "${client.department}"`);
        }
      }
      
      // If not found by RUT, try to find by name as fallback
      if (!client && rowData.clientName) {
        logger.debug('👤 Client not found by RUT, trying by name:', rowData.clientName);
        client = this.entityFinders.findClientByName(rowData.clientName);
        
        if (client) {
          logger.debug('⚠️ Cliente encontrado por nombre:', client.name, 'con RUT:', client.rut);
          warnings.push(`Cliente encontrado por nombre (${client.name}) pero RUT no coincide: esperado "${rowData.clientRut}", encontrado "${client.rut}"`);
        }
      }
      
      if (!client) {
        const deptInfo = rowData.clientDepartment ? ` (${rowData.clientDepartment})` : ' (sin departamento)';
        logger.debug('❌ Client not found:', rowData.clientRut, '-', rowData.clientName, deptInfo);
        errors.push(`Cliente no encontrado: ${rowData.clientRut} - ${rowData.clientName}${deptInfo}`);
      } else {
        logger.debug('✅ Client found:', client.name, '- Dept:', client.department, '(', client.id, ')');
      }

      // Find crane
      const cranePlate = rowData.craneLicensePlate || '';
      logger.debug('🚛 Finding crane by license plate:', cranePlate);
      const crane = this.entityFinders.findCraneByPlate(cranePlate);
      if (!crane) {
        logger.debug('❌ Crane not found:', cranePlate);
        errors.push(`Grúa no encontrada: ${cranePlate || 'valor vacío'}`);
      } else {
        logger.debug('✅ Crane found:', crane.brand, crane.model, '(', crane.id, ')');
      }

      // Find operator
      logger.debug('👷 Finding operator by RUT:', rowData.operatorRut);
      const operator = this.entityFinders.findOperatorByRut(rowData.operatorRut);
      if (!operator) {
        logger.debug('❌ Operator not found:', rowData.operatorRut);
        errors.push(`Operador no encontrado: ${rowData.operatorRut}`);
      } else {
        logger.debug('✅ Operator found:', operator.name, '(', operator.id, ')');
      }

      // Find service type
      logger.debug('🔧 Finding service type by name:', rowData.serviceType);
      const serviceType = this.entityFinders.findServiceTypeByName(rowData.serviceType);
      if (!serviceType) {
        logger.debug('❌ Service type not found:', rowData.serviceType);
        errors.push(`Tipo de servicio no encontrado: ${rowData.serviceType}`);
      } else {
        logger.debug('✅ Service type found:', serviceType.name, '(', serviceType.id, ')');
      }

      // Validate numeric values
      logger.debug('💰 Validating numeric values...');
      const valueValidation = this.validators.validateNumericValue(rowData.value, 'value');
      const commissionValidation = this.validators.validateNumericValue(rowData.operatorCommission, 'operatorCommission');

      logger.debug('💰 Value validation:', valueValidation);
      logger.debug('💰 Commission validation:', commissionValidation);

      if (!valueValidation.isValid) {
        logger.debug('❌ Value invalid:', valueValidation.error);
        errors.push(valueValidation.error!);
      }
      if (!commissionValidation.isValid) {
        logger.debug('❌ Commission invalid:', commissionValidation.error);
        errors.push(commissionValidation.error!);
      }

      const expenseColumns = [
        { field: 'fuelExpense', label: 'Combustible', subcategory: 'Combustible' },
        { field: 'allowanceExpense', label: 'Viáticos', subcategory: 'Viáticos' },
        { field: 'tollExpense', label: 'Peajes', subcategory: 'Peajes' },
      ] as const;
      const costDetails: MappedServiceCostDetail[] = [];

      for (const expense of expenseColumns) {
        const validation = this.validators.validateOptionalExpense(rowData[expense.field], expense.label);

        if (!validation.isValid) {
          errors.push(validation.error!);
          continue;
        }

        if (validation.amount && validation.amount > 0) {
          costDetails.push({
            description: `${expense.subcategory} ${rowData.folio}`,
            amount: validation.amount,
            quantity: 1,
            unitPrice: validation.amount,
            notes: 'Costo registrado desde carga masiva',
            subcategory: expense.subcategory,
            ...(expense.subcategory === 'Viáticos' && operator?.id
              ? { operator_id: operator.id }
              : {}),
            ...(expense.subcategory === 'Peajes' && rowData.origin && rowData.destination
              ? { location_text: `${rowData.origin} → ${rowData.destination}` }
              : {}),
          });
        }
      }

      if (errors.length > 0) {
        logger.debug('❌ Row mapping failed with errors:', errors);
        return {
          success: false,
          errors,
          warnings: warnings.length > 0 ? warnings : undefined
        };
      }

      const mappedData: MappedServiceData = {
        folio: rowData.folio,
        requestDate: requestDateValidation.fixedDate!,
        serviceDate: serviceDateValidation.fixedDate!,
        clientId: client!.id,
        vehicleBrand: rowData.vehicleBrand,
        vehicleModel: rowData.vehicleModel,
        licensePlate: rowData.licensePlate,
        origin: rowData.origin,
        destination: rowData.destination,
        serviceTypeId: serviceType!.id,
        value: parseFloat(rowData.value),
        craneId: crane!.id,
        operatorId: operator!.id,
        operatorCommission: parseFloat(rowData.operatorCommission),
        observations: rowData.observations || '',
        costDetails,
      };

      logger.debug('✅ Row mapping successful:', mappedData);

      return {
        success: true,
        data: mappedData,
        errors: [],
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      logger.error('❌ Error mapping row data:', error);
      return {
        success: false,
        errors: [`Error interno al mapear datos: ${error instanceof Error ? error.message : 'Error desconocido'}`]
      };
    }
  }
}
