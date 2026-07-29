import { describe, expect, it } from 'vitest';
import {
  connectRouteAccess,
  decodeGooglePolyline,
  encodeGooglePolyline,
  findDepartureRoutingAccess,
  findTargetRoutingAccess,
  type RoutingAccessLocation,
} from '../../../supabase/functions/_shared/routingAccess';

const locations: RoutingAccessLocation[] = [
  {
    name: 'Grúas 5 Norte',
    aliases: ['Custodia G5N', 'Instalaciones G5N'],
    latitude: -27.3464396,
    longitude: -70.6313583,
    routing_access_latitude: -27.34747,
    routing_access_longitude: -70.63322,
  },
  {
    name: 'Sin acceso especial',
    aliases: [],
    latitude: -27.36,
    longitude: -70.35,
    routing_access_latitude: null,
    routing_access_longitude: null,
  },
];

describe('accesos viales configurables', () => {
  it('usa el acceso de salida al detectar el GPS cerca del pin real', () => {
    expect(
      findDepartureRoutingAccess(locations, {
        lat: -27.34622,
        lng: -70.63133,
      }),
    ).toEqual({
      lat: -27.34747,
      lng: -70.63322,
      locationName: 'Grúas 5 Norte',
    });
  });

  it('no aplica un acceso por nombre de folio ni lejos del lugar', () => {
    expect(
      findDepartureRoutingAccess(locations, {
        lat: -27.5,
        lng: -70.5,
      }),
    ).toBeNull();
  });

  it('resuelve llegada por nombre o alias y protege snapshots alejados', () => {
    expect(
      findTargetRoutingAccess(locations, {
        label: 'Custodia G5N',
        lat: -27.3464396,
        lng: -70.6313583,
      }),
    ).toEqual({
      lat: -27.34747,
      lng: -70.63322,
      locationName: 'Grúas 5 Norte',
    });

    expect(
      findTargetRoutingAccess(locations, {
        label: 'Custodia G5N',
        lat: -26.8,
        lng: -69.2,
      }),
    ).toBeNull();
  });
});

describe('geometría con acceso vial', () => {
  it('conserva el pin real en ambos extremos y añade los conectores', () => {
    const route = [
      [-70.63322, -27.34747],
      [-70.62, -27.35],
      [-70.35, -27.36],
    ] as [number, number][];
    const encoded = encodeGooglePolyline(route);

    const connected = connectRouteAccess({
      encodedPolyline: encoded,
      actualOrigin: { lat: -27.34622, lng: -70.63133 },
      routedOrigin: { lat: -27.34747, lng: -70.63322 },
      routedDestination: { lat: -27.36, lng: -70.35 },
      actualDestination: { lat: -27.35994, lng: -70.34946 },
    });
    const decoded = decodeGooglePolyline(connected.polyline);

    expect(decoded[0]).toEqual([-70.63133, -27.34622]);
    expect(decoded).toContainEqual([-70.63322, -27.34747]);
    expect(decoded.at(-1)).toEqual([-70.34946, -27.35994]);
    expect(connected.connectorDistanceMeters).toBeGreaterThan(200);
    expect(connected.connectorDistanceMeters).toBeLessThan(400);
  });

  it('codifica y decodifica una ruta sin invertir latitud y longitud', () => {
    const route = [
      [-70.63133, -27.34622],
      [-70.34946, -27.35994],
    ] as [number, number][];

    expect(decodeGooglePolyline(encodeGooglePolyline(route))).toEqual(route);
  });
});
