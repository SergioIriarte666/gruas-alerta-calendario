import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DraggableFab');

export interface FabPosition {
  x: number;
  y: number;
}

interface UseDraggableFabOptions {
  /** Clave de localStorage donde se persiste { x, y }. */
  storageKey: string;
  /** Se llama cuando el usuario hace click/tap real (no arrastre) o activa por teclado. */
  onActivate: () => void;
  /** Tamaño del botón en px (ancho = alto, es circular). */
  size?: number;
  /** Margen mínimo respecto a los bordes del viewport, en px. */
  margin?: number;
  /** Al soltar, anima hacia el borde lateral más cercano en vez de dejarlo libre. */
  snapToEdge?: boolean;
  /** Desplazamiento mínimo (px) para considerar el gesto un arrastre y no un click. */
  dragThreshold?: number;
}

const DEFAULT_SIZE = 64;
const DEFAULT_MARGIN = 8;
const DEFAULT_THRESHOLD = 6;
const SNAP_TRANSITION_MS = 150;
// Posición default: esquina inferior derecha, igual al bottom-6 right-6 (24px) original.
const DEFAULT_EDGE_OFFSET = 24;

const getDefaultPosition = (size: number): FabPosition => ({
  x: window.innerWidth - size - DEFAULT_EDGE_OFFSET,
  y: window.innerHeight - size - DEFAULT_EDGE_OFFSET,
});

const clampPosition = (pos: FabPosition, size: number, margin: number): FabPosition => {
  const maxX = Math.max(margin, window.innerWidth - size - margin);
  const maxY = Math.max(margin, window.innerHeight - size - margin);
  return {
    x: Math.min(Math.max(pos.x, margin), maxX),
    y: Math.min(Math.max(pos.y, margin), maxY),
  };
};

const readStoredPosition = (storageKey: string, size: number, margin: number): FabPosition => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return getDefaultPosition(size);

    const parsed = JSON.parse(raw);
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') {
      return getDefaultPosition(size);
    }
    return clampPosition(parsed, size, margin);
  } catch (error) {
    logger.error('No se pudo leer la posición guardada, usando default:', error);
    return getDefaultPosition(size);
  }
};

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

/**
 * Hace arrastrable un elemento fixed (pensado para un FAB) con pointer events
 * nativos, sin librerías de drag. Persiste la posición en localStorage y la
 * re-clampea contra el viewport en cada resize/rotación.
 */
export function useDraggableFab({
  storageKey,
  onActivate,
  size = DEFAULT_SIZE,
  margin = DEFAULT_MARGIN,
  snapToEdge = true,
  dragThreshold = DEFAULT_THRESHOLD,
}: UseDraggableFabOptions) {
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const elementRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const wasDragRef = useRef(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Posición inicial: localStorage clampeado al viewport actual, o default.
  // Solo al montar: storageKey/size/margin no deberían cambiar en caliente.
  useEffect(() => {
    setPosition(readStoredPosition(storageKey, size, margin));
  }, []);

  // Re-clampear en resize/rotación para que nunca quede fuera de pantalla.
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev, size, margin) : prev));
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [size, margin]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  const persist = useCallback((pos: FabPosition) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch (error) {
      logger.error('No se pudo guardar la posición:', error);
    }
  }, [storageKey]);

  const endDrag = useCallback((pointerId: number) => {
    const el = elementRef.current;
    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }

    const state = dragStateRef.current;
    dragStateRef.current = null;
    setIsDragging(false);

    if (!state) return;
    wasDragRef.current = state.moved;

    if (!state.moved) return;

    setPosition((prev) => {
      if (!prev) return prev;
      let next = clampPosition(prev, size, margin);

      if (snapToEdge) {
        const centerX = next.x + size / 2;
        const snappedX = centerX < window.innerWidth / 2
          ? margin
          : window.innerWidth - size - margin;
        next = { x: snappedX, y: next.y };

        setIsAnimating(true);
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), SNAP_TRANSITION_MS);
      }

      persist(next);
      return next;
    });
  }, [size, margin, snapToEdge, persist]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    if (e.button !== 0) return; // solo botón/tap primario

    elementRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - position.x,
      offsetY: e.clientY - position.y,
      moved: false,
    };
    setIsAnimating(false);
    setIsDragging(true);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) >= dragThreshold) {
      state.moved = true;
    }
    if (!state.moved) return;

    const next = clampPosition(
      { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY },
      size,
      margin
    );
    setPosition(next);
  }, [size, margin, dragThreshold]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStateRef.current?.pointerId !== e.pointerId) return;
    endDrag(e.pointerId);
  }, [endDrag]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStateRef.current?.pointerId !== e.pointerId) return;
    // Gesto cancelado por el sistema (p. ej. scroll): no lo tratamos como click.
    dragStateRef.current.moved = true;
    endDrag(e.pointerId);
  }, [endDrag]);

  // El navegador dispara "click" nativo después de pointerup incluso tras un
  // arrastre; lo suprimimos acá para que arrastrar nunca abra el menú.
  const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (wasDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      wasDragRef.current = false;
      return;
    }
    onActivate();
  }, [onActivate]);

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: isAnimating ? `transform ${SNAP_TRANSITION_MS}ms ease-out` : 'none',
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }
    : {
        // Antes de leer localStorage: misma posición default visual (bottom-6 right-6)
        // para no generar un salto visible una vez que el hook aplica la posición real.
        position: 'fixed',
        bottom: DEFAULT_EDGE_OFFSET,
        right: DEFAULT_EDGE_OFFSET,
        touchAction: 'none',
        cursor: 'grab',
      };

  return {
    position,
    isDragging,
    style,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
    },
  };
}
