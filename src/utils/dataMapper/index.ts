
import { DataMapperContext, MappingResult } from './types';
import { HeaderMapper } from './headerMapping';
import { DataLoaders } from './dataLoaders';
import { EntityFinders } from './entityFinders';
import { DataValidators } from './dataValidators';
import { RowMapper } from './rowMapper';
import { createLogger } from "@/lib/logger";


const logger = createLogger("dataMapper");
export type { MappedServiceData, MappingResult } from './types';

export class DataMapper {
  private context: DataMapperContext = {
    clients: [],
    cranes: [],
    operators: [],
    serviceTypes: []
  };

  private headerMapper = new HeaderMapper();
  private dataLoaders = new DataLoaders();
  private validators = new DataValidators();
  private entityFinders!: EntityFinders;
  private rowMapper!: RowMapper;

  async initialize() {
    logger.debug('Initializing data mapper...');
    
    // Load all reference data
    const [clients, cranes, operators, serviceTypes] = await Promise.all([
      this.dataLoaders.loadClients(),
      this.dataLoaders.loadCranes(),
      this.dataLoaders.loadOperators(),
      this.dataLoaders.loadServiceTypes()
    ]);

    this.context = { clients, cranes, operators, serviceTypes };
    
    // Initialize dependent services
    this.entityFinders = new EntityFinders(clients, cranes, operators, serviceTypes);
    this.rowMapper = new RowMapper(this.entityFinders, this.validators);

    logger.debug('Data mapper initialized with:', {
      clients: clients.length,
      cranes: cranes.length,
      operators: operators.length,
      serviceTypes: serviceTypes.length
    });
  }

  mapHeaders(headers: string[]): string[] {
    return this.headerMapper.mapHeaders(headers);
  }

  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; extra: string[] } {
    return this.headerMapper.validateHeaders(headers);
  }

  fixDateFormat(value: any): string {
    return this.validators.fixDateFormat(value);
  }

  // Legacy compatibility methods - delegate to EntityFinders
  findClientByRut(rut: string) {
    return this.entityFinders.findClientByRut(rut);
  }

  findClientByName(name: string) {
    return this.entityFinders.findClientByName(name);
  }

  findCraneByPlate(plate: string) {
    return this.entityFinders.findCraneByPlate(plate);
  }

  findOperatorByRut(rut: string) {
    return this.entityFinders.findOperatorByRut(rut);
  }

  findServiceTypeByName(name: string) {
    return this.entityFinders.findServiceTypeByName(name);
  }

  async mapRowData(rowData: any): Promise<MappingResult> {
    return this.rowMapper.mapRowData(rowData);
  }
}
