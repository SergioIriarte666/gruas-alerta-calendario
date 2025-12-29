import { useMemo } from 'react';
import { Client } from '@/types';

interface ClientsMetrics {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  uniqueCompanies: number;
  multiDepartmentCompanies: number;
  activePercentage: number;
}

export const useClientsMetrics = (clients: Client[]): ClientsMetrics => {
  return useMemo(() => {
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.isActive).length;
    const inactiveClients = totalClients - activeClients;
    
    // Contar empresas únicas por RUT
    const rutCounts = clients.reduce((acc, client) => {
      acc[client.rut] = (acc[client.rut] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const uniqueCompanies = Object.keys(rutCounts).length;
    const multiDepartmentCompanies = Object.values(rutCounts).filter(count => count > 1).length;
    
    const activePercentage = totalClients > 0 
      ? Math.round((activeClients / totalClients) * 100) 
      : 0;

    return {
      totalClients,
      activeClients,
      inactiveClients,
      uniqueCompanies,
      multiDepartmentCompanies,
      activePercentage,
    };
  }, [clients]);
};
