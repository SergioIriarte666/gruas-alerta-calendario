
import { useState, useEffect } from 'react';
import { Crane } from '@/types';

// Mock data para desarrollo
const mockCranes: Crane[] = [
  {
    id: '1',
    licensePlate: 'GRUA-01',
    brand: 'Mercedes-Benz',
    model: 'Atego 1725',
    type: 'medium',
    circulationPermitExpiry: '2024-12-15',
    insuranceExpiry: '2024-10-30',
    technicalReviewExpiry: '2024-11-20',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    licensePlate: 'TAXI-02',
    brand: 'Ford',
    model: 'F-350',
    type: 'taxi',
    circulationPermitExpiry: '2024-08-10',
    insuranceExpiry: '2024-09-15',
    technicalReviewExpiry: '2024-07-25',
    isActive: true,
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '3',
    licensePlate: 'GRUA-03',
    brand: 'Iveco',
    model: 'Daily 70C17',
    type: 'light',
    circulationPermitExpiry: '2024-06-30',
    insuranceExpiry: '2024-05-20',
    technicalReviewExpiry: '2024-04-15',
    isActive: false,
    createdAt: '2024-01-10T09:15:00Z',
    updatedAt: '2024-01-25T16:45:00Z'
  }
];

export const useCranes = () => {
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setCranes(mockCranes);
      setLoading(false);
    }, 500);
  }, []);

  const createCrane = (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCrane: Crane = {
      ...craneData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCranes(prev => [newCrane, ...prev]);
    return newCrane;
  };

  const updateCrane = (id: string, craneData: Partial<Crane>) => {
    setCranes(prev => prev.map(crane => 
      crane.id === id 
        ? { ...crane, ...craneData, updatedAt: new Date().toISOString() }
        : crane
    ));
  };

  const deleteCrane = (id: string) => {
    setCranes(prev => prev.filter(crane => crane.id !== id));
  };

  const toggleCraneStatus = (id: string) => {
    setCranes(prev => prev.map(crane => 
      crane.id === id 
        ? { ...crane, isActive: !crane.isActive, updatedAt: new Date().toISOString() }
        : crane
    ));
  };

  return {
    cranes,
    loading,
    createCrane,
    updateCrane,
    deleteCrane,
    toggleCraneStatus
  };
};
