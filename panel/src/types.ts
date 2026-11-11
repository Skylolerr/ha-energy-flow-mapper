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
  /** Unit system of the instance; `volume` is "L" or "gal". */
  config?: { unit_system?: { volume?: string } };
  callWS<T>(msg: { type: string; [key: string]: unknown }): Promise<T>;
  /** Home Assistant's own translations (for its energy check messages). */
  localize?(key: string, values?: Record<string, unknown>): string;
  loadBackendTranslation?(category: string, integration?: string): Promise<unknown>;
}

/** The device lists of the energy dashboard, one tab each. */
export type DeviceKind = "electricity" | "water";

/** The tabs: the device lists, and gas, which has only sources (HA has no gas devices). */
export type Tab = DeviceKind | "gas";

/** An entry of `device_consumption(_water)`; unknown fields are kept as they are. */
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

/** A purely visual group of devices below one real parent (mirrors groups.py). */
export interface Group {
  /** uuid4 hex, made by the panel. */
  id: string;
  name: string;
  /** Real parent statistic; null = Home. */
  parent: string | null;
  /** Enclosing group id; null = top level of its parent. */
  group: string | null;
  /** Device statistics directly in this group. */
  members: string[];
}

/** The groups of each device list. */
export type Groups = Partial<Record<DeviceKind, Group[]>>;

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
  /** Name of an individual device as Home Assistant's energy dashboard shows it. */
  energy_name?: string | null;
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

/** A meter that is not used yet; `power` is a suggested stat_rate (power or flow). */
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
  | "not_water_unit"
  | "children_exceed_parent"
  | "devices_exceed_home";

export interface Issue {
  code: IssueCode;
  severity: "error" | "warning";
  stat: string;
  details: Record<string, unknown>;
  /** The tab the issue belongs to. */
  kind?: Tab;
}

/** A message of Home Assistant's own energy check, attached to a block. */
export interface HaIssue {
  stat: string;
  kind: Tab;
  type: string;
  placeholders: Record<string, string> | null;
  /** Affected entities with HA's detail (state, unit, ...). */
  entities: [string, unknown][];
}

/** "`stat` is included in `parent`", from Home Assistant's child devices. */
export interface ChildPair {
  kind: DeviceKind;
  stat: string;
  parent: string;
}

export interface Snapshot {
  prefs: Prefs;
  hash: string;
  stats: Record<string, StatInfo>;
  candidates: Candidate[];
  /** Water meters that are not used yet. */
  water_candidates: Candidate[];
  /** Gas meters that are not used yet. */
  gas_candidates?: Candidate[];
  /** Power sensors without an energy meter. */
  power_candidates: StatInfo[];
  /** Flow sensors without a water meter. */
  flow_candidates?: StatInfo[];
  issues: Issue[];
  /** Whether Home Assistant knows the home meter (2026.11 and newer). */
  home_supported?: boolean;
  /** Home Assistant's own check of the saved energy settings. */
  ha_issues?: HaIssue[];
  /** Child device suggestions and the ignored ones. */
  child_pairs?: ChildPair[];
  ignored_suggestions?: ChildPair[];
  /** The groups of devices (display only, not part of the energy settings). */
  groups?: Groups;
}

/** Device changes name their list; without `kind` they change electricity. */
export type Change =
  | {
      type: "add";
      stat: string;
      parent?: string | null;
      name?: string | null;
      stat_rate?: string | null;
      kind?: DeviceKind;
    }
  | { type: "move"; stat: string; parent: string | null; kind?: DeviceKind }
  | { type: "rename"; stat: string; name: string | null; kind?: DeviceKind }
  | { type: "remove"; stat: string; kind?: DeviceKind }
  | {
      type: "assign_source";
      role: AssignRole;
      stat: string;
      stat_to?: string;
      /** Grid, water or gas meter to replace; without it, the first grid
       * connection is used, and a water or gas meter is added. */
      replace?: string | null;
    }
  | { type: "unassign_source"; stat: string }
  /** Turn an electricity device into the home meter (HA 2026.11 and newer). */
  | { type: "use_as_home_meter"; stat: string }
  | {
      type: "create_group";
      id: string;
      name: string;
      parent: string | null;
      /** Enclosing group; without it the group is at the top level of its parent. */
      group?: string | null;
      members: string[];
      /** Existing groups that move into the new one. */
      groups: string[];
      kind?: DeviceKind;
    }
  | { type: "rename_group"; id: string; name: string; kind?: DeviceKind }
  /** Put a device (`stat`) or a group (`group_id`) into a group, or out of it (null). */
  | { type: "set_group"; stat?: string; group_id?: string; group: string | null; kind?: DeviceKind }
  | { type: "dissolve_group"; id: string; kind?: DeviceKind }
  | { type: "move_group"; id: string; parent: string | null; group?: string | null; kind?: DeviceKind };

/** Source roles a free sensor can be assigned to. */
export type AssignRole = "import" | "export" | "production" | "battery" | "water" | "gas" | "home";

export interface DiffEntry {
  type:
    | "added"
    | "removed"
    | "moved"
    | "renamed"
    | "rate"
    | "source_added"
    | "source_removed"
    | "group_created"
    | "group_renamed"
    | "group_dissolved"
    | "group_changed";
  stat: string;
  /** Group entries: the group id, its name and the number of devices in it. */
  id?: string;
  name?: string;
  count?: number;
  role?: string;
  parent?: string | null;
  from?: string | null;
  to?: string | null;
  /** The device list of a device entry. */
  kind?: DeviceKind;
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

/** How the diagram runs: top-down (horizontal) or left to right (vertical). */
export type Orientation = "horizontal" | "vertical";

/** Result of `energy_flow_mapper/energy`; values in kWh, water in `water_unit`. */
export interface EnergyResult {
  period: Exclude<Period, "now">;
  start: string;
  end: string;
  energy: Record<string, number | null>;
  /** "L" or "gal". */
  water_unit: string;
  /** "m³" or "ft³": gas meters with a volume unit; gas in an energy unit is in kWh. */
  gas_unit?: string;
  untracked: Record<string, number | null>;
  issues: Issue[];
  /** Home consumption of the electricity tree; missing for water. */
  home?: HomeResult;
}

/** What the whole home used in a period, and what no top-level device covers. */
export interface HomeResult {
  value: number | null;
  basis: "measured" | "calculated" | null;
  /** The meter whose data is not recent enough; then there is no value. */
  stale: string | null;
  untracked: number | null;
}
