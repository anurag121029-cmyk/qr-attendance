/** Haversine distance — pure, unit-tested. */
const EARTH_RADIUS_M = 6371000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function withinRadius(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radiusMeters: number,
): { within: boolean; distanceMeters: number } {
  const distanceMeters = haversineMeters(lat1, lng1, lat2, lng2);
  return { within: distanceMeters <= radiusMeters, distanceMeters };
}

export const GEOFENCE_RADIUS_M = 100;
