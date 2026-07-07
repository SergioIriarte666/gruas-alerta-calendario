import 'mapbox-gl/dist/mapbox-gl.css';

export type MapboxModule = typeof import('mapbox-gl');

let mapboxPromise: Promise<MapboxModule> | null = null;

export const loadMapbox = (): Promise<MapboxModule> => {
  if (!mapboxPromise) {
    mapboxPromise = import('mapbox-gl');
  }

  return mapboxPromise;
};
