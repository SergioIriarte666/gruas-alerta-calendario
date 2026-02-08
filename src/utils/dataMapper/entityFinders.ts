
import { Client, Crane, Operator, ServiceType } from '@/types';

// Función auxiliar para normalizar texto (quitar acentos y espacios)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quita acentos
};

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

  findClientByRutAndDepartment(rut: string, department: string | undefined): Client | null {
    if (!department) return null;
    
    const cleanRut = rut.replace(/[.\s-]/g, '');
    const cleanDepartment = department.toLowerCase().trim();
    return this.clients.find(client => 
      client.rut.replace(/[.\s-]/g, '') === cleanRut &&
      client.department && client.department.toLowerCase().trim() === cleanDepartment
    ) || null;
  }

  findClientByName(name: string): Client | null {
    const cleanName = name.toLowerCase().trim();
    return this.clients.find(client => 
      client.name && (
        client.name.toLowerCase().includes(cleanName) || 
        cleanName.includes(client.name.toLowerCase())
      )
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
    const cleanName = normalizeText(name);
    return this.serviceTypes.find(serviceType => {
      const typeName = normalizeText(serviceType.name || '');
      return typeName.includes(cleanName) || cleanName.includes(typeName);
    }) || null;
  }
}
