import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Operator } from '@/types';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch } from '@/services/offlineOperations';
import { toast } from 'sonner';

const transformFromDb = (operator: any): Operator => ({
  id: operator.id,
  name: operator.name,
  rut: operator.rut,
  phone: operator.phone || '',
  operatorType: (operator.operator_type as 'crane_operator' | 'administrative') || 'crane_operator',
  department: operator.department || '',
  position: operator.position || '',
  licenseNumber: operator.license_number || '',
  examExpiry: operator.exam_expiry || '',
  isActive: operator.is_active || false,
  createdAt: operator.created_at,
  updatedAt: operator.updated_at,
  createdBy: operator.created_by,
  creatorName: operator.creator?.full_name || operator.creator?.email || undefined,
  _isOffline: operator._isOffline || false
});

const fetchOperators = async (): Promise<Operator[]> => {
  const { data, error } = await supabase
    .from('operators')
    .select(`
      *,
      creator:profiles!operators_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(transformFromDb);
};

export const useOperatorsData = () => {
  const { effectiveIsOnline } = useOfflineMode();

  return useQuery<Operator[], Error>({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<Operator>(
        'operators',
        effectiveIsOnline,
        fetchOperators,
        (rawData) => rawData.map(transformFromDb)
      );
      
      if (isFromCache && data.length > 0) {
        toast.info('Datos desde cache local', { 
          description: `${data.length} operadores cargados offline`,
          duration: 2000
        });
      }
      
      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
  });
};

export { transformFromDb as transformOperatorFromDb };
