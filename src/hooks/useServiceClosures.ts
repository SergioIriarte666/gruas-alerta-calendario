
import { useClosureData } from './closures/useClosureData';
import { useClosureOperations } from './closures/useClosureOperations';

export const useServiceClosures = () => {
  const { closures, loading, addClosure, updateClosure: updateClosureInState, removeClosure, refetch } = useClosureData();
  const { createClosure: createClosureOp, updateClosure: updateClosureOp, deleteClosure: deleteClosureOp, closeClosure: closeClosureOp } = useClosureOperations();

  const createClosure = async (closureData: Parameters<typeof createClosureOp>[0]) => {
    const newClosure = await createClosureOp(closureData);
    addClosure(newClosure);
    return newClosure;
  };

  const updateClosure = async (id: string, closureData: Parameters<typeof updateClosureOp>[1]) => {
    const updates = await updateClosureOp(id, closureData);
    updateClosureInState(id, updates);
  };

  const deleteClosure = async (id: string) => {
    await deleteClosureOp(id);
    removeClosure(id);
  };

  const closeClosure = async (id: string) => {
    const updates = await closeClosureOp(id);
    updateClosureInState(id, updates);
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
