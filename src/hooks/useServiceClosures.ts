
import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';

// Mock data para desarrollo
const mockClosures: ServiceClosure[] = [
  {
    id: '1',
    folio: 'CIE-001',
    serviceIds: ['1', '2', '3'],
    dateRange: {
      from: '2024-01-01',
      to: '2024-01-15'
    },
    clientId: '1',
    total: 450000,
    status: 'closed',
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z'
  },
  {
    id: '2',
    folio: 'CIE-002',
    serviceIds: ['4', '5'],
    dateRange: {
      from: '2024-01-16',
      to: '2024-01-31'
    },
    clientId: '2',
    total: 280000,
    status: 'open',
    createdAt: '2024-02-01T14:30:00Z',
    updatedAt: '2024-02-01T14:30:00Z'
  }
];

export const useServiceClosures = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setClosures(mockClosures);
      setLoading(false);
    }, 500);
  }, []);

  const createClosure = (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    const newClosure: ServiceClosure = {
      ...closureData,
      id: Date.now().toString(),
      folio: `CIE-${String(closures.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setClosures(prev => [newClosure, ...prev]);
    return newClosure;
  };

  const updateClosure = (id: string, closureData: Partial<ServiceClosure>) => {
    setClosures(prev => prev.map(closure => 
      closure.id === id 
        ? { ...closure, ...closureData, updatedAt: new Date().toISOString() }
        : closure
    ));
  };

  const deleteClosure = (id: string) => {
    setClosures(prev => prev.filter(closure => closure.id !== id));
  };

  const closeClosure = (id: string) => {
    setClosures(prev => prev.map(closure => 
      closure.id === id 
        ? { ...closure, status: 'closed' as const, updatedAt: new Date().toISOString() }
        : closure
    ));
  };

  return {
    closures,
    loading,
    createClosure,
    updateClosure,
    deleteClosure,
    closeClosure
  };
};
