import { describe, it, expect } from "vitest";
import { withinAvailability } from "./appointments.service";

describe("withinAvailability", () => {
  it("returns true when no availability is configured (nothing to check against)", () => {
    expect(withinAvailability(null, new Date("2026-01-05T10:00:00"))).toBe(true); // a Monday
  });

  it("returns true for a time inside a configured window", () => {
    const availability = { mon: [{ start: "09:00", end: "13:00" }] };
    expect(withinAvailability(availability, new Date("2026-01-05T10:00:00"))).toBe(true);
  });

  it("returns false for a time outside every window on that day", () => {
    const availability = { mon: [{ start: "09:00", end: "13:00" }] };
    expect(withinAvailability(availability, new Date("2026-01-05T15:00:00"))).toBe(false);
  });

  it("returns false when the weekday has no windows at all", () => {
    const availability = { mon: [{ start: "09:00", end: "13:00" }] };
    expect(withinAvailability(availability, new Date("2026-01-06T10:00:00"))).toBe(false); // a Tuesday
  });
});