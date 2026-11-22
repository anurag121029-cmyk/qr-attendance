import { describe, it, expect } from "vitest";
import { GEOFENCE_RADIUS_M, haversineMeters, withinRadius } from "../lib/geo";

// Classroom: J.C. Bose University, Faridabad (approx).
const LAT = 28.367;
const LNG = 77.315;

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMeters(LAT, LNG, LAT, LNG)).toBeLessThan(0.01);
  });
  it("is about 111 m for 0.001 degrees of latitude", () => {
    const d = haversineMeters(LAT, LNG, LAT + 0.001, LNG);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
  it("is symmetric", () => {
    expect(haversineMeters(LAT, LNG, LAT + 0.001, LNG)).toBe(
      haversineMeters(LAT + 0.001, LNG, LAT, LNG),
    );
  });
});

describe("withinRadius", () => {
  it("uses the 100 m geofence", () => {
    expect(GEOFENCE_RADIUS_M).toBe(100);
    expect(withinRadius(LAT, LNG, LAT + 0.0005, LNG, GEOFENCE_RADIUS_M).within).toBe(true);
    expect(withinRadius(LAT, LNG, LAT + 0.001, LNG, GEOFENCE_RADIUS_M).within).toBe(false);
  });
  it("reports the distance honestly", () => {
    const r = withinRadius(LAT, LNG, LAT + 0.001, LNG, GEOFENCE_RADIUS_M);
    expect(r.distanceMeters).toBeGreaterThan(100);
    expect(r.distanceMeters).toBeLessThan(125);
  });
});
