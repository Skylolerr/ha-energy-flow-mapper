import { de } from "./translations/de";
import { en } from "./translations/en";
import { fr } from "./translations/fr";
import { it } from "./translations/it";
import type { HomeAssistant, WSError } from "./types";

export type StringKey = keyof typeof en;
export type Translations = Record<StringKey, string>;

export const LANGUAGES: Record<string, Translations> = { de, en, fr, it };

/** The user's language: from Home Assistant, else from the page. */
function language(hass: HomeAssistant | undefined): string {
  return (
    hass?.locale.language ||
    (typeof document === "undefined" ? "" : document.documentElement.lang) ||
    "en"
  );
}

/** Translations for a language tag ("de-CH" falls back to "de", then English). */
function translations(tag: string): Translations {
  return LANGUAGES[tag] ?? LANGUAGES[tag.split("-")[0]] ?? en;
}

export function localize(
  hass: HomeAssistant | undefined,
  key: StringKey,
  placeholders: Record<string, string> = {},
): string {
  return translations(language(hass))[key].replace(
    /\{(\w+)\}/g,
    (match, name: string) => (name in placeholders ? placeholders[name] : match),
  );
}

/** Whether a translation exists for a key built at runtime. */
export function hasKey(key: string): key is StringKey {
  return key in en;
}

/** Locales for the number formats of the user profile (as the HA frontend does). */
const NUMBER_FORMAT_LOCALES: Record<string, string[] | undefined> = {
  comma_decimal: ["en-US", "en"],
  decimal_comma: ["de", "es", "it"],
  quote_decimal: ["de-CH"],
  space_comma: ["fr", "sv", "cs"],
  system: undefined,
};

/** Format a number following the number format of the user's HA profile. */
export function formatNumber(
  hass: HomeAssistant | undefined,
  value: number,
  maximumFractionDigits = 0,
): string {
  const numberFormat = hass?.locale.number_format ?? "language";
  const locales =
    numberFormat in NUMBER_FORMAT_LOCALES
      ? NUMBER_FORMAT_LOCALES[numberFormat]
      : numberFormat === "none"
        ? ["en-US"]
        : [language(hass)];
  try {
    return new Intl.NumberFormat(locales, {
      useGrouping: numberFormat !== "none",
      maximumFractionDigits,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Format a power in W, switching to kW from 1000 W. */
export function formatPower(hass: HomeAssistant | undefined, watts: number): string {
  return Math.abs(watts) >= 1000
    ? `${formatNumber(hass, watts / 1000, 2)} kW`
    : `${formatNumber(hass, watts)} W`;
}

/** Format energy in kWh, switching to Wh below 1 kWh. */
export function formatEnergy(hass: HomeAssistant | undefined, kwh: number): string {
  const abs = Math.abs(kwh);
  if (abs < 1) {
    return `${formatNumber(hass, kwh * 1000)} Wh`;
  }
  // About three significant digits: 1.23, 12.3, 123 kWh.
  return `${formatNumber(hass, kwh, abs < 10 ? 2 : abs < 100 ? 1 : 0)} kWh`;
}

/** Format water given in `unit` ("L" or "gal"); litres switch to m³ from 1000 L. */
export function formatVolume(hass: HomeAssistant | undefined, value: number, unit: string): string {
  if (unit === "L" && Math.abs(value) >= 1000) {
    return `${formatNumber(hass, value / 1000, significant(value / 1000))} m³`;
  }
  return `${formatNumber(hass, value, significant(value))} ${unit}`;
}

/** Format a flow given in L/min, as gal/min when water is shown in gallons. */
export function formatFlow(hass: HomeAssistant | undefined, litresPerMinute: number, unit: string): string {
  const value = unit === "gal" ? litresPerMinute / 3.785411784 : litresPerMinute;
  return `${formatNumber(hass, value, significant(value))} ${unit}/min`;
}

/** Decimals for about three significant digits: 1.23, 12.3, 123. */
function significant(value: number): number {
  const abs = Math.abs(value);
  return abs < 10 ? 2 : abs < 100 ? 1 : 0;
}

/** Format an ISO timestamp as local date and time. */
export function formatDateTime(hass: HomeAssistant | undefined, iso: string): string {
  try {
    return new Intl.DateTimeFormat(language(hass), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** The error message of a failed WebSocket call, translated if possible. */
export function errorText(hass: HomeAssistant | undefined, err: unknown): string {
  const error = (err ?? {}) as WSError;
  const key = `error_${error.translation_key ?? ""}`;
  if (error.translation_key && hasKey(key)) {
    const placeholders = Object.fromEntries(
      Object.entries(error.translation_placeholders ?? {}).map(([k, v]) => [k, String(v)]),
    );
    return localize(hass, key, placeholders);
  }
  return localize(hass, "error_unknown", { message: error.message ?? String(err) });
}
