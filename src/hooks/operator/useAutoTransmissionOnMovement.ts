import { useEffect, useRef, useState } from 'react';
import { getCurrentLocationPoint } from '@/services/operatorLocationService';
import { SustainedMovementTracker } from '@/utils/sustainedMovement';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Tracking');

/**
 * Cadencia del sondeo. Con 15 s hacen falta ~4 muestras seguidas sobre el
 * umbral para completar los 60 s sostenidos, suficiente para no reaccionar a
 * un salto de GPS aislado.
 */
const PROBE_INTERVAL_MS = 15000;

interface UseAutoTransmissionOnMovementOptions {
  /** Solo con servicio activo: fuera de un servicio nadie espera que se encienda sola. */
  enabled: boolean;
  /** Corte manual del operador: inhibe el encendido, solo se avisa. */
  manualStop: boolean;
  onSustainedMovement: () => void | Promise<void>;
}

/**
 * Enciende la transmisión sola cuando la grúa lleva rato rodando (3.6).
 *
 * Sondea en primer plano con `getCurrentLocationPoint`, no con un watcher de
 * fondo: con la transmisión apagada no hay watcher corriendo y montar uno solo
 * para vigilar sería encender el GPS de fondo justo cuando el operador pidió no
 * transmitir. El alcance es deliberadamente "con la app abierta".
 *
 * Devuelve `isRollingWithoutTransmitting` para que el control muestre "Rodando
 * sin transmitir" cuando hay corte manual: el sistema avisa, nunca decide por
 * sobre el operador.
 */
export const useAutoTransmissionOnMovement = ({
  enabled,
  manualStop,
  onSustainedMovement,
}: UseAutoTransmissionOnMovementOptions) => {
  const [isRollingWithoutTransmitting, setIsRollingWithoutTransmitting] = useState(false);
  const trackerRef = useRef(new SustainedMovementTracker());
  const callbackRef = useRef(onSustainedMovement);
  callbackRef.current = onSustainedMovement;

  useEffect(() => {
    if (!enabled) {
      trackerRef.current.reset();
      setIsRollingWithoutTransmitting(false);
      return;
    }

    let cancelled = false;

    const probe = async () => {
      try {
        const point = await getCurrentLocationPoint();
        if (cancelled) return;

        const sustained = trackerRef.current.push({
          speedMps: point.speedMps,
          latitude: point.latitude,
          longitude: point.longitude,
          atMs: new Date(point.recordedAt).getTime(),
        });

        if (!sustained) return;

        if (manualStop) {
          // El operador cortó a mano: solo se avisa en el control.
          logger.debug('Movimiento sostenido con corte manual: no se enciende, solo se avisa');
          setIsRollingWithoutTransmitting(true);
          return;
        }

        logger.debug('Movimiento sostenido sin transmitir: encendiendo automáticamente');
        await callbackRef.current();
      } catch (error) {
        // Sin fix GPS no hay nada que decidir; el próximo sondeo reintenta.
        logger.debug('Sondeo de movimiento sin lectura de ubicación', error);
      }
    };

    void probe();
    const intervalId = window.setInterval(() => { void probe(); }, PROBE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, manualStop]);

  // Reencender a mano limpia el aviso sin esperar al próximo sondeo.
  useEffect(() => {
    if (!manualStop) setIsRollingWithoutTransmitting(false);
  }, [manualStop]);

  return { isRollingWithoutTransmitting };
};
