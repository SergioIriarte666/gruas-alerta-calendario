import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ejecuta una sola acción asíncrona a la vez.
 *
 * El ref bloquea inmediatamente (antes del siguiente render), mientras que
 * isRunning permite deshabilitar el botón y mostrar feedback visual.
 */
export const useSingleFlight = () => {
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async <T,>(action: () => T | PromiseLike<T>): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined;

    inFlightRef.current = true;
    setIsRunning(true);

    try {
      return await action();
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsRunning(false);
    }
  }, []);

  return { run, isRunning };
};
