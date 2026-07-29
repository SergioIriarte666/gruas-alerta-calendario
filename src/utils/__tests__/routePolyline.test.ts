import { describe, expect, it } from 'vitest';
import { trimRouteFromPosition } from '@/utils/routePolyline';

describe('trimRouteFromPosition', () => {
  it('removes the already-travelled route behind the current position', () => {
    const route: [number, number][] = [
      [-70.64, -27.346],
      [-70.63, -27.346],
      [-70.62, -27.346],
      [-70.61, -27.346],
    ];

    const trimmed = trimRouteFromPosition(route, [-70.625, -27.346]);

    expect(trimmed[0]).toEqual([-70.625, -27.346]);
    expect(trimmed).not.toContainEqual([-70.64, -27.346]);
    expect(trimmed).not.toContainEqual([-70.63, -27.346]);
    expect(trimmed.at(-1)).toEqual([-70.61, -27.346]);
  });

  it('keeps the original route when the GPS point is unrelated to it', () => {
    const route: [number, number][] = [
      [-70.64, -27.346],
      [-70.63, -27.346],
    ];

    expect(trimRouteFromPosition(route, [-70.3, -27.5])).toBe(route);
  });

  it('does not modify a route without a usable position', () => {
    const route: [number, number][] = [[-70.64, -27.346]];
    expect(trimRouteFromPosition(route, null)).toBe(route);
  });
});
