// Types of the Home Assistant frontend (minimal subset) and of the
// energy_flow_mapper WebSocket API.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    unit_of_measurement?: string;
  };
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: {
    language: string;
    /** Number format of the user profile, e.g. "language" or "quote_decimal". */
    number_format?: string;
  };
  callWS<T>(msg: { type: string; [key: string]: unknown }): Promise<T>;
}

/** An entry of `device_consumption`; unknown fields are kept as they are. */
export interface Device {
  stat_consumption: string;
  stat_rate?: string;
  name?: string;
  included_in_stat?: string;
  [key: string]: unknown;
}

/** An entry of `energy_sources` (only the fields the panel shows). */
export interface Source {
  type: "grid" | "solar" | "battery" | "gas" | "water" | string;
  stat_energy_from?: string | null;
  stat_energy_to?: string | null;
  name?: string;
  [key: string]: unknown;
}

export interface Prefs {
  energy_sources: Source[];
  device_consumption: Device[];
  device_consumption_water: Device[];
}

/** Metadata of a statistic, from `energy_flow_mapper/get`. */
export interface StatInfo {
  stat: string;
  entity_id: string | null;
  name: string | null;
  unit: string | null;
  device_class: string | null;
  device_id: string | null;
  device_name: string | null;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
}

/** An energy meter that is not used yet; `power` is a suggested stat_rate. */
export interface Candidate extends StatInfo {
  power: string | null;
}

export type IssueCode =
  | "cycle"
  | "self_parent"
  | "duplicate"
  | "missing_parent"
  | "source_and_device"
  | "statistic_missing"
  | "not_energy_unit"
  | "children_exceed_parent";

export interface Issue {
  code: IssueCode;
  severity: "error" | "warning";
  stat: string;
  details: Record<string, unknown>;
}

export interface Snapshot {
  prefs: Prefs;
  hash: string;
  stats: Record<string, StatInfo>;
  candidates: Candidate[];
  issues: Issue[];
}

export type Change =
  | {
      type: "add";
      stat: string;
      parent?: string | null;
      name?: string | null;
      stat_rate?: string | null;
    }
  | { type: "move"; stat: string; parent: string | null }
  | { type: "rename"; stat: string; name: string | null }
  | { type: "remove"; stat: string };

export interface DiffEntry {
  type: "added" | "removed" | "moved" | "renamed" | "rate";
  stat: string;
  parent?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ValidateResult {
  valid: boolean;
  issues: Issue[];
  diff: DiffEntry[];
}

export interface SaveResult {
  hash: string;
  backup_id: string | null;
}

export interface BackupEntry {
  id: string;
  created: string;
  user_id: string | null;
  user_name: string | null;
  summary: Record<string, number>;
}

/** Error thrown by `callWS`, with the translation of the integration. */
export interface WSError {
  code?: string;
  message?: string;
  translation_key?: string;
}
