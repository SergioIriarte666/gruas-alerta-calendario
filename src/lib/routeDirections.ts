import { supabase } from '@/integrations/supabase/client';

export interface RouteGeometry {
  type: string;
  coordinates: [number, number][];
}

export interface RouteDirectionsResult {
  distance_km: number;
  estimated_time_hours: number;
  geometry: RouteGeometry;
}

export async function fetchRouteDirections(
  originCoords: [number, number],
  destinationCoords: [number, number],
): Promise<RouteDirectionsResult> {
  const { data: routeData, error: routeError } = await supabase.functions.invoke(
    'mapbox-proxy',
    {
      body: {
        action: 'directions',
        origin: originCoords,
        destination: destinationCoords,
      },
    },
  );

  if (routeError || !routeData?.distance_km || !routeData?.geometry?.coordinates?.length) {
    throw new Error('No se pudo calcular la ruta. Verifique las ubicaciones.');
  }

  return routeData as RouteDirectionsResult;
}
