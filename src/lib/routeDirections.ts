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
    'maps-proxy',
    {
      body: {
        action: 'route',
        // originCoords/destinationCoords are [lng, lat]; maps-proxy expects { lat, lng }
        origin: { lat: originCoords[1], lng: originCoords[0] },
        destination: { lat: destinationCoords[1], lng: destinationCoords[0] },
      },
    },
  );

  if (
    routeError ||
    typeof routeData?.distance_km !== 'number' ||
    !routeData?.geometry?.coordinates?.length
  ) {
    throw new Error('No se pudo calcular la ruta. Verifique las ubicaciones.');
  }

  return routeData as RouteDirectionsResult;
}
