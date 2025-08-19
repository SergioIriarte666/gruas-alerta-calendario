
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
    
    // Grúa
    'GRÚA PATENTE': 'craneLicensePlate',
    'grúa patente': 'craneLicensePlate',
    'Grúa patente': 'craneLicensePlate',
    'Grua Patente': 'craneLicensePlate',
    'grua patente': 'craneLicensePlate',
    'Patente Grúa': 'craneLicensePlate',
    'patente grúa': 'craneLicensePlate',
    'Patente Grua': 'craneLicensePlate',
    'patente grua': 'craneLicensePlate',
    
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
    console.log('🗺️ Mapping headers:', headers);
    
    const mappedHeaders = headers.map(header => {
      const trimmedHeader = header.trim();
      const mapped = this.headerMap[trimmedHeader];
      
      if (mapped) {
        console.log(`✅ Header mapped: "${trimmedHeader}" → "${mapped}"`);
        return mapped;
      } else {
        // Fallback: convert to camelCase
        const fallback = trimmedHeader.toLowerCase().replace(/\s+/g, '');
        console.log(`⚠️ Header not found in map: "${trimmedHeader}", using fallback: "${fallback}"`);
        return fallback;
      }
    });
    
    console.log('🗺️ Final mapped headers:', mappedHeaders);
    return mappedHeaders;
  }

  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; extra: string[] } {
    console.log('🔍 Validating headers:', headers);
    
    const required = [
      'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName', 'clientDepartment',
      'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
      'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
    ];

    const mappedHeaders = this.mapHeaders(headers);
    const missing = required.filter(req => !mappedHeaders.includes(req));
    const extra = mappedHeaders.filter(h => !required.includes(h) && h !== 'observations');

    const result = {
      valid: missing.length === 0,
      missing,
      extra
    };
    
    console.log('📋 Header validation result:', result);
    return result;
  }

  // Método para verificar si un header es reconocido
  isRecognizedHeader(header: string): boolean {
    return this.headerMap.hasOwnProperty(header.trim());
  }

  // Método para obtener todas las variaciones de un campo
  getHeaderVariations(field: string): string[] {
    return Object.keys(this.headerMap).filter(key => this.headerMap[key] === field);
  }
}
