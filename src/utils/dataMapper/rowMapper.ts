
import { EntityFinders } from './entityFinders';
import { DataValidators } from './dataValidators';
import { MappingResult, MappedServiceData } from './types';

export class RowMapper {
  constructor(
    private entityFinders: EntityFinders,
    private validators: DataValidators
  ) {}

  async mapRowData(rowData: any): Promise<MappingResult> {
    console.log('🔄 Mapping row data:', rowData);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate and fix dates
      console.log('📅 Validating dates...');
      const requestDateValidation = this.validators.validateDate(rowData.requestDate, 'Fecha Solicitud');
      const serviceDateValidation = this.validators.validateDate(rowData.serviceDate, 'Fecha Servicio');

      console.log('📅 Request date validation:', requestDateValidation);
      console.log('📅 Service date validation:', serviceDateValidation);

      if (!requestDateValidation.isValid) {
        console.log('❌ Request date invalid:', requestDateValidation.error);
        errors.push(requestDateValidation.error!);
      }
      if (!serviceDateValidation.isValid) {
        console.log('❌ Service date invalid:', serviceDateValidation.error);
        errors.push(serviceDateValidation.error!);
      }

      // Find client - handle with or without department
      console.log('👤 Finding client by RUT:', rowData.clientRut, 'and department:', rowData.clientDepartment);
      console.log('👤 Client name from data:', rowData.clientName);
      let client = null;
      
      if (rowData.clientDepartment) {
        // Try with department first if available
        client = this.entityFinders.findClientByRutAndDepartment(rowData.clientRut, rowData.clientDepartment);
        
        if (!client) {
          console.log('👤 Client not found by RUT+department, trying RUT only:', rowData.clientRut);
          client = this.entityFinders.findClientByRut(rowData.clientRut);
          
          if (client) {
            console.log('⚠️ Client found by RUT only but department mismatch:', client.department, 'vs', rowData.clientDepartment);
            warnings.push(`Cliente encontrado pero departamento no coincide: esperado "${rowData.clientDepartment}", encontrado "${client.department}"`);
          }
        }
      } else {
        // No department provided, search by RUT only
        console.log('👤 No department provided, searching by RUT only:', rowData.clientRut);
        client = this.entityFinders.findClientByRut(rowData.clientRut);
        
        if (client) {
          console.log('⚠️ Cliente encontrado sin departamento especificado, usando:', client.department);
          warnings.push(`Departamento no especificado, usando cliente existente con departamento: "${client.department}"`);
        }
      }
      
      // If not found by RUT, try to find by name as fallback
      if (!client && rowData.clientName) {
        console.log('👤 Client not found by RUT, trying by name:', rowData.clientName);
        client = this.entityFinders.findClientByName(rowData.clientName);
        
        if (client) {
          console.log('⚠️ Cliente encontrado por nombre:', client.name, 'con RUT:', client.rut);
          warnings.push(`Cliente encontrado por nombre (${client.name}) pero RUT no coincide: esperado "${rowData.clientRut}", encontrado "${client.rut}"`);
        }
      }
      
      if (!client) {
        const deptInfo = rowData.clientDepartment ? ` (${rowData.clientDepartment})` : ' (sin departamento)';
        console.log('❌ Client not found:', rowData.clientRut, '-', rowData.clientName, deptInfo);
        errors.push(`Cliente no encontrado: ${rowData.clientRut} - ${rowData.clientName}${deptInfo}`);
      } else {
        console.log('✅ Client found:', client.name, '- Dept:', client.department, '(', client.id, ')');
      }

      // Find crane
      const cranePlate = rowData.craneLicensePlate || '';
      console.log('🚛 Finding crane by license plate:', cranePlate);
      const crane = this.entityFinders.findCraneByPlate(cranePlate);
      if (!crane) {
        console.log('❌ Crane not found:', cranePlate);
        errors.push(`Grúa no encontrada: ${cranePlate || 'valor vacío'}`);
      } else {
        console.log('✅ Crane found:', crane.brand, crane.model, '(', crane.id, ')');
      }

      // Find operator
      console.log('👷 Finding operator by RUT:', rowData.operatorRut);
      const operator = this.entityFinders.findOperatorByRut(rowData.operatorRut);
      if (!operator) {
        console.log('❌ Operator not found:', rowData.operatorRut);
        errors.push(`Operador no encontrado: ${rowData.operatorRut}`);
      } else {
        console.log('✅ Operator found:', operator.name, '(', operator.id, ')');
      }

      // Find service type
      console.log('🔧 Finding service type by name:', rowData.serviceType);
      const serviceType = this.entityFinders.findServiceTypeByName(rowData.serviceType);
      if (!serviceType) {
        console.log('❌ Service type not found:', rowData.serviceType);
        errors.push(`Tipo de servicio no encontrado: ${rowData.serviceType}`);
      } else {
        console.log('✅ Service type found:', serviceType.name, '(', serviceType.id, ')');
      }

      // Validate numeric values
      console.log('💰 Validating numeric values...');
      const valueValidation = this.validators.validateNumericValue(rowData.value, 'value');
      const commissionValidation = this.validators.validateNumericValue(rowData.operatorCommission, 'operatorCommission');

      console.log('💰 Value validation:', valueValidation);
      console.log('💰 Commission validation:', commissionValidation);

      if (!valueValidation.isValid) {
        console.log('❌ Value invalid:', valueValidation.error);
        errors.push(valueValidation.error!);
      }
      if (!commissionValidation.isValid) {
        console.log('❌ Commission invalid:', commissionValidation.error);
        errors.push(commissionValidation.error!);
      }

      if (errors.length > 0) {
        console.log('❌ Row mapping failed with errors:', errors);
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
        observations: rowData.observations || ''
      };

      console.log('✅ Row mapping successful:', mappedData);

      return {
        success: true,
        data: mappedData,
        errors: [],
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('❌ Error mapping row data:', error);
      return {
        success: false,
        errors: [`Error interno al mapear datos: ${error instanceof Error ? error.message : 'Error desconocido'}`]
      };
    }
  }
}
