
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';

export const useOperators = () => {
  const { data: operators = [], isLoading, error } = useOperatorsData();
  
  return {
    operators,
    loading: isLoading,
    error
  };
};
