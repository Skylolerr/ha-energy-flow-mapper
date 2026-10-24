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
  /** The entity belongs to a helper created by Energy Flow Mapper. */
  created_helper?: boolean;
}

/** An energy meter that is not used yet; `power` is a suggested stat_rate. */
export interface Candidate extends StatInfo {
  power: string | null;
  /** An external statistic (no entity), e.g. from an energy supplier portal. */
  external?: boolean;
}

export type IssueCode =
  | "cycle"
  | "self_parent"
  | "duplicate"
  | "missing_parent"
  | "source_and_device"
  | "duplicate_source"
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
  /** Power sensors without an energy meter. */
  power_candidates: StatInfo[];
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
  | { type: "remove"; stat: string }
  | {
      type: "assign_source";
      role: AssignRole;
      stat: string;
      stat_to?: string;
      /** Grid meter to replace; without it, the first grid connection is used. */
      replace?: string | null;
    }
  | { type: "unassign_source"; stat: string };

/** Source roles a free sensor can be assigned to. */
export type AssignRole = "import" | "export" | "production" | "battery";

export interface DiffEntry {
  type: "added" | "removed" | "moved" | "renamed" | "rate" | "source_added" | "source_removed";
  stat: string;
  role?: string;
  parent?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ValidateResult {
  valid: boolean;
  issues: Issue[];
  /** Home Assistant's own (English) message when its schemas reject the draft. */
  rejected?: string | null;
  diff: DiffEntry[];
}

export interface SaveResult {
  hash: string;
  backup_id: string | null;
}

/** File written by `energy_flow_mapper/export`; only `data` is imported. */
export interface ExportDocument {
  format: string;
  version: number;
  exported: string;
  source: "current" | "backup";
  backup?: { id: string; created: string; user_name: string | null; summary: Record<string, number> };
  data: Record<string, unknown[]>;
}

/** Answer of `energy_flow_mapper/import_check`. */
export interface ImportCheckResult extends ValidateResult {
  /** False when the file holds the current settings already. */
  changed: boolean;
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
  translation_placeholders?: Record<string, unknown> | null;
}

/** "now" shows live power; the others energy in a period. */
export type Period = "now" | "today" | "week" | "month";

/** Result of `energy_flow_mapper/energy`; values in kWh. */
export interface EnergyResult {
  period: Exclude<Period, "now">;
  start: string;
  end: string;
  energy: Record<string, number | null>;
  untracked: Record<string, number | null>;
  issues: Issue[];
}
