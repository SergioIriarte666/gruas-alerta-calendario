
import { useState, useEffect } from 'react';
import { Operator } from '@/types';

// Mock data para desarrollo
const mockOperators: Operator[] = [
  {
    id: '1',
    name: 'Carlos Mendoza García',
    rut: '16.123.456-7',
    phone: '+56 9 8765 4321',
    licenseNumber: 'A-123456',
    examExpiry: '2024-12-15',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Roberto Silva Martínez',
    rut: '18.789.123-4',
    phone: '+56 9 2234 5678',
    licenseNumber: 'A-789123',
    examExpiry: '2024-10-30',
    isActive: true,
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '3',
    name: 'María Elena Torres',
    rut: '19.345.678-9',
    phone: '+56 9 1234 5678',
    licenseNumber: 'A-345678',
    examExpiry: '2024-06-20',
    isActive: false,
    createdAt: '2024-01-10T09:15:00Z',
    updatedAt: '2024-01-25T16:45:00Z'
  }
];

export const useOperators = () => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setOperators(mockOperators);
      setLoading(false);
    }, 500);
  }, []);

  const createOperator = (operatorData: Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newOperator: Operator = {
      ...operatorData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setOperators(prev => [newOperator, ...prev]);
    return newOperator;
  };

  const updateOperator = (id: string, operatorData: Partial<Operator>) => {
    setOperators(prev => prev.map(operator => 
      operator.id === id 
        ? { ...operator, ...operatorData, updatedAt: new Date().toISOString() }
        : operator
    ));
  };

  const deleteOperator = (id: string) => {
    setOperators(prev => prev.filter(operator => operator.id !== id));
  };

  const toggleOperatorStatus = (id: string) => {
    setOperators(prev => prev.map(operator => 
      operator.id === id 
        ? { ...operator, isActive: !operator.isActive, updatedAt: new Date().toISOString() }
        : operator
    ));
  };

  return {
    operators,
    loading,
    createOperator,
    updateOperator,
    deleteOperator,
    toggleOperatorStatus
  };
};
