
import { useState, useEffect } from 'react';
import { Service, ServiceStatus } from '@/types';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperators } from './useOperators';

// Mock data para desarrollo - servicios básicos
const createMockServices = (clients: any[], cranes: any[], operators: any[]): Service[] => {
  if (!clients.length || !cranes.length || !operators.length) return [];

  return [
    {
      id: '1',
      folio: 'SRV-001',
      requestDate: '2024-01-15',
      serviceDate: '2024-01-16',
      client: clients[0],
      purchaseOrder: 'OC-12345',
      vehicleBrand: 'Volvo',
      vehicleModel: 'FH16',
      licensePlate: 'AB-CD-12',
      origin: 'Santiago Centro',
      destination: 'Las Condes',
      serviceType: { id: '1', name: 'Grúa Pesada', description: 'Servicio de grúa pesada', isActive: true, createdAt: '', updatedAt: '' },
      value: 150000,
      crane: cranes[0],
      operator: operators[0],
      operatorCommission: 15000,
      status: 'closed' as ServiceStatus,
      observations: 'Servicio completado exitosamente',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T18:00:00Z'
    },
    {
      id: '2',
      folio: 'SRV-002',
      requestDate: '2024-01-20',
      serviceDate: '2024-01-21',
      client: clients[1],
      vehicleBrand: 'Mercedes',
      vehicleModel: 'Actros',
      licensePlate: 'EF-GH-34',
      origin: 'Providencia',
      destination: 'Maipú',
      serviceType: { id: '2', name: 'Grúa Mediana', description: 'Servicio de grúa mediana', isActive: true, createdAt: '', updatedAt: '' },
      value: 120000,
      crane: cranes[1],
      operator: operators[1],
      operatorCommission: 12000,
      status: 'closed' as ServiceStatus,
      createdAt: '2024-01-20T14:00:00Z',
      updatedAt: '2024-01-21T16:30:00Z'
    },
    {
      id: '3',
      folio: 'SRV-003',
      requestDate: '2024-01-25',
      serviceDate: '2024-01-26',
      client: clients[0],
      vehicleBrand: 'Scania',
      vehicleModel: 'R450',
      licensePlate: 'IJ-KL-56',
      origin: 'Ñuñoa',
      destination: 'San Miguel',
      serviceType: { id: '1', name: 'Grúa Pesada', description: 'Servicio de grúa pesada', isActive: true, createdAt: '', updatedAt: '' },
      value: 180000,
      crane: cranes[0],
      operator: operators[0],
      operatorCommission: 18000,
      status: 'closed' as ServiceStatus,
      createdAt: '2024-01-25T09:00:00Z',
      updatedAt: '2024-01-26T17:00:00Z'
    },
    {
      id: '4',
      folio: 'SRV-004',
      requestDate: '2024-02-01',
      serviceDate: '2024-02-02',
      client: clients[1],
      vehicleBrand: 'DAF',
      vehicleModel: 'XF105',
      licensePlate: 'MN-OP-78',
      origin: 'Las Condes',
      destination: 'Vitacura',
      serviceType: { id: '2', name: 'Grúa Mediana', description: 'Servicio de grúa mediana', isActive: true, createdAt: '', updatedAt: '' },
      value: 100000,
      crane: cranes[1],
      operator: operators[1],
      operatorCommission: 10000,
      status: 'closed' as ServiceStatus,
      createdAt: '2024-02-01T11:00:00Z',
      updatedAt: '2024-02-02T15:30:00Z'
    },
    {
      id: '5',
      folio: 'SRV-005',
      requestDate: '2024-02-05',
      serviceDate: '2024-02-06',
      client: clients[2],
      vehicleBrand: 'MAN',
      vehicleModel: 'TGX',
      licensePlate: 'QR-ST-90',
      origin: 'San Miguel',
      destination: 'Puente Alto',
      serviceType: { id: '3', name: 'Taxi Grúa', description: 'Servicio de taxi grúa', isActive: true, createdAt: '', updatedAt: '' },
      value: 80000,
      crane: cranes[2] || cranes[0],
      operator: operators[2] || operators[0],
      operatorCommission: 8000,
      status: 'pending' as ServiceStatus,
      createdAt: '2024-02-05T13:00:00Z',
      updatedAt: '2024-02-05T13:00:00Z'
    }
  ];
};

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  useEffect(() => {
    if (clients.length > 0 && cranes.length > 0 && operators.length > 0) {
      setTimeout(() => {
        const mockServices = createMockServices(clients, cranes, operators);
        setServices(mockServices);
        setLoading(false);
      }, 500);
    }
  }, [clients, cranes, operators]);

  const createService = (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    const newService: Service = {
      ...serviceData,
      id: Date.now().toString(),
      folio: `SRV-${String(services.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setServices(prev => [newService, ...prev]);
    return newService;
  };

  const updateService = (id: string, serviceData: Partial<Service>) => {
    setServices(prev => prev.map(service => 
      service.id === id 
        ? { ...service, ...serviceData, updatedAt: new Date().toISOString() }
        : service
    ));
  };

  const deleteService = (id: string) => {
    setServices(prev => prev.filter(service => service.id !== id));
  };

  return {
    services,
    loading,
    createService,
    updateService,
    deleteService
  };
};
