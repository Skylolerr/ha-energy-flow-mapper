import { formatNumber, localize } from "./localize";
import type { HomeAssistant, StatsEvidence } from "./types";

/** The user's language for dates, as `localize` picks it. */
function language(hass: HomeAssistant | undefined): string {
  return hass?.locale.language || (typeof document === "undefined" ? "" : document.documentElement.lang) || "en";
}

/** Day and time of an ISO timestamp («22.11.», «06:00»), in Home Assistant's time zone if known. */
export function formatDayTime(hass: HomeAssistant | undefined, iso: string): { date: string; time: string } {
  const when = new Date(iso);
  const zone = hass?.config?.time_zone;
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(language(hass), { ...options, ...(zone ? { timeZone: zone } : {}) }).format(when);
    } catch {
      // An unknown time zone: the browser's own.
      return new Intl.DateTimeFormat(language(hass), options).format(when);
    }
  };
  return {
    date: format({ day: "numeric", month: "numeric" }),
    time: format({ hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * A local day as the backend gives it («2026-11-22» → «22.11.»). It is
 * already a day of Home Assistant's time zone, so it is shown as it is:
 * as an instant it would move back a day west of UTC.
 */
export function formatDay(hass: HomeAssistant | undefined, day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) {
    return day;
  }
  const noon = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat(language(hass), { day: "numeric", month: "numeric", timeZone: "UTC" }).format(noon);
}

/**
 * One sentence of evidence why a meter counts as periodic: a utility meter
 * with a cycle, a changing `last_reset`, or the latest fall to 0 with its
 * values (in `unit`, the statistic's unit).
 */
export function evidenceText(hass: HomeAssistant | undefined, evidence: StatsEvidence, unit: string | null): string {
  if (evidence.reason === "utility_meter") {
    return localize(hass, "evidence_utility_meter");
  }
  if (evidence.reason === "last_reset") {
    return localize(hass, "evidence_last_reset");
  }
  const drop = evidence.drops.at(-1);
  if (drop === undefined) {
    return localize(hass, "evidence_statistics");
  }
  const value = (v: number) => (unit ? `${formatNumber(hass, v, 2)} ${unit}` : formatNumber(hass, v, 2));
  return localize(hass, "evidence_drop", {
    ...formatDayTime(hass, drop.at),
    before: value(drop.before),
    after: value(drop.after),
  });
}

/**
 * One sentence of what the statistics of an energy input show: why it counts
 * as periodic, its latest fall, that it rose without starting again at 0, or
 * that there are no statistics.
 */
export function inputEvidenceText(hass: HomeAssistant | undefined, evidence: StatsEvidence, unit: string | null): string {
  if (evidence.certain || evidence.periodic || evidence.drops.length) {
    return evidenceText(hass, evidence, unit);
  }
  return localize(hass, evidence.periodic === false ? "evidence_lifetime" : "evidence_no_data");
}
