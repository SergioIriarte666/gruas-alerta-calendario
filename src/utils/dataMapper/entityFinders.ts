
import { Client, Crane, Operator, ServiceType } from '@/types';

export class EntityFinders {
  constructor(
    private clients: Client[],
    private cranes: Crane[],
    private operators: Operator[],
    private serviceTypes: ServiceType[]
  ) {}

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
}
