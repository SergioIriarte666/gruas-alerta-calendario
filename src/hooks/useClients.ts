
import { useState, useEffect } from 'react';
import { Client } from '@/types';

// Mock data para desarrollo
const mockClients: Client[] = [
  {
    id: '1',
    name: 'Transportes González Ltda.',
    rut: '76.123.456-7',
    phone: '+56 9 8765 4321',
    email: 'contacto@transportesgonzalez.cl',
    address: 'Av. Las Condes 123, Las Condes, Santiago',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Constructora San Miguel S.A.',
    rut: '96.789.123-4',
    phone: '+56 2 2234 5678',
    email: 'proyectos@sanmiguel.cl',
    address: 'Calle Central 456, San Miguel, Santiago',
    isActive: true,
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '3',
    name: 'Juan Pérez Soto',
    rut: '12.345.678-9',
    phone: '+56 9 1234 5678',
    email: 'juan.perez@email.com',
    address: 'Los Álamos 789, Maipú, Santiago',
    isActive: false,
    createdAt: '2024-01-10T09:15:00Z',
    updatedAt: '2024-01-25T16:45:00Z'
  }
];

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setClients(mockClients);
      setLoading(false);
    }, 500);
  }, []);

  const createClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setClients(prev => [newClient, ...prev]);
    return newClient;
  };

  const updateClient = (id: string, clientData: Partial<Client>) => {
    setClients(prev => prev.map(client => 
      client.id === id 
        ? { ...client, ...clientData, updatedAt: new Date().toISOString() }
        : client
    ));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(client => client.id !== id));
  };

  const toggleClientStatus = (id: string) => {
    setClients(prev => prev.map(client => 
      client.id === id 
        ? { ...client, isActive: !client.isActive, updatedAt: new Date().toISOString() }
        : client
    ));
  };

  return {
    clients,
    loading,
    createClient,
    updateClient,
    deleteClient,
    toggleClientStatus
  };
};
