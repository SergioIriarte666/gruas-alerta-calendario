
export class HeaderMapper {
  private headerMap: { [key: string]: string } = {
    'Folio': 'folio',
    'Fecha Solicitud': 'requestDate',
    'Fecha Servicio': 'serviceDate',
    'Cliente RUT': 'clientRut',
    'Cliente Nombre': 'clientName',
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
    'Observaciones': 'observations'
  };

  mapHeaders(headers: string[]): string[] {
    return headers.map(header => {
      const mapped = this.headerMap[header.trim()];
      return mapped || header.toLowerCase().replace(/\s+/g, '');
    });
  }

  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; extra: string[] } {
    const required = [
      'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName',
      'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
      'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
    ];

    const mappedHeaders = this.mapHeaders(headers);
    const missing = required.filter(req => !mappedHeaders.includes(req));
    const extra = mappedHeaders.filter(h => !required.includes(h) && h !== 'observations');

    return {
      valid: missing.length === 0,
      missing,
      extra
    };
  }
}
