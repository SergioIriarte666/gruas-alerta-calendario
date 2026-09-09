import { createLogger } from "@/lib/logger";


const logger = createLogger("headerMapping");
// Función auxiliar para normalizar texto (quitar acentos)
const normalizeForComparison = (text: string): string => {
  return text
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export class HeaderMapper {
  // Mapeo completo de headers en español a campos internos
  private headerMap: { [key: string]: string } = {
    // Headers principales
    'Folio': 'folio',
    'Fecha Solicitud': 'requestDate',
    'Fecha Servicio': 'serviceDate',
    'Cliente RUT': 'clientRut',
    'Cliente Nombre': 'clientName',
    'Cliente Departamento': 'clientDepartment',
    'Vehículo Marca': 'vehicleBrand',
    'Vehículo Modelo': 'vehicleModel',
    'Patente': 'licensePlate',
    'Origen': 'origin',
    'Destino': 'destination',
    'Tipo Servicio': 'serviceType',
    'Valor': 'value',
    'Grúa Patente': 'craneLicensePlate',
    'Operador RUT': 'operatorRut',
    'Comisión Operador': 'operatorCommission',
    'Observaciones': 'observations',
    
    // Variaciones posibles de headers
    'FOLIO': 'folio',
    'folio': 'folio',
    'FECHA SOLICITUD': 'requestDate',
    'fecha solicitud': 'requestDate',
    'Fecha solicitud': 'requestDate',
    'FECHA SERVICIO': 'serviceDate',
    'fecha servicio': 'serviceDate',
    'Fecha servicio': 'serviceDate',
    
    // Cliente
    'CLIENTE RUT': 'clientRut',
    'cliente rut': 'clientRut',
    'Cliente rut': 'clientRut',
    'RUT Cliente': 'clientRut',
    'rut cliente': 'clientRut',
    'CLIENTE NOMBRE': 'clientName',
    'cliente nombre': 'clientName',
    'Cliente nombre': 'clientName',
    'Nombre Cliente': 'clientName',
    'nombre cliente': 'clientName',
    'CLIENTE DEPARTAMENTO': 'clientDepartment',
    'cliente departamento': 'clientDepartment',
    'Cliente departamento': 'clientDepartment',
    'Departamento Cliente': 'clientDepartment',
    'departamento cliente': 'clientDepartment',
    'DEPARTAMENTO': 'clientDepartment',
    'departamento': 'clientDepartment',
    'Departamento': 'clientDepartment',
    'Department': 'clientDepartment',
    'department': 'clientDepartment',
    
    // Vehículo
    'VEHÍCULO MARCA': 'vehicleBrand',
    'vehículo marca': 'vehicleBrand',
    'Vehículo marca': 'vehicleBrand',
    'Vehiculo Marca': 'vehicleBrand',
    'vehiculo marca': 'vehicleBrand',
    'Marca Vehículo': 'vehicleBrand',
    'marca vehículo': 'vehicleBrand',
    'VEHÍCULO MODELO': 'vehicleModel',
    'vehículo modelo': 'vehicleModel',
    'Vehículo modelo': 'vehicleModel',
    'Vehiculo Modelo': 'vehicleModel',
    'vehiculo modelo': 'vehicleModel',
    'Modelo Vehículo': 'vehicleModel',
    'modelo vehículo': 'vehicleModel',
    
    // Patente
    'PATENTE': 'licensePlate',
    'patente': 'licensePlate',
    'Placa': 'licensePlate',
    'placa': 'licensePlate',
    'License Plate': 'licensePlate',
    'license plate': 'licensePlate',
    
    // Ubicaciones
    'ORIGEN': 'origin',
    'origen': 'origin',
    'Origin': 'origin',
    'origin': 'origin',
    'DESTINO': 'destination',
    'destino': 'destination',
    'Destination': 'destination',
    'destination': 'destination',
    
    // Servicio
    'TIPO SERVICIO': 'serviceType',
    'tipo servicio': 'serviceType',
    'Tipo servicio': 'serviceType',
    'Service Type': 'serviceType',
    'service type': 'serviceType',
    'Servicio': 'serviceType',
    'servicio': 'serviceType',
    
    // Grúa (con y sin acentos)
    'GRÚA PATENTE': 'craneLicensePlate',
    'grúa patente': 'craneLicensePlate',
    'Grúa patente': 'craneLicensePlate',
    'Grua Patente': 'craneLicensePlate',
    'grua patente': 'craneLicensePlate',
    'GRUA PATENTE': 'craneLicensePlate',
    'Patente Grúa': 'craneLicensePlate',
    'patente grúa': 'craneLicensePlate',
    'Patente Grua': 'craneLicensePlate',
    'patente grua': 'craneLicensePlate',
    'Crane Plate': 'craneLicensePlate',
    'crane plate': 'craneLicensePlate',
    
    // Operador
    'OPERADOR RUT': 'operatorRut',
    'operador rut': 'operatorRut',
    'Operador rut': 'operatorRut',
    'RUT Operador': 'operatorRut',
    'rut operador': 'operatorRut',
    'Operator RUT': 'operatorRut',
    'operator rut': 'operatorRut',
    
    // Valores
    'VALOR': 'value',
    'valor': 'value',
    'Value': 'value',
    'value': 'value',
    'Precio': 'value',
    'precio': 'value',
    'Costo': 'value',
    'costo': 'value',
    'COMISIÓN OPERADOR': 'operatorCommission',
    'comisión operador': 'operatorCommission',
    'Comisión operador': 'operatorCommission',
    'Comision Operador': 'operatorCommission',
    'comision operador': 'operatorCommission',
    'Operator Commission': 'operatorCommission',
    'operator commission': 'operatorCommission',

    // Gastos opcionales del servicio
    'Combustible': 'fuelExpense',
    'COMBUSTIBLE': 'fuelExpense',
    'combustible': 'fuelExpense',
    'Viáticos': 'allowanceExpense',
    'VIÁTICOS': 'allowanceExpense',
    'viáticos': 'allowanceExpense',
    'Viaticos': 'allowanceExpense',
    'VIATICOS': 'allowanceExpense',
    'viaticos': 'allowanceExpense',
    'Peajes': 'tollExpense',
    'PEAJES': 'tollExpense',
    'peajes': 'tollExpense',
    
    // Observaciones
    'OBSERVACIONES': 'observations',
    'observaciones': 'observations',
    'Observacion': 'observations',
    'observacion': 'observations',
    'Notes': 'observations',
    'notes': 'observations',
    'Notas': 'observations',
    'notas': 'observations',
    'Comentarios': 'observations',
    'comentarios': 'observations'
  };

  mapHeaders(headers: string[]): string[] {
    logger.debug('🗺️ Mapping headers:', headers);
    
    const mappedHeaders = headers.map(header => {
      const trimmedHeader = header.trim();
      
      // Primero buscar el header exacto
      let mapped = this.headerMap[trimmedHeader];
      
      // Si no se encuentra, buscar con normalización (sin acentos)
      if (!mapped) {
        const normalizedHeader = normalizeForComparison(trimmedHeader);
        // Buscar en el mapa comparando versiones normalizadas
        for (const [key, value] of Object.entries(this.headerMap)) {
          if (normalizeForComparison(key) === normalizedHeader) {
            mapped = value;
            break;
          }
        }
      }
      
      if (mapped) {
        logger.debug(`✅ Header mapped: "${trimmedHeader}" → "${mapped}"`);
        return mapped;
      } else {
        // Fallback: convert to camelCase
        const fallback = trimmedHeader.toLowerCase().replace(/\s+/g, '');
        logger.debug(`⚠️ Header not found in map: "${trimmedHeader}", using fallback: "${fallback}"`);
        return fallback;
      }
    });
    
    logger.debug('🗺️ Final mapped headers:', mappedHeaders);
    return mappedHeaders;
  }

  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; extra: string[] } {
    logger.debug('🔍 Validating headers:', headers);
    
    const required = [
      'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName', 'clientDepartment',
      'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
      'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
    ];

    const mappedHeaders = this.mapHeaders(headers);
    const missing = required.filter(req => !mappedHeaders.includes(req));
    const optional = ['observations', 'fuelExpense', 'allowanceExpense', 'tollExpense'];
    const extra = mappedHeaders.filter(h => !required.includes(h) && !optional.includes(h));

    const result = {
      valid: missing.length === 0,
      missing,
      extra
    };
    
    logger.debug('📋 Header validation result:', result);
    return result;
  }

  // Método para verificar si un header es reconocido
  isRecognizedHeader(header: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.headerMap, header.trim());
  }

  // Método para obtener todas las variaciones de un campo
  getHeaderVariations(field: string): string[] {
    return Object.keys(this.headerMap).filter(key => this.headerMap[key] === field);
  }
}
