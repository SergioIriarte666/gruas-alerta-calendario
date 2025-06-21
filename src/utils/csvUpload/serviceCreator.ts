
import { DataMapper } from '../dataMapper';

export const createServiceFromCsvRow = async (row: any, dataMapper: DataMapper) => {
  try {
    // Find existing entities
    const foundClient = dataMapper.findClientByRut(row.clientRut) || dataMapper.findClientByName(row.clientName);
    const foundCrane = dataMapper.findCraneByPlate(row.craneLicensePlate);
    const foundOperator = dataMapper.findOperatorByRut(row.operatorRut);
    const foundServiceType = dataMapper.findServiceTypeByName(row.serviceType);

    if (!foundClient) {
      console.warn(`Client not found for RUT: ${row.clientRut} or Name: ${row.clientName}`);
      return { success: false, error: `Cliente no encontrado: ${row.clientRut || row.clientName}` };
    }

    if (!foundCrane) {
      console.warn(`Crane not found for License Plate: ${row.craneLicensePlate}`);
      return { success: false, error: `Grúa no encontrada: ${row.craneLicensePlate}` };
    }

    if (!foundOperator) {
      console.warn(`Operator not found for RUT: ${row.operatorRut}`);
      return { success: false, error: `Operador no encontrado: ${row.operatorRut}` };
    }

    if (!foundServiceType) {
      console.warn(`Service Type not found for Name: ${row.serviceType}`);
      return { success: false, error: `Tipo de servicio no encontrado: ${row.serviceType}` };
    }

    // Manual transformation and validation
    const requestDate = dataMapper.fixDateFormat(row.requestDate);
    const serviceDate = dataMapper.fixDateFormat(row.serviceDate);

    if (!requestDate || !serviceDate) {
      return { success: false, error: 'Formato de fecha inválido. Utilice DD-MM-AAAA.' };
    }

    const value = parseFloat(row.value) || 0;
    const operatorCommission = parseFloat(row.operatorCommission) || 0;

    return {
      success: true,
      data: {
        folio: row.folio,
        requestDate,
        serviceDate,
        clientId: foundClient.id,
        vehicleBrand: row.vehicleBrand || '',
        vehicleModel: row.vehicleModel || '',
        licensePlate: row.licensePlate || '',
        origin: row.origin,
        destination: row.destination,
        // Ensure all required properties are provided
        serviceType: {
          id: foundServiceType.id,
          name: foundServiceType.name,
          description: foundServiceType.description || '',
          basePrice: foundServiceType.basePrice,
          isActive: true,
          vehicleInfoOptional: foundServiceType.vehicleInfoOptional || false,
          purchaseOrderRequired: foundServiceType.purchaseOrderRequired || false,
          originRequired: foundServiceType.originRequired !== false,
          destinationRequired: foundServiceType.destinationRequired !== false,
          craneRequired: foundServiceType.craneRequired !== false,
          operatorRequired: foundServiceType.operatorRequired !== false,
          vehicleBrandRequired: foundServiceType.vehicleBrandRequired !== false,
          vehicleModelRequired: foundServiceType.vehicleModelRequired !== false,
          licensePlateRequired: foundServiceType.licensePlateRequired !== false,
          createdAt: '',
          updatedAt: ''
        },
        value,
        craneId: foundCrane.id,
        operatorId: foundOperator.id,
        operatorCommission,
        observations: row.observations || ''
      }
    };
  } catch (error: any) {
    console.error("Error creating service from CSV row:", error);
    return { success: false, error: `Error al crear el servicio: ${error.message || error}` };
  }
};
