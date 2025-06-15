import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Operator } from '@/types';
import { useToast } from '@/hooks/use-toast';

const fetchOperators = async (): Promise<Operator[]> => {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(operator => ({
    id: operator.id,
    name: operator.name,
    rut: operator.rut,
    phone: operator.phone || '',
    licenseNumber: operator.license_number,
    examExpiry: operator.exam_expiry,
    isActive: operator.is_active || false,
    createdAt: operator.created_at,
    updatedAt: operator.updated_at
  }));
};

export const useOperatorsData = () => {
  const { toast } = useToast();

  return useQuery<Operator[], Error>({
    queryKey: ['operators'],
    queryFn: fetchOperators,
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudieron cargar los operadores.",
        variant: "destructive",
      });
      console.error('Error fetching operators:', error);
    },
  });
};
