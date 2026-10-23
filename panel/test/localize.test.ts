import { afterEach, describe, expect, it } from "vitest";

import { formatEnergy, formatNumber, formatPower, hasKey, LANGUAGES, localize } from "../src/localize";
import { de } from "../src/translations/de";
import { en } from "../src/translations/en";
import type { HomeAssistant } from "../src/types";

function hass(language: string, number_format?: string): HomeAssistant {
  return {
    locale: { language, number_format },
    states: {},
    callWS: async () => undefined as never,
  };
}

afterEach(() => {
  document.documentElement.lang = "";
});

describe("localize", () => {
  it("uses the user's language with fallbacks", () => {
    expect(localize(hass("de"), "home")).toBe("Zuhause");
    expect(localize(hass("de-CH"), "home")).toBe("Zuhause");
    expect(localize(hass("en"), "home")).toBe("Home");
    expect(localize(hass("xx"), "home")).toBe("Home");
    expect(localize(hass("fr-CH"), "home")).toBe("Maison");
    expect(localize(hass("it"), "home")).toBe("Casa");
  });

  it("falls back to the page language", () => {
    document.documentElement.lang = "de";
    expect(localize(undefined, "home")).toBe("Zuhause");
  });

  it("replaces placeholders and keeps unknown ones", () => {
    expect(localize(hass("en"), "move_title", { name: "TV" })).toBe("Move TV to …");
    expect(localize(hass("en"), "move_title")).toBe("Move {name} to …");
  });

  it("knows its keys", () => {
    expect(hasKey("issue_cycle")).toBe(true);
    expect(hasKey("issue_unknown")).toBe(false);
  });

  it("has the same keys and placeholders in every language", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const translations of Object.values(LANGUAGES)) {
      expect(Object.keys(translations).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(translations[key]), key).toEqual(placeholders(en[key]));
      }
    }
    expect(de.title).toBe(en.title);
  });
});

describe("formatting", () => {
  it("follows the number format of the profile", () => {
    // The apostrophe depends on the ICU version, so compare with Intl itself.
    expect(formatNumber(hass("de", "quote_decimal"), 1240)).toBe(
      new Intl.NumberFormat("de-CH").format(1240),
    );
    expect(formatNumber(hass("en", "none"), 1240)).toBe("1240");
    expect(formatNumber(hass("en"), 1.234, 2)).toBe("1.23");
    expect(formatNumber(hass("en", "comma_decimal"), 1240)).toBe("1,240");
  });

  it("formats energy in Wh and kWh", () => {
    expect(formatEnergy(hass("en"), 0.4204)).toBe("420 Wh");
    expect(formatEnergy(hass("en"), 12.345)).toBe("12.35 kWh");
    expect(formatEnergy(hass("en"), 1234.5)).toBe("1,235 kWh");
    expect(formatEnergy(hass("en"), -1.5)).toBe("-1.5 kWh");
  });

  it("formats power in W and kW", () => {
    expect(formatPower(hass("en"), 42.4)).toBe("42 W");
    expect(formatPower(hass("en"), 1234)).toBe("1.23 kW");
    expect(formatPower(hass("en"), -1500)).toBe("-1.5 kW");
  });
});
