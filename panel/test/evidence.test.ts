import { describe, expect, it } from "vitest";

import { evidenceText, formatDayTime } from "../src/evidence";
import type { HomeAssistant, StatsEvidence } from "../src/types";

function hass(language: string, time_zone?: string): HomeAssistant {
  return {
    locale: { language },
    states: {},
    config: time_zone ? { time_zone } : {},
    callWS: async () => undefined as never,
  };
}

function evidence(extra: Partial<StatsEvidence>): StatsEvidence {
  return { periodic: true, certain: false, reason: "drops", drops: [], went_negative: false, series: [], ...extra };
}

describe("evidence", () => {
  it("names the latest fall in Home Assistant's time zone", () => {
    const found = evidence({
      drops: [
        { at: "2026-11-21T23:00:00+00:00", before: 1, after: 0 },
        { at: "2026-11-22T05:00:00+00:00", before: 2.1, after: 0 },
      ],
    });
    expect(evidenceText(hass("de", "Europe/Zurich"), found, "kWh")).toBe("fiel am 22.11. um 06:00 von 2,1 kWh auf 0 kWh");
    // Without a unit only the numbers.
    expect(evidenceText(hass("de", "Europe/Zurich"), found, null)).toBe("fiel am 22.11. um 06:00 von 2,1 auf 0");
  });

  it("says why a certain signal is certain", () => {
    expect(evidenceText(hass("en"), evidence({ reason: "utility_meter", certain: true }), "kWh")).toBe(
      "a utility meter helper that resets in a cycle",
    );
    expect(evidenceText(hass("en"), evidence({ reason: "last_reset", certain: true }), "kWh")).toBe(
      "its start time (last_reset) changes",
    );
    // No fall to name: the statistics in general.
    expect(evidenceText(hass("en"), evidence({ reason: null }), "kWh")).toBe("its statistics show it starting again at 0");
  });

  it("falls back to the browser's time zone for an unknown one", () => {
    const { date, time } = formatDayTime(hass("en", "Not/AZone"), "2026-11-22T05:00:00+00:00");
    expect(date).toMatch(/11\/2[12]/);
    expect(time).toMatch(/\d\d:00/);
  });
});
