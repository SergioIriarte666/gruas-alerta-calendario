
import { useClosureData } from './closures/useClosureData';
import { useClosureOperations } from './closures/useClosureOperations';
import { useQueryClient } from '@tanstack/react-query';

export const useServiceClosures = () => {
  const { closures, loading, addClosure, updateClosure: updateClosureInState, removeClosure, refetch } = useClosureData();
  const { createClosure: createClosureOp, updateClosure: updateClosureOp, deleteClosure: deleteClosureOp, closeClosure: closeClosureOp } = useClosureOperations();
  const queryClient = useQueryClient();

  const invalidateClosureQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] });
  };

  const createClosure = async (closureData: Parameters<typeof createClosureOp>[0]) => {
    const newClosure = await createClosureOp(closureData);
    addClosure(newClosure);
    invalidateClosureQueries();
    return newClosure;
  };

  const updateClosure = async (id: string, closureData: Parameters<typeof updateClosureOp>[1]) => {
    const updates = await updateClosureOp(id, closureData);
    updateClosureInState(id, updates);
    invalidateClosureQueries();
  };

  const deleteClosure = async (id: string) => {
    await deleteClosureOp(id);
    removeClosure(id);
    invalidateClosureQueries();
  };

  const closeClosure = async (id: string) => {
    const updates = await closeClosureOp(id);
    updateClosureInState(id, updates);
    invalidateClosureQueries();
  };

  return {
    closures,
    loading,
    createClosure,
    updateClosure,
    deleteClosure,
    closeClosure,
    refetch
  };
};
