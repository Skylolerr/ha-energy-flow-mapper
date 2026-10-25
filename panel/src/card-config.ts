// Configuration of the dashboard card. Shared by the loader (which checks it
// at once, so Home Assistant can show a wrong configuration) and the card.

import type { DeviceKind, Period } from "./types";

export const CARD_TAG = "energy-flow-mapper-card";
export const CARD_VIEW_TAG = "energy-flow-mapper-card-view";
export const CARD_EDITOR_TAG = "energy-flow-mapper-card-editor";

export const CARD_KINDS: readonly DeviceKind[] = ["electricity", "water"];
export const CARD_PERIODS: readonly Period[] = ["now", "today", "week", "month"];

export interface CardConfig {
  type: string;
  /** Header; empty hides it, unset uses the name of the diagram. */
  title?: string;
  kind: DeviceKind;
  period: Period;
  /** Show only this device and everything below it. */
  root?: string;
  show_sources: boolean;
  show_untracked: boolean;
}

/** Check a configuration and fill in the defaults; throws for invalid values. */
export function cardConfig(config: unknown): CardConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("Invalid configuration");
  }
  const raw = config as Record<string, unknown>;
  const kind = raw.kind ?? "electricity";
  const period = raw.period ?? "today";
  if (!CARD_KINDS.includes(kind as DeviceKind)) {
    throw new Error(`kind must be one of: ${CARD_KINDS.join(", ")}`);
  }
  if (!CARD_PERIODS.includes(period as Period)) {
    throw new Error(`period must be one of: ${CARD_PERIODS.join(", ")}`);
  }
  for (const key of ["title", "root"]) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      throw new Error(`${key} must be text`);
    }
  }
  return {
    ...(raw as Partial<CardConfig>),
    type: String(raw.type ?? `custom:${CARD_TAG}`),
    kind: kind as DeviceKind,
    period: period as Period,
    show_sources: raw.show_sources !== false,
    show_untracked: raw.show_untracked !== false,
  };
}
