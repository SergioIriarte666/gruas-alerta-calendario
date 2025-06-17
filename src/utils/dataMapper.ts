
import { Client, Crane, Operator } from '@/types';
import { ServiceType } from '@/hooks/useServiceTypes';
import { supabase } from '@/integrations/supabase/client';

export interface MappedServiceData {
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientId: string;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  serviceTypeId: string;
  value: number;
  craneId: string;
  operatorId: string;
  operatorCommission: number;
  observations?: string;
}

export interface MappingResult {
  success: boolean;
  data?: MappedServiceData;
  errors: string[];
  warnings: string[];
}

export class DataMapper {
  private clients: Client[] = [];
  private cranes: Crane[] = [];
  private operators: Operator[] = [];
  private serviceTypes: ServiceType[] = [];

  // Header mapping from Spanish to English
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

  async initialize() {
    console.log('Initializing data mapper...');
    
    // Load all reference data
    const [clientsData, cranesData, operatorsData, serviceTypesData] = await Promise.all([
      this.loadClients(),
      this.loadCranes(),
      this.loadOperators(),
      this.loadServiceTypes()
    ]);

    this.clients = clientsData;
    this.cranes = cranesData;
    this.operators = operatorsData;
    this.serviceTypes = serviceTypesData;

    console.log('Data mapper initialized with:', {
      clients: this.clients.length,
      cranes: this.cranes.length,
      operators: this.operators.length,
      serviceTypes: this.serviceTypes.length
    });
  }

  private async loadClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(client => ({
      id: client.id,
      name: client.name,
      rut: client.rut,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      isActive: client.is_active,
      createdAt: client.created_at,
      updatedAt: client.updated_at
    }));
  }

  private async loadCranes(): Promise<Crane[]> {
    const { data, error } = await supabase
      .from('cranes')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(crane => ({
      id: crane.id,
      licensePlate: crane.license_plate,
      brand: crane.brand,
      model: crane.model,
      type: crane.type,
      circulationPermitExpiry: crane.circulation_permit_expiry,
      insuranceExpiry: crane.insurance_expiry,
      technicalReviewExpiry: crane.technical_review_expiry,
      isActive: crane.is_active,
      createdAt: crane.created_at,
      updatedAt: crane.updated_at
    }));
  }

  private async loadOperators(): Promise<Operator[]> {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(operator => ({
      id: operator.id,
      name: operator.name,
      rut: operator.rut,
      phone: operator.phone || '',
      licenseNumber: operator.license_number,
      examExpiry: operator.exam_expiry,
      isActive: operator.is_active,
      createdAt: operator.created_at,
      updatedAt: operator.updated_at
    }));
  }

  private async loadServiceTypes(): Promise<ServiceType[]> {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return (data || []).map(serviceType => ({
      id: serviceType.id,
      name: serviceType.name,
      description: serviceType.description || '',
      basePrice: serviceType.base_price,
      isActive: serviceType.is_active,
      createdAt: serviceType.created_at,
      updatedAt: serviceType.updated_at
    }));
  }

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

  fixDateFormat(value: any): string {
    if (!value) return '';
    
    // Handle Excel serial numbers
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    return value.toString();
  }

  findClientByRut(rut: string): Client | null {
    const cleanRut = rut.replace(/[.\s-]/g, '');
    return this.clients.find(client => 
      client.rut.replace(/[.\s-]/g, '') === cleanRut
    ) || null;
  }

  findClientByName(name: string): Client | null {
    const cleanName = name.toLowerCase().trim();
    return this.clients.find(client => 
      client.name.toLowerCase().includes(cleanName) || 
      cleanName.includes(client.name.toLowerCase())
    ) || null;
  }

  findCraneByPlate(plate: string): Crane | null {
    const cleanPlate = plate.toUpperCase().replace(/[.\s-]/g, '');
    return this.cranes.find(crane => 
      crane.licensePlate.toUpperCase().replace(/[.\s-]/g, '') === cleanPlate
    ) || null;
  }

  findOperatorByRut(rut: string): Operator | null {
    const cleanRut = rut.replace(/[.\s-]/g, '');
    return this.operators.find(operator => 
      operator.rut.replace(/[.\s-]/g, '') === cleanRut
    ) || null;
  }

  findServiceTypeByName(name: string): ServiceType | null {
    const cleanName = name.toLowerCase().trim();
    return this.serviceTypes.find(serviceType => 
      serviceType.name.toLowerCase().includes(cleanName) ||
      cleanName.includes(serviceType.name.toLowerCase())
    ) || null;
  }

  async mapRowData(rowData: any): Promise<MappingResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Find client
      const client = this.findClientByRut(rowData.clientRut) || this.findClientByName(rowData.clientName);
      if (!client) {
        errors.push(`Cliente no encontrado: RUT ${rowData.clientRut} - ${rowData.clientName}`);
      }

      // Find crane
      const crane = this.findCraneByPlate(rowData.craneLicensePlate);
      if (!crane) {
        errors.push(`Grúa no encontrada: ${rowData.craneLicensePlate}`);
      }

      // Find operator
      const operator = this.findOperatorByRut(rowData.operatorRut);
      if (!operator) {
        errors.push(`Operador no encontrado: ${rowData.operatorRut}`);
      }

      // Find service type
      const serviceType = this.findServiceTypeByName(rowData.serviceType);
      if (!serviceType) {
        errors.push(`Tipo de servicio no encontrado: ${rowData.serviceType}`);
      }

      // Validate and fix dates
      const requestDate = this.fixDateFormat(rowData.requestDate);
      const serviceDate = this.fixDateFormat(rowData.serviceDate);

      if (!requestDate || requestDate === 'Invalid Date') {
        errors.push(`Fecha de solicitud inválida: ${rowData.requestDate}`);
      }

      if (!serviceDate || serviceDate === 'Invalid Date') {
        errors.push(`Fecha de servicio inválida: ${rowData.serviceDate}`);
      }

      // Validate numeric values
      const value = parseFloat(rowData.value);
      const operatorCommission = parseFloat(rowData.operatorCommission);

      if (isNaN(value) || value <= 0) {
        errors.push(`Valor inválido: ${rowData.value}`);
      }

      if (isNaN(operatorCommission) || operatorCommission < 0) {
        errors.push(`Comisión inválida: ${rowData.operatorCommission}`);
      }

      // Check for warnings
      if (client && rowData.clientName && client.name !== rowData.clientName) {
        warnings.push(`Nombre de cliente no coincide exactamente: "${rowData.clientName}" vs "${client.name}"`);
      }

      if (errors.length === 0) {
        const mappedData: MappedServiceData = {
          folio: rowData.folio.toString().trim(),
          requestDate,
          serviceDate,
          clientId: client!.id,
          vehicleBrand: rowData.vehicleBrand.toString().trim(),
          vehicleModel: rowData.vehicleModel.toString().trim(),
          licensePlate: rowData.licensePlate.toString().toUpperCase().trim(),
          origin: rowData.origin.toString().trim(),
          destination: rowData.destination.toString().trim(),
          serviceTypeId: serviceType!.id,
          value: Math.round(value),
          craneId: crane!.id,
          operatorId: operator!.id,
          operatorCommission: Math.round(operatorCommission),
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
