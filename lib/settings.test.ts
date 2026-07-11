import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getEffectiveDimLevel,
  isScheduleActive,
  isSitePaused,
} from "./settings";

describe("isScheduleActive", () => {
  it("supports schedules that cross midnight", () => {
    const schedule = { scheduleEnabled: true, scheduleStart: 20, scheduleEnd: 6 };
    expect(isScheduleActive(schedule, 22)).toBe(true);
    expect(isScheduleActive(schedule, 4)).toBe(true);
    expect(isScheduleActive(schedule, 12)).toBe(false);
  });

  it("supports daytime schedules and disabled schedules", () => {
    expect(
      isScheduleActive(
        { scheduleEnabled: true, scheduleStart: 8, scheduleEnd: 17 },
        12,
      ),
    ).toBe(true);
    expect(
      isScheduleActive(
        { scheduleEnabled: false, scheduleStart: 8, scheduleEnd: 17 },
        12,
      ),
    ).toBe(false);
  });
});

describe("effective settings", () => {
  it("adds a capped night boost without changing the saved strength", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      dimLevel: 0.85,
      scheduleEnabled: true,
      scheduleStart: 0,
      scheduleEnd: 0,
    };
    expect(getEffectiveDimLevel(settings)).toBe(0.9);
    expect(settings.dimLevel).toBe(0.85);
  });

  it("pauses only sites explicitly marked as paused", () => {
    const settings = { siteRules: { "example.com": "paused" as const } };
    expect(isSitePaused(settings, "example.com")).toBe(true);
    expect(isSitePaused(settings, "video.example.com")).toBe(false);
  });
});
