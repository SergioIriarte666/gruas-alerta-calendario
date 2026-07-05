import { useMemo } from 'react';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';

export const useTrackableOperators = () => {
  const { data: operators = [], isLoading, error } = useOperatorsData();

  const trackableOperators = useMemo(
    () => operators.filter((operator) =>
      operator.isActive
      && operator.operatorType === 'crane_operator'
      && operator.trackingEnabled !== false),
    [operators],
  );

  return {
    operators: trackableOperators,
    isLoading,
    error,
  };
};
