import { css, html, LitElement, nothing, svg, type PropertyValues, type TemplateResult } from "lit";

import {
  applyChanges,
  applySourceChanges,
  buildTree,
  canMove,
  displayName,
  moveTargets,
  rateValue,
  sourceRows,
  type TreeNode,
  untracked,
} from "./draft";
import { icon } from "./icons";
import {
  arrowHead,
  arrowSize,
  type Block,
  dashPattern,
  type Edge,
  edgePath,
  HOME_ID,
  layout,
  PLACEHOLDER_ROLES,
  SOURCE_COLORS,
  strokeWidth,
  WATER_PLACEHOLDER_ROLES,
} from "./layout";
import {
  errorText,
  formatDateTime,
  formatEnergy,
  formatFlow,
  formatNumber,
  formatPower,
  formatVolume,
  hasKey,
  localize,
  type StringKey,
} from "./localize";
import type {
  AssignRole,
  BackupEntry,
  ExportDocument,
  ImportCheckResult,
  Candidate,
  Change,
  Device,
  DeviceKind,
  DiffEntry,
  EnergyResult,
  HomeAssistant,
  Issue,
  Orientation,
  Period,
  SaveResult,
  Snapshot,
  Source,
  StatInfo,
  ValidateResult,
  WSError,
} from "./types";

export { errorText };

export const PANEL_TAG = "energy-flow-mapper-panel";
export const DOMAIN = "energy_flow_mapper";
export const TOAST_MS = 4000;
const HOME = "__home__";
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2.5;
/** Zoom the search uses at least, so the found device is readable. */
export const FIND_ZOOM = 0.9;
/** Minimum scale and lift (px above the finger) of the drag image on touch. */
export const TOUCH_DRAG_SCALE = 0.8;
export const TOUCH_DRAG_LIFT = 48;
/** Where this browser remembers the orientation of the diagram. */
const ORIENTATION_KEY = "energy_flow_mapper.orientation";

interface Zoom {
  x: number;
  y: number;
  k: number;
}

export const TABS: DeviceKind[] = ["electricity", "water"];

type Dragged = { kind: "device" | "candidate"; stat: string };

type Dialog =
  | { kind: "actions"; stat: string }
  | { kind: "move"; stat: string }
  | { kind: "add"; stat: string }
  | { kind: "rename"; stat: string }
  | { kind: "confirm"; result: ValidateResult | null }
  | { kind: "backups"; entries: BackupEntry[] }
  | { kind: "restore"; backup: BackupEntry; undo: boolean }
  | { kind: "import"; file: string; document: unknown; result: ImportCheckResult | null }
  | { kind: "candidates" }
  | { kind: "details" }
  | { kind: "menu" }
  | { kind: "source"; role: string; label: string; stat: string | null }
  | { kind: "assign"; role: AssignRole; replace?: string | null }
  | { kind: "battery"; discharge: string }
  | { kind: "integral"; stat: string };

/** Prefix of drop targets on sources: `src:<assign role>:<block id>`. */
const SOURCE_TARGET = "src:";

/** The assign role of a source block role, if sensors can be dropped on it. */
export function assignRole(role: string | undefined): AssignRole | null {
  switch (role) {
    case "import":
    case "export":
    case "production":
    case "battery":
    case "water":
      return role;
    case "discharge":
    case "charge":
      return "battery";
    default:
      return null;
  }
}

/** Local date and time for a file name, like 2026-10-24-09-30-00. */
export function fileStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

/** Offer a JSON document as a file download. */
export function downloadJson(filename: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The orientation this browser remembers; storage may be blocked. */
function savedOrientation(): Orientation {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal";
  } catch {
    return "horizontal";
  }
}

/** Navigate inside the Home Assistant frontend without reloading the page. */
function navigate(path: string): void {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

export class EnergyFlowMapperPanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    _snapshot: { state: true },
    _loadError: { state: true },
    _changes: { state: true },
    _validation: { state: true },
    _selected: { state: true },
    _collapsed: { state: true },
    _dragged: { state: true },
    _dropTarget: { state: true },
    _search: { state: true },
    _dialog: { state: true },
    _busy: { state: true },
    _toast: { state: true },
    _renameValue: { state: true },
    _view: { state: true },
    _zoom: { state: true },
    _period: { state: true },
    _orientation: { state: true },
    _energy: { state: true },
    _tab: { state: true },
    _find: { state: true },
    _findIndex: { state: true },
  };

  // Reactive properties are declared and set in the constructor, because
  // class fields would shadow Lit's accessors.
  declare hass?: HomeAssistant;
  declare narrow: boolean;

  declare _snapshot: Snapshot | null;
  declare _loadError: string | null;
  declare _changes: Change[];
  declare _validation: ValidateResult | null;
  declare _selected: string | null;
  declare _collapsed: Set<string>;
  declare _dragged: Dragged | null;
  declare _dropTarget: string | null;
  declare _search: string;
  declare _dialog: Dialog | null;
  declare _busy: boolean;
  declare _toast: string | null;
  declare _renameValue: string;
  /** "list" is the former indented tree; it is kept but not offered in the UI. */
  declare _view: "diagram" | "list";
  declare _zoom: Zoom;
  declare _period: Period;
  declare _orientation: Orientation;
  /** Energy of the current period and draft; null for "now" or while loading. */
  declare _energy: EnergyResult | null;
  /** The device list shown: electricity or water. */
  declare _tab: DeviceKind;
  /** Text searched in the diagram, and which match is shown. */
  declare _find: string;
  declare _findIndex: number;

  private _loading = false;
  private _validateRequest = 0;
  private _energyRequest = 0;
  private _toastTimer: ReturnType<typeof setTimeout> | undefined;
  private _fitted = false;
  /** The diagram follows the viewport size until the user zooms or pans. */
  _autoFit = true;
  private _resizeObserver?: ResizeObserver;
  private _observed: Element | null = null;
  private _pointers = new Map<number, { x: number; y: number }>();
  /** Pointer type of the last press, to tell touch drags from mouse drags. */
  _pointerType = "mouse";

  constructor() {
    super();
    this.narrow = false;
    this._snapshot = null;
    this._loadError = null;
    this._changes = [];
    this._validation = null;
    this._selected = null;
    this._collapsed = new Set();
    this._dragged = null;
    this._dropTarget = null;
    this._search = "";
    this._dialog = null;
    this._busy = false;
    this._toast = null;
    this._renameValue = "";
    this._view = "diagram";
    this._zoom = { x: 0, y: 0, k: 1 };
    this._period = "now";
    this._orientation = savedOrientation();
    this._energy = null;
    this._tab = "electricity";
    this._find = "";
    this._findIndex = 0;
  }

  /** Ctrl+Z (Cmd+Z) takes back the last change of the draft, outside text fields. */
  private _onKeyDown = (event: KeyboardEvent): void => {
    const target = event.composedPath()[0] as HTMLElement | undefined;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      event.key.toLowerCase() === "z" &&
      !this._dialog &&
      this._changes.length > 0 &&
      !(target && ["INPUT", "TEXTAREA"].includes(target.tagName))
    ) {
      event.preventDefault();
      this._undoChange();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this._onKeyDown);
  }

  private _t(key: StringKey, placeholders: Record<string, string> = {}): string {
    return localize(this.hass, key, placeholders);
  }

  // --- data ---------------------------------------------------------------

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("hass") && this.hass && !this._snapshot && !this._loading && !this._loadError) {
      void this._load();
    }
  }

  async _load(): Promise<void> {
    if (!this.hass) {
      return;
    }
    this._loading = true;
    try {
      this._snapshot = await this.hass.callWS<Snapshot>({ type: `${DOMAIN}/get` });
      this._loadError = null;
    } catch (err) {
      this._loadError = errorText(this.hass, err);
    } finally {
      this._loading = false;
    }
    await Promise.all([this._validate(), this._loadEnergy()]);
  }

  /** Show live power ("now") or the energy of a period. */
  setPeriod(period: Period): void {
    this._period = period;
    this._energy = null;
    void this._loadEnergy();
  }

  /** Fetch the energy of the period for the draft; outdated answers are ignored. */
  async _loadEnergy(): Promise<void> {
    const request = ++this._energyRequest;
    if (!this.hass || !this._snapshot || this._period === "now") {
      this._energy = null;
      return;
    }
    try {
      const result = await this.hass.callWS<EnergyResult>({
        type: `${DOMAIN}/energy`,
        period: this._period,
        ...(this._changes.length
          ? { base_hash: this._snapshot.hash, changes: this._changes }
          : {}),
      });
      if (request === this._energyRequest) {
        this._energy = result;
      }
    } catch (err) {
      if (request === this._energyRequest) {
        await this._handleError(err);
      }
    }
  }

  /** Switch between the electricity and the water devices. */
  setTab(tab: DeviceKind): void {
    if (tab === this._tab) {
      return;
    }
    this._tab = tab;
    this._selected = null;
    this._find = "";
    this._findIndex = 0;
    this._autoFit = true;
    this._fitted = false;
  }

  /**
   * Values shown in the diagram: power in W (water: flow in L/min), or for a
   * period energy in kWh (water in the unit of the energy result).
   */
  _values(devices: Device[]): Map<string, number | null> {
    if (this._period === "now") {
      return this._rateMap(devices);
    }
    const energy = this._energy?.energy ?? {};
    return new Map(devices.map((d) => [d.stat_consumption, energy[d.stat_consumption] ?? null]));
  }

  /** "L" or "gal": how water is shown. */
  _waterUnit(): string {
    return this._energy?.water_unit ?? (this.hass?.config?.unit_system?.volume === "gal" ? "gal" : "L");
  }

  /** Format a value of `_values` for the current period and tab. */
  _formatValue(value: number): string {
    if (this._tab === "water") {
      return this._period === "now"
        ? formatFlow(this.hass, value, this._waterUnit())
        : formatVolume(this.hass, value, this._waterUnit());
    }
    return this._period === "now" ? formatPower(this.hass, value) : formatEnergy(this.hass, value);
  }

  /** The device list of a tab with the draft applied. */
  draftOf(kind: DeviceKind): Device[] {
    const prefs = this._snapshot?.prefs;
    const devices = kind === "water" ? prefs?.device_consumption_water : prefs?.device_consumption;
    return applyChanges(devices ?? [], this._changes, kind);
  }

  /** The device list of the current tab with the draft applied. */
  get draft(): Device[] {
    return this.draftOf(this._tab);
  }

  /** Device changes of the water tab name their list. */
  private _kind(): { kind?: DeviceKind } {
    return this._tab === "water" ? { kind: "water" } : {};
  }

  /** Free meters of a tab, as the backend found them. */
  _candidates(kind: DeviceKind = this._tab): Candidate[] {
    return (kind === "water" ? this._snapshot?.water_candidates : this._snapshot?.candidates) ?? [];
  }

  /** The sources with the draft applied. */
  get draftSources(): Source[] {
    return applySourceChanges(this._snapshot?.prefs.energy_sources ?? [], this._changes);
  }

  private _info(stat: string): StatInfo | undefined {
    return (
      this._snapshot?.stats[stat] ??
      [...this._candidates("electricity"), ...this._candidates("water")].find((c) => c.stat === stat) ??
      this._snapshot?.power_candidates?.find((c) => c.stat === stat) ??
      this._snapshot?.flow_candidates?.find((c) => c.stat === stat)
    );
  }

  /** Display name; devices of the current tab come first, then the other tab. */
  private _name(
    stat: string,
    devices: Device[] = [...this.draft, ...this.draftOf(this._tab === "water" ? "electricity" : "water")],
  ): string {
    const candidates = [...this._candidates("electricity"), ...this._candidates("water")];
    return displayName(stat, devices, {
      ...this._snapshot?.stats,
      ...Object.fromEntries(candidates.map((c) => [c.stat, c])),
    });
  }

  private _issues(): Issue[] {
    const base = this._validation?.issues ?? this._snapshot?.issues ?? [];
    return this._period === "now" ? base : [...base, ...(this._energy?.issues ?? [])];
  }

  /** Issues of a device in the current tab. */
  private _issuesFor(stat: string): Issue[] {
    return this._issues().filter(
      (issue) => issue.stat === stat && (issue.kind ?? "electricity") === this._tab,
    );
  }

  _change(change: Change): void {
    this._changes = [...this._changes, change];
    void this._validate();
    void this._loadEnergy();
  }

  /** Ask the backend to check the draft; outdated answers are ignored. */
  async _validate(): Promise<ValidateResult | null> {
    const request = ++this._validateRequest;
    if (!this.hass || !this._snapshot || this._changes.length === 0) {
      this._validation = null;
      return null;
    }
    try {
      const result = await this.hass.callWS<ValidateResult>({
        type: `${DOMAIN}/validate`,
        base_hash: this._snapshot.hash,
        changes: this._changes,
      });
      if (request === this._validateRequest) {
        this._validation = result;
      }
      return result;
    } catch (err) {
      await this._handleError(err);
      return null;
    }
  }

  private async _handleError(err: unknown): Promise<void> {
    this._showToast(errorText(this.hass, err));
    if ((err as WSError)?.translation_key === "conflict") {
      this._snapshot = null;
      await this._load();
    }
  }

  /** Take back the last change of the draft. */
  _undoChange(): void {
    if (this._changes.length === 0) {
      return;
    }
    this._changes = this._changes.slice(0, -1);
    this._showToast(this._t("change_undone"));
    void this._validate();
    void this._loadEnergy();
  }

  _discard(): void {
    this._changes = [];
    this._validation = null;
    void this._loadEnergy();
  }

  async _openConfirm(): Promise<void> {
    this._dialog = { kind: "confirm", result: null };
    const result = await this._validate();
    if (this._dialog?.kind === "confirm") {
      this._dialog = result ? { kind: "confirm", result } : null;
    }
  }

  async _save(): Promise<void> {
    if (!this.hass || !this._snapshot) {
      return;
    }
    this._busy = true;
    try {
      const result = await this.hass.callWS<SaveResult>({
        type: `${DOMAIN}/save`,
        base_hash: this._snapshot.hash,
        changes: this._changes,
      });
      this._dialog = null;
      this._discard();
      this._showToast(this._t(result.backup_id ? "saved" : "nothing_to_save"));
      await this._load();
    } catch (err) {
      this._dialog = null;
      await this._handleError(err);
    } finally {
      this._busy = false;
    }
  }

  async _openBackups(undo: boolean): Promise<void> {
    if (!this.hass) {
      return;
    }
    try {
      const { backups } = await this.hass.callWS<{ backups: BackupEntry[] }>({
        type: `${DOMAIN}/backups`,
      });
      if (undo && backups.length > 0) {
        this._dialog = { kind: "restore", backup: backups[0], undo: true };
      } else {
        this._dialog = { kind: "backups", entries: backups };
      }
    } catch (err) {
      await this._handleError(err);
    }
  }

  async _restore(backup: BackupEntry): Promise<void> {
    if (!this.hass || !this._snapshot) {
      return;
    }
    this._busy = true;
    try {
      await this.hass.callWS<SaveResult>({
        type: `${DOMAIN}/restore`,
        backup_id: backup.id,
        base_hash: this._snapshot.hash,
      });
      this._dialog = null;
      this._discard();
      this._showToast(this._t("restored"));
      await this._load();
    } catch (err) {
      this._dialog = null;
      await this._handleError(err);
    } finally {
      this._busy = false;
    }
  }

  /** Download the current settings, or a backup, as a JSON file. */
  async _export(backup?: BackupEntry): Promise<void> {
    if (!this.hass) {
      return;
    }
    try {
      const document = await this.hass.callWS<ExportDocument>({
        type: `${DOMAIN}/export`,
        ...(backup ? { backup_id: backup.id } : {}),
      });
      const stamp = fileStamp(backup?.created ?? document.exported);
      downloadJson(`energy-flow-mapper-${backup ? "backup" : "settings"}-${stamp}.json`, document);
    } catch (err) {
      await this._handleError(err);
    }
  }

  /** Let the user pick an exported file; it is checked before anything is written. */
  _pickImportFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        void this._readImport(file);
      }
    });
    input.click();
  }

  async _readImport(file: File): Promise<void> {
    if (!this.hass || !this._snapshot) {
      return;
    }
    let document: unknown;
    try {
      document = JSON.parse(await file.text());
    } catch {
      this._showToast(this._t("import_invalid_file"));
      return;
    }
    this._dialog = { kind: "import", file: file.name, document, result: null };
    try {
      const result = await this.hass.callWS<ImportCheckResult>({
        type: `${DOMAIN}/import_check`,
        base_hash: this._snapshot.hash,
        document,
      });
      if (this._dialog?.kind === "import") {
        this._dialog = { ...this._dialog, result };
      }
    } catch (err) {
      this._dialog = null;
      await this._handleError(err);
    }
  }

  async _import(document: unknown): Promise<void> {
    if (!this.hass || !this._snapshot) {
      return;
    }
    this._busy = true;
    try {
      const result = await this.hass.callWS<SaveResult>({
        type: `${DOMAIN}/import`,
        base_hash: this._snapshot.hash,
        document,
      });
      this._dialog = null;
      this._discard();
      this._showToast(this._t(result.backup_id ? "imported" : "nothing_to_save"));
      await this._load();
    } catch (err) {
      this._dialog = null;
      await this._handleError(err);
    } finally {
      this._busy = false;
    }
  }

  private _showToast(text: string): void {
    this._toast = text;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = null;
    }, TOAST_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeyDown);
    clearTimeout(this._toastTimer);
    this._resizeObserver?.disconnect();
    this._observed = null;
  }

  /** Keep the diagram fitted while its viewport changes size (window, layout). */
  _onViewportResize(): void {
    if (this._autoFit) {
      this.fit();
    }
  }

  private _observeViewport(): void {
    const viewport = this._viewport();
    if (viewport === this._observed || typeof ResizeObserver === "undefined") {
      return;
    }
    this._resizeObserver ??= new ResizeObserver(() => this._onViewportResize());
    this._resizeObserver.disconnect();
    if (viewport) {
      this._resizeObserver.observe(viewport);
    }
    this._observed = viewport;
  }

  // --- drag and drop --------------------------------------------------------

  /** Can the dragged item be dropped on `target` (HOME: top level)? */
  _canDrop(target: string): boolean {
    const dragged = this._dragged;
    if (dragged === null) {
      return false;
    }
    if (target.startsWith(SOURCE_TARGET)) {
      return dragged.kind === "candidate";
    }
    const parent = target === HOME ? null : target;
    if (dragged.kind === "candidate") {
      return true;
    }
    return canMove(this.draft, dragged.stat, parent);
  }

  _drop(target: string): void {
    const dragged = this._dragged;
    const allowed = this._canDrop(target);
    this._dragged = null;
    this._dropTarget = null;
    if (dragged === null || !allowed) {
      return;
    }
    if (target.startsWith(SOURCE_TARGET)) {
      // `src:<assign role>:<block id>`; a block with a meter gets it replaced.
      const rest = target.slice(SOURCE_TARGET.length);
      const separator = rest.indexOf(":");
      const blockId = rest.slice(separator + 1);
      const block = this.diagramLayout().blocks.find((b) => b.id === blockId && b.kind === "source");
      this._assign(rest.slice(0, separator) as AssignRole, dragged.stat, block?.stat ?? null);
      return;
    }
    const parent = target === HOME ? null : target;
    if (dragged.kind === "candidate") {
      this._addCandidate(dragged.stat, parent);
    } else {
      this._change({ type: "move", stat: dragged.stat, parent, ...this._kind() });
    }
  }

  private _dragHandlers(target: string) {
    return {
      over: (event: DragEvent) => {
        if (this._canDrop(target)) {
          event.preventDefault();
          this._dropTarget = target;
        }
      },
      leave: () => {
        if (this._dropTarget === target) {
          this._dropTarget = null;
        }
      },
      drop: (event: DragEvent) => {
        event.preventDefault();
        this._drop(target);
      },
    };
  }

  private _startDrag(event: DragEvent, dragged: Dragged): void {
    event.dataTransfer?.setData("text/plain", dragged.stat);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
    if (dragged.kind === "device" && this._view === "diagram") {
      this._setDragImage(event);
    }
    this._dragged = dragged;
  }

  /**
   * Browsers draw the drag image at the block's unzoomed size, which looks
   * huge in a zoomed-out diagram. Use a copy scaled like the diagram instead.
   */
  _setDragImage(event: DragEvent): void {
    const block = event.currentTarget as HTMLElement | null;
    const transfer = event.dataTransfer;
    if (!block || !transfer?.setDragImage) {
      return;
    }
    // On touch the finger covers the image: show it a bit larger and above it.
    const touch = this._pointerType === "touch" || this._pointerType === "pen";
    const k = touch ? Math.max(this._zoom.k, TOUCH_DRAG_SCALE) : this._zoom.k;
    const width = block.offsetWidth * k;
    const height = block.offsetHeight * k;
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.style.cssText = `position:fixed;left:0;top:-${Math.ceil(height) + 100}px;width:${width}px;height:${height}px;overflow:hidden;pointer-events:none`;
    const copy = block.cloneNode(true) as HTMLElement;
    copy.style.left = "0";
    copy.style.top = "0";
    copy.style.transform = `scale(${k})`;
    copy.style.transformOrigin = "0 0";
    ghost.append(copy);
    this.renderRoot.append(ghost);
    const rect = block.getBoundingClientRect();
    if (touch) {
      transfer.setDragImage(ghost, width / 2, height + TOUCH_DRAG_LIFT);
    } else {
      transfer.setDragImage(
        ghost,
        Math.min(width, Math.max(0, event.clientX - rect.left)),
        Math.min(height, Math.max(0, event.clientY - rect.top)),
      );
    }
    // The browser takes its snapshot synchronously; the copy can go right after.
    setTimeout(() => ghost.remove(), 0);
  }

  _addCandidate(stat: string, parent: string | null): void {
    const candidate = this._candidates().find((c) => c.stat === stat);
    this._change({
      type: "add",
      stat,
      parent,
      stat_rate: candidate?.power ?? null,
      ...this._kind(),
    });
    this._selected = stat;
  }

  /**
   * Assign a free sensor to a source role; a battery asks for its second
   * meter. `replace` names the grid or water meter it replaces, so that the
   * right source changes when there are several.
   */
  _assign(role: AssignRole, stat: string, replace: string | null = null): void {
    if (role === "battery") {
      this._dialog = { kind: "battery", discharge: stat };
      return;
    }
    this._dialog = null;
    const replaces = role === "import" || role === "export" || role === "water";
    this._change({ type: "assign_source", role, stat, ...(replaces && replace ? { replace } : {}) });
  }

  /** Statistics used by the draft's devices (both tabs) and sources. */
  private _usedInDraft(): Set<string> {
    const used = new Set<string>();
    for (const device of [...this.draftOf("electricity"), ...this.draftOf("water")]) {
      used.add(device.stat_consumption);
      if (device.stat_rate) {
        used.add(device.stat_rate);
      }
    }
    for (const row of sourceRows(this.draftSources)) {
      used.add(row.stat);
    }
    return used;
  }

  /** Power (water tab: flow) sensors without meter that the draft does not use yet. */
  _freePowerSensors(): StatInfo[] {
    const used = this._usedInDraft();
    const sensors =
      (this._tab === "water" ? this._snapshot?.flow_candidates : this._snapshot?.power_candidates) ?? [];
    return sensors.filter((c) => !used.has(c.stat));
  }

  /** Name of the meter helper for a power or flow sensor. */
  private _meterName(stat: string): string {
    return `${this._info(stat)?.name || stat} ${this._t(this._tab === "water" ? "water_suffix" : "energy_suffix")}`;
  }

  async _createMeter(stat: string): Promise<void> {
    if (!this.hass) {
      return;
    }
    const name = this._meterName(stat);
    this._busy = true;
    try {
      const result = await this.hass.callWS<{ entity_id: string; stat_rate: string; kind?: DeviceKind }>({
        type: `${DOMAIN}/create_integral`,
        power_entity_id: stat,
        name,
      });
      this._dialog = null;
      await this._load();
      this._change({
        type: "add",
        stat: result.entity_id,
        parent: null,
        stat_rate: result.stat_rate,
        ...(result.kind === "water" ? { kind: "water" as const } : {}),
      });
      this._selected = result.entity_id;
      this._showToast(this._t("meter_created", { name }));
    } catch (err) {
      this._dialog = null;
      await this._handleError(err);
    } finally {
      this._busy = false;
    }
  }

  /** Free sensors of the tab that are not added in the draft yet, matching `search`. */
  _freeCandidates(search: string = this._search): Candidate[] {
    const used = this._usedInDraft();
    search = search.trim().toLowerCase();
    return this._candidates().filter(
      (c) =>
        !used.has(c.stat) &&
        (!search ||
          [c.name, c.stat, c.area_name, c.device_name].some((v) =>
            v?.toLowerCase().includes(search),
          )),
    );
  }

  // --- rendering ------------------------------------------------------------

  protected override updated(changed: PropertyValues<this>): void {
    // The first fit waits for a sized viewport; a zoom or search before it wins.
    if (!this._fitted && this._autoFit && this._snapshot && this._view === "diagram") {
      this._fitted = this.fit();
    }
    this._observeViewport();
    if (!changed.has("_dialog")) {
      return;
    }
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (!dialog) {
      return;
    }
    if (this._dialog && !dialog.open) {
      dialog.showModal?.();
    } else if (!this._dialog && dialog.open) {
      dialog.close?.();
    }
  }

  private _reload(): void {
    this._snapshot = null;
    this._loadError = null;
    void this._load();
  }

  protected override render(): TemplateResult {
    return html`
      <div class="header">
        ${this.narrow
          ? html`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${() =>
                this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }))}
            >
              ${icon("menu")}
            </button>`
          : nothing}
        <h1>${this._t("title")}</h1>
        ${this.narrow
          ? html`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${() => (this._dialog = { kind: "menu" })}
            >
              ${icon("dots")}
            </button>`
          : html`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${() => this._openBackups(true)}>
                ${icon("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${() => this._openBackups(false)}>
                ${icon("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${() => this._reload()}
              >
                ${icon("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast ? html`<div class="toast" role="status">${this._toast}</div>` : nothing}
    `;
  }

  private _renderBody(): TemplateResult {
    if (this._loadError) {
      return html`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`;
    }
    if (!this._snapshot) {
      return html`<div class="message">${this._t("loading")}</div>`;
    }
    return html`
      <div class="tabs" role="tablist" aria-label=${this._t("tabs_label")}>
        ${TABS.map(
          (tab) => html`<button
            role="tab"
            class=${this._tab === tab ? "active" : ""}
            aria-selected=${String(this._tab === tab)}
            data-tab=${tab}
            @click=${() => this.setTab(tab)}
          >
            ${icon(tab === "water" ? "water" : "flash")} ${this._t(`tab_${tab}`)}
          </button>`,
        )}
      </div>
      <div class="content ${this.narrow ? "narrow" : ""}">
        ${this.narrow ? nothing : html`<aside class="column free">${this._renderCandidates()}</aside>`}
        <main class="column main">
          ${this._view === "list"
            ? html`${this._renderSources()} ${this._renderTree()}`
            : this._renderDiagram()}
        </main>
        ${this.narrow ? nothing : html`<aside class="column details">${this._renderDetails()}</aside>`}
      </div>
    `;
  }

  // --- diagram --------------------------------------------------------------

  /** Power in W, or for water flow in L/min, of each device's rate sensor. */
  private _rateMap(devices: Device[]): Map<string, number | null> {
    return new Map(
      devices.map((d) => [d.stat_consumption, this.hass ? rateValue(this.hass, d.stat_rate, this._tab) : null]),
    );
  }

  /** The diagram layout of the current draft and tab. */
  diagramLayout() {
    const devices = this.draft;
    const roots = buildTree(devices);
    const values = this._values(devices);
    return layout(
      roots,
      sourceRows(this.draftSources, this._tab),
      values,
      untracked(roots, values),
      this._collapsed,
      this._tab === "water" ? WATER_PLACEHOLDER_ROLES : PLACEHOLDER_ROLES,
      true,
      this._orientation,
    );
  }

  /** Run the diagram the other way, fit it again and remember the choice. */
  setOrientation(orientation: Orientation): void {
    this._orientation = orientation;
    try {
      localStorage.setItem(ORIENTATION_KEY, orientation);
    } catch {
      // Blocked storage: the choice just lasts until the panel is opened again.
    }
    this._autoFit = true;
    this.fit();
  }

  private _viewport(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".viewport");
  }

  /**
   * Devices of the tab whose name, area or statistic contains the search text.
   * Only the part of the statistic after the domain counts, so "sensor" does
   * not match every device.
   */
  findMatches(query: string = this._find): string[] {
    const text = query.trim().toLowerCase();
    if (!text) {
      return [];
    }
    const devices = this.draft;
    return devices
      .map((d) => d.stat_consumption)
      .filter((stat) =>
        [this._name(stat, devices), stat.slice(stat.indexOf(".") + 1), this._info(stat)?.area_name].some((v) =>
          v?.toLowerCase().includes(text),
        ),
      );
  }

  /** Search the diagram and show the first match. */
  setFind(query: string): void {
    this._find = query;
    this._findIndex = 0;
    this._showMatch();
  }

  /** Show the next match (Enter in the search field). */
  nextMatch(): void {
    const count = this.findMatches().length;
    if (count > 0) {
      this._findIndex = (this._findIndex + 1) % count;
      this._showMatch();
    }
  }

  /**
   * Open the collapsed devices above the current match, select it and move it
   * to the middle of the viewport, zooming in if the diagram is very small.
   */
  private _showMatch(): void {
    const stat = this.findMatches()[this._findIndex];
    if (stat === undefined) {
      return;
    }
    const devices = this.draft;
    const collapsed = new Set(this._collapsed);
    let parent = devices.find((d) => d.stat_consumption === stat)?.included_in_stat;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      collapsed.delete(parent);
      parent = devices.find((d) => d.stat_consumption === parent)?.included_in_stat;
    }
    this._collapsed = collapsed;
    this._selected = stat;
    const block = this.diagramLayout().blocks.find((b) => b.kind === "device" && b.stat === stat);
    const viewport = this._viewport();
    if (!block || !viewport?.clientWidth) {
      return;
    }
    this._autoFit = false;
    const k = Math.min(MAX_ZOOM, Math.max(this._zoom.k, FIND_ZOOM));
    this._zoom = {
      k,
      x: viewport.clientWidth / 2 - (block.x + block.w / 2) * k,
      y: viewport.clientHeight / 2 - (block.y + block.h / 2) * k,
    };
  }

  /** CSS class of a device block while searching: the current match, another match, or dimmed. */
  private _findClass(stat: string): string {
    if (!this._find.trim()) {
      return "";
    }
    const matches = this.findMatches();
    if (!matches.includes(stat)) {
      return "dim";
    }
    return matches[this._findIndex] === stat ? "match current" : "match";
  }

  /** Fit the whole diagram into the viewport; false while it has no size yet. */
  fit(): boolean {
    const viewport = this._viewport();
    const width = viewport?.clientWidth ?? 0;
    const height = viewport?.clientHeight ?? 0;
    if (!width || !height) {
      return false;
    }
    const { width: w, height: h } = this.diagramLayout();
    const k = Math.min(1.4, Math.max(MIN_ZOOM, Math.min(width / w, height / h)));
    this._zoom = { k, x: (width - w * k) / 2, y: Math.max(0, (height - h * k) / 2) };
    return true;
  }

  /** Zoom by `factor`, keeping the point (px, py) of the viewport in place. */
  zoomAt(px: number, py: number, factor: number): void {
    const { x, y, k } = this._zoom;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    const ratio = next / k;
    this._zoom = { k: next, x: px - (px - x) * ratio, y: py - (py - y) * ratio };
  }

  private _zoomCenter(factor: number): void {
    this._autoFit = false;
    const viewport = this._viewport();
    this.zoomAt((viewport?.clientWidth ?? 0) / 2, (viewport?.clientHeight ?? 0) / 2, factor);
  }

  private _local(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this._viewport()?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  _onWheel(event: WheelEvent): void {
    event.preventDefault();
    this._autoFit = false;
    const { x, y } = this._local(event);
    this.zoomAt(x, y, Math.exp(-event.deltaY * 0.0015));
  }

  _onPointerDown(event: PointerEvent): void {
    this._pointerType = event.pointerType || "mouse";
    if ((event.target as Element).closest?.(".block, button, a")) {
      return;
    }
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    this._pointers.set(event.pointerId, this._local(event));
  }

  /** One pointer pans; two pointers pinch-zoom around their midpoint. */
  _onPointerMove(event: PointerEvent): void {
    const previous = this._pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    this._autoFit = false;
    const before = [...this._pointers.values()];
    const current = this._local(event);
    this._pointers.set(event.pointerId, current);
    if (this._pointers.size === 1) {
      this._zoom = {
        ...this._zoom,
        x: this._zoom.x + current.x - previous.x,
        y: this._zoom.y + current.y - previous.y,
      };
      return;
    }
    const after = [...this._pointers.values()];
    const distance = (points: { x: number; y: number }[]) =>
      Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const middle = (points: { x: number; y: number }[]) => ({
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    });
    const [m0, m1] = [middle(before), middle(after)];
    this._zoom = { ...this._zoom, x: this._zoom.x + m1.x - m0.x, y: this._zoom.y + m1.y - m0.y };
    if (distance(before) > 0) {
      this.zoomAt(m1.x, m1.y, distance(after) / distance(before));
    }
  }

  _onPointerUp(event: PointerEvent): void {
    this._pointers.delete(event.pointerId);
  }

  private _renderDiagram(): TemplateResult {
    const devices = this.draft;
    const result = this.diagramLayout();
    const blocks = new Map(result.blocks.map((b) => [b.id, b]));
    const maxPower = Math.max(0, ...result.edges.map((e) => e.power ?? 0));
    const power = this._values(devices);
    const rest = untracked(buildTree(devices), power);
    const known = buildTree(devices)
      .map((n) => power.get(n.stat))
      .filter((v): v is number => v != null);
    const measured = known.length ? known.reduce((a, b) => a + b, 0) : null;
    const { x, y, k } = this._zoom;
    return html`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t(this._tab === "water" ? "diagram_water" : "diagram")}</h2>
          <div class="periods" role="group" aria-label=${this._t("period_label")}>
            ${(["now", "today", "week", "month"] as const).map(
              (period) => html`<button
                class=${this._period === period ? "active" : ""}
                aria-pressed=${String(this._period === period)}
                data-period=${period}
                @click=${() => this.setPeriod(period)}
              >
                ${this._t(`period_${period}`)}
              </button>`,
            )}
          </div>
          <div class="toolbar">
            <div class="orientation" role="group" aria-label=${this._t("orientation_label")}>
              ${(["horizontal", "vertical"] as const).map(
                (orientation) => html`<button
                  class=${this._orientation === orientation ? "active" : ""}
                  aria-pressed=${String(this._orientation === orientation)}
                  @click=${() => this.setOrientation(orientation)}
                >
                  ${this._t(`orientation_${orientation}`)}
                </button>`,
              )}
            </div>
            <button
              class="icon"
              aria-label=${this._t("zoom_out")}
              title=${this._t("zoom_out")}
              @click=${() => this._zoomCenter(1 / 1.25)}
            >
              −
            </button>
            <button
              class="icon"
              aria-label=${this._t("zoom_in")}
              title=${this._t("zoom_in")}
              @click=${() => this._zoomCenter(1.25)}
            >
              +
            </button>
            <button
              @click=${() => {
                this._autoFit = true;
                this.fit();
              }}
            >
              ${this._t("fit")}
            </button>
          </div>
        </div>
        <p class="hint">
          ${this._t("devices_hint")} ${this._t("sources_hint")} ${this._t("zoom_hint")}
          ${this._period !== "now" && this._energy === null
            ? html`<span class="loading">${this._t("energy_loading")}</span>`
            : nothing}
        </p>
        ${this._renderFind()}
        <div
          class="viewport ${this._dragged ? "dragging" : ""}"
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => this._onPointerDown(e)}
          @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._onPointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._onPointerUp(e)}
        >
          <div
            class="canvas"
            style="width:${result.width}px;height:${result.height}px;transform:translate(${x}px, ${y}px) scale(${k})"
          >
            <svg class="edges" width=${result.width} height=${result.height} aria-hidden="true">
              ${result.edges.map((edge) => this._renderEdge(edge, blocks, maxPower))}
            </svg>
            ${result.blocks.map((block) => this._renderBlock(block, devices, measured, rest))}
          </div>
        </div>
      </section>
    `;
  }

  private _renderFind(): TemplateResult {
    const matches = this.findMatches();
    const searching = this._find.trim() !== "";
    return html`<div class="find">
      <input
        type="search"
        placeholder=${this._t("find_device")}
        aria-label=${this._t("find_device")}
        .value=${this._find}
        @input=${(e: Event) => this.setFind((e.target as HTMLInputElement).value)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.nextMatch();
          }
        }}
      />
      ${searching
        ? html`<span class="find-count" role="status">
              ${matches.length === 0
                ? this._t("find_none")
                : this._t("find_count", {
                    index: formatNumber(this.hass, this._findIndex + 1),
                    count: formatNumber(this.hass, matches.length),
                  })}
            </span>
            ${matches.length > 1
              ? html`<button class="find-next" @click=${() => this.nextMatch()}>${this._t("find_next")}</button>`
              : nothing}`
        : nothing}
    </div>`;
  }

  private _edgeColor(edge: Edge, blocks: Map<string, Block>): string {
    if (edge.kind === "untracked") {
      return "var(--secondary-text-color)";
    }
    if (edge.kind === "source") {
      const source = blocks.get(edge.from === HOME_ID ? edge.to : edge.from);
      return SOURCE_COLORS[source?.role ?? ""] ?? "var(--secondary-text-color)";
    }
    return "var(--primary-color)";
  }

  private _renderEdge(edge: Edge, blocks: Map<string, Block>, maxPower: number) {
    const from = blocks.get(edge.from);
    const to = blocks.get(edge.to);
    if (!from || !to) {
      return nothing;
    }
    const color = this._edgeColor(edge, blocks);
    const dashed = edge.kind === "untracked" || (edge.kind === "device" && edge.power === null);
    const width = strokeWidth(edge.power, maxPower);
    const head = arrowSize(width);
    // The line ends just inside the base of the arrowhead (flat end), so it
    // neither pokes out of the tip nor leaves a gap.
    return svg`<g class="edge edge-${edge.kind}" data-from=${edge.from} data-to=${edge.to}>
      <path
        d=${edgePath(from, to, head.length - 1, this._orientation)}
        fill="none"
        stroke=${color}
        stroke-width=${width}
        stroke-dasharray=${dashed ? dashPattern(width) : "none"}
        stroke-linecap="butt"
      ></path>
      <polygon points=${arrowHead(from, to, head.half, head.length, this._orientation)} fill=${color}></polygon>
    </g>`;
  }

  private _blockStyle(block: Block): string {
    return `left:${block.x}px;top:${block.y}px;width:${block.w}px;height:${block.h}px`;
  }

  private _renderBlock(
    block: Block,
    devices: Device[],
    measured: number | null,
    rest: Map<string, number | null>,
  ): TemplateResult {
    const style = this._blockStyle(block);
    switch (block.kind) {
      case "home": {
        const drop = this._dragHandlers(HOME);
        return html`<div
          class="block home ${this._dropTarget === HOME ? "drop" : ""} ${this._dragged &&
          this._canDrop(HOME)
            ? "can-drop"
            : ""}"
          style=${style}
          @dragover=${drop.over}
          @dragleave=${drop.leave}
          @drop=${drop.drop}
        >
          ${icon("home")}
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${measured === null
              ? nothing
              : html`<span class="sub"
                  >${this._t("home_measured", { power: this._formatValue(measured) })}</span
                >`}
          </div>
        </div>`;
      }
      case "source":
      case "placeholder": {
        const role = block.role ?? "import";
        const label =
          role === "consumption"
            ? this._t(`role_${block.source?.type ?? "gas"}` as StringKey)
            : this._t(`role_${role}` as StringKey);
        const assign = assignRole(role);
        const key = assign ? `${SOURCE_TARGET}${assign}:${block.id}` : null;
        const drop = key ? this._dragHandlers(key) : null;
        return html`<button
          class="block source ${block.kind} ${key && this._dropTarget === key ? "drop" : ""} ${key &&
          this._dragged &&
          this._canDrop(key)
            ? "can-drop"
            : ""}"
          style="${style};--source-color:${SOURCE_COLORS[role] ?? "var(--divider-color)"}"
          title=${this._t("sources_hint")}
          data-role=${role}
          @dragover=${drop?.over}
          @dragleave=${drop?.leave}
          @drop=${drop?.drop}
          @click=${() => {
            if (block.kind === "placeholder" && assign) {
              this._dialog = { kind: "assign", role: assign };
            } else {
              this._dialog = { kind: "source", role, label, stat: block.stat ?? null };
            }
          }}
        >
          <div class="block-text">
            <span class="node-name">${block.kind === "placeholder" ? `+ ${label}` : label}</span>
            ${block.stat
              ? html`<span class="sub">${block.source?.name || this._name(block.stat)}</span>`
              : nothing}
          </div>
        </button>`;
      }
      case "untracked": {
        const value = rest.get(block.stat!);
        return html`<div class="block untracked" style=${style} data-parent=${block.stat!}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub">${value == null ? this._t("none") : this._formatValue(value)}</span>
          </div>
        </div>`;
      }
      default:
        return this._renderDeviceBlock(block, devices);
    }
  }

  private _renderDeviceBlock(block: Block, devices: Device[]): TemplateResult {
    const stat = block.stat!;
    const node = block.node!;
    const name = this._name(stat, devices);
    const issues = this._issuesFor(stat);
    const hasError = issues.some((i) => i.severity === "error") || node.problem !== null;
    const handlers = this._dragHandlers(stat);
    const device = devices.find((d) => d.stat_consumption === stat);
    const value = device ? (this._values([device]).get(stat) ?? null) : null;
    const info = this._info(stat);
    const sub = [value === null ? null : this._formatValue(value), info?.area_name]
      .filter(Boolean)
      .join(" · ");
    const collapsed = this._collapsed.has(stat);
    return html`<div
      class="block device node ${this._findClass(stat)} ${this._selected === stat ? "selected" : ""} ${this._dropTarget ===
      stat
        ? "drop"
        : ""} ${hasError ? "has-error" : issues.length ? "has-warning" : ""} ${this._dragged?.stat ===
      stat
        ? "dragged"
        : this._dragged && this._canDrop(stat)
          ? "can-drop"
          : ""}"
      style=${this._blockStyle(block)}
      draggable="true"
      data-stat=${stat}
      @dragstart=${(e: DragEvent) => this._startDrag(e, { kind: "device", stat })}
      @dragend=${() => {
        this._dragged = null;
        this._dropTarget = null;
      }}
      @dragover=${handlers.over}
      @dragleave=${handlers.leave}
      @drop=${handlers.drop}
      @click=${() => {
        this._selected = stat;
        if (this.narrow) {
          this._dialog = { kind: "details" };
        }
      }}
    >
      ${node.children.length
        ? html`<button
            class="icon toggle"
            aria-label=${name}
            aria-expanded=${String(!collapsed)}
            @click=${(e: Event) => {
              e.stopPropagation();
              this._toggle(stat);
            }}
          >
            ${collapsed ? "▸" : "▾"}
          </button>`
        : nothing}
      <div class="block-text">
        <span class="node-name" title=${name}>${name}</span>
        ${sub ? html`<span class="sub">${sub}</span>` : nothing}
      </div>
      ${issues.length || node.problem
        ? html`<span class="badge" title=${issues.map((i) => this._issueText(i)).join("\n")}
            >!</span
          >`
        : nothing}
      <button
        class="icon"
        aria-label=${this._t("actions", { name })}
        @click=${(e: Event) => {
          e.stopPropagation();
          this._dialog = { kind: "actions", stat };
        }}
      >
        ${icon("dots")}
      </button>
    </div>`;
  }

  private _toggle(stat: string): void {
    const next = new Set(this._collapsed);
    if (next.has(stat)) {
      next.delete(stat);
    } else {
      next.add(stat);
    }
    this._collapsed = next;
  }

  // --- list (hidden, kept for later use) --------------------------------------

  private _renderSources(): TemplateResult {
    const rows = sourceRows(this.draftSources, this._tab);
    return html`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${() => navigate("/config/energy")}>
            ${this._t("open_energy_settings")}
          </button>
        </div>
        <p class="hint">${this._t("sources_hint")}</p>
        ${rows.length === 0
          ? html`<p class="empty">${this._t("no_sources")}</p>`
          : html`<div class="sources">
              ${rows.map(
                (row) => html`<div class="source">
                  <span class="source-role"
                    >${this._t(
                      row.role === "consumption"
                        ? (`role_${row.type}` as StringKey)
                        : (`role_${row.role}` as StringKey),
                    )}</span
                  >
                  <span class="source-name">${row.name || this._name(row.stat)}</span>
                </div>`,
              )}
            </div>`}
      </section>
    `;
  }

  private _renderTree(): TemplateResult {
    const devices = this.draft;
    const roots = buildTree(devices);
    const power = this._rateMap(devices);
    const rest = untracked(roots, power);
    const home = this._dragHandlers(HOME);
    return html`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget === HOME ? "drop" : ""}"
          @dragover=${home.over}
          @dragleave=${home.leave}
          @drop=${home.drop}
        >
          ${icon("home")}
          <span>${this._t("home")}</span>
          ${this._dragged ? html`<span class="hint">${this._t("home_drop")}</span>` : nothing}
        </div>
        ${roots.length === 0
          ? html`<p class="empty">${this._t("no_devices")}</p>`
          : html`<ul class="tree" role="tree">
              ${roots.map((node) => this._renderNode(node, devices, power, rest))}
            </ul>`}
      </section>
    `;
  }

  private _renderNode(
    node: TreeNode,
    devices: Device[],
    power: Map<string, number | null>,
    rest: Map<string, number | null>,
  ): TemplateResult {
    const name = this._name(node.stat, devices);
    const issues = this._issuesFor(node.stat);
    const hasError = issues.some((i) => i.severity === "error") || node.problem !== null;
    const collapsed = this._collapsed.has(node.stat);
    const handlers = this._dragHandlers(node.stat);
    const watts = power.get(node.stat) ?? null;
    const untrackedWatts = rest.get(node.stat);
    return html`
      <li role="treeitem" aria-expanded=${node.children.length ? String(!collapsed) : nothing}>
        <div
          class="node ${this._selected === node.stat ? "selected" : ""} ${this._dropTarget === node.stat
            ? "drop"
            : ""} ${hasError ? "has-error" : issues.length ? "has-warning" : ""}"
          draggable="true"
          data-stat=${node.stat}
          @dragstart=${(e: DragEvent) => this._startDrag(e, { kind: "device", stat: node.stat })}
          @dragend=${() => {
            this._dragged = null;
            this._dropTarget = null;
          }}
          @dragover=${handlers.over}
          @dragleave=${handlers.leave}
          @drop=${handlers.drop}
          @click=${() => {
            this._selected = node.stat;
            if (this.narrow) {
              this._dialog = { kind: "details" };
            }
          }}
        >
          ${node.children.length
            ? html`<button
                class="icon toggle"
                aria-label=${name}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  const next = new Set(this._collapsed);
                  if (collapsed) {
                    next.delete(node.stat);
                  } else {
                    next.add(node.stat);
                  }
                  this._collapsed = next;
                }}
              >
                ${collapsed ? "▸" : "▾"}
              </button>`
            : html`<span class="toggle"></span>`}
          <span class="node-name">${name}</span>
          ${issues.length || node.problem
            ? html`<span
                class="badge"
                title=${issues.map((i) => this._issueText(i)).join("\n")}
                >!</span
              >`
            : nothing}
          <span class="node-power">${watts === null ? nothing : this._formatValue(watts)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions", { name })}
            @click=${(e: Event) => {
              e.stopPropagation();
              this._dialog = { kind: "actions", stat: node.stat };
            }}
          >
            ${icon("dots")}
          </button>
        </div>
        ${node.children.length && !collapsed
          ? html`<ul role="group">
              ${node.children.map((child) => this._renderNode(child, devices, power, rest))}
              ${untrackedWatts !== undefined
                ? html`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power"
                      >${untrackedWatts === null ? this._t("none") : this._formatValue(untrackedWatts)}</span
                    >
                  </li>`
                : nothing}
            </ul>`
          : nothing}
      </li>
    `;
  }

  private _renderCandidates(): TemplateResult {
    const candidates = this._freeCandidates();
    return html`
      <section class="card">
        <div class="card-header"><h2>${this._t("free_sensors")}</h2></div>
        <p class="hint">${this._t(this._tab === "water" ? "free_sensors_hint_water" : "free_sensors_hint")}</p>
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${(e: Event) => (this._search = (e.target as HTMLInputElement).value)}
        />
        ${candidates.length === 0
          ? html`<p class="empty">${this._t(this._tab === "water" ? "no_candidates_water" : "no_candidates")}</p>`
          : html`<ul class="candidates">
              ${candidates.map(
                (c) => html`<li
                  class="candidate"
                  draggable="true"
                  data-stat=${c.stat}
                  @dragstart=${(e: DragEvent) => this._startDrag(e, { kind: "candidate", stat: c.stat })}
                  @dragend=${() => {
                    this._dragged = null;
                    this._dropTarget = null;
                  }}
                >
                  <div class="candidate-text">
                    <span class="node-name">${c.name || c.stat}</span>
                    <span class="sub"
                      >${[
                        c.external ? this._t("external_statistic") : null,
                        c.area_name,
                        c.device_name,
                        c.created_helper ? this._t("created_by") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || c.stat}</span
                    >
                  </div>
                  <button @click=${() => (this._dialog = { kind: "add", stat: c.stat })}>
                    ${this._t("add")}
                  </button>
                </li>`,
              )}
            </ul>`}
        ${this._renderPowerSensors()}
      </section>
    `;
  }

  private _renderPowerSensors(): TemplateResult | typeof nothing {
    const sensors = this._freePowerSensors();
    if (sensors.length === 0) {
      return nothing;
    }
    const water = this._tab === "water";
    return html`<h3>${this._t(water ? "flow_only" : "power_only")}</h3>
      <p class="hint">${this._t(water ? "flow_only_hint" : "power_only_hint")}</p>
      <ul class="candidates power-only">
        ${sensors.map(
          (s) => html`<li data-stat=${s.stat}>
            <div class="candidate-text">
              <span class="node-name">${s.name || s.stat}</span>
              <span class="sub">${[s.area_name, s.device_name].filter(Boolean).join(" · ") || s.stat}</span>
            </div>
            <button @click=${() => (this._dialog = { kind: "integral", stat: s.stat })}>
              ${this._t("create_meter")}
            </button>
          </li>`,
        )}
      </ul>`;
  }

  private _renderDetails(): TemplateResult {
    const stat = this._selected;
    const devices = this.draft;
    const device = devices.find((d) => d.stat_consumption === stat);
    if (!stat || !device) {
      return html`<section class="card">
        <div class="card-header"><h2>${this._t("details")}</h2></div>
        <p class="empty">${this._t("select_hint")}</p>
      </section>`;
    }
    const info = this._info(stat);
    const water = this._tab === "water";
    const rate = this.hass ? rateValue(this.hass, device.stat_rate, this._tab) : null;
    const rateText =
      rate === null
        ? null
        : water
          ? formatFlow(this.hass, rate, this._waterUnit())
          : formatPower(this.hass, rate);
    const roots = buildTree(devices);
    const values = this._values(devices);
    const rest = untracked(roots, values).get(stat);
    const energy = this._period === "now" ? undefined : (values.get(stat) ?? null);
    const issues = this._issuesFor(stat);
    const row = (label: StringKey, value: string | null | undefined) =>
      html`<dt>${this._t(label)}</dt>
        <dd>${value || this._t("none")}</dd>`;
    return html`
      <section class="card">
        <div class="card-header"><h2>${this._name(stat, devices)}</h2></div>
        <dl>
          ${row("detail_statistic", stat)}
          ${row(water ? "detail_flow_sensor" : "detail_power_sensor", device.stat_rate)}
          ${row("detail_device", info?.device_name)} ${row("detail_area", info?.area_name)}
          ${row(water ? "detail_flow" : "detail_power", rateText)}
          ${energy !== undefined
            ? row(water ? "detail_volume" : "detail_energy", energy === null ? null : this._formatValue(energy))
            : nothing}
          ${info?.created_helper ? row("detail_helper", this._t("created_by")) : nothing}
          ${rest !== undefined
            ? row("detail_untracked", rest === null ? null : this._formatValue(rest))
            : nothing}
        </dl>
        ${issues.length
          ? html`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${issues.map((i) => html`<li class=${i.severity}>${this._issueText(i)}</li>`)}
              </ul>`
          : nothing}
      </section>
    `;
  }

  private _renderFooter(): TemplateResult | typeof nothing {
    if (this._changes.length === 0) {
      return nothing;
    }
    const count = this._validation?.diff.length ?? this._changes.length;
    return html`<div class="footer">
      <span
        >${count === 1
          ? this._t("change_one")
          : this._t("change_other", { count: formatNumber(this.hass, count) })}</span
      >
      <button class="undo-change" title=${this._t("undo_change_hint")} @click=${() => this._undoChange()}>
        ${icon("undo")} ${this._t("undo_change")}
      </button>
      <button @click=${() => this._discard()}>${this._t("discard")}</button>
      <button class="primary" @click=${() => this._openConfirm()}>${this._t("save")}</button>
    </div>`;
  }

  _issueText(issue: Issue): string {
    const key = `issue_${issue.code}`;
    return hasKey(key)
      ? this._t(key, { unit: String(issue.details.unit ?? "") })
      : issue.code;
  }

  /** One line of a diff; water devices are marked as such. */
  _diffText(entry: DiffEntry): string {
    const text = this._diffLine(entry);
    return entry.kind === "water" ? this._t("diff_water", { text }) : text;
  }

  private _diffLine(entry: DiffEntry): string {
    const kind = entry.kind ?? "electricity";
    const devices = this.draftOf(kind);
    const saved = (kind === "water"
      ? this._snapshot?.prefs.device_consumption_water
      : this._snapshot?.prefs.device_consumption) ?? [];
    const name = this._name(entry.stat, entry.kind ? devices : undefined);
    const to = entry.to ? this._name(entry.to, devices) : "";
    switch (entry.type) {
      case "added":
        return entry.parent
          ? this._t("diff_added_under", { name, to: this._name(entry.parent, devices) })
          : this._t("diff_added", { name });
      case "removed":
        return this._t("diff_removed", { name: this._name(entry.stat, saved) });
      case "moved":
        return entry.to ? this._t("diff_moved", { name, to }) : this._t("diff_moved_top", { name });
      case "renamed": {
        // The draft already carries the new name, so name the device as saved.
        const before = entry.from || this._name(entry.stat, saved);
        return entry.to
          ? this._t("diff_renamed", { name: before, to: entry.to })
          : this._t("diff_renamed_reset", { name: before });
      }
      case "source_added":
      case "source_removed":
        return this._t(entry.type === "source_added" ? "diff_source_added" : "diff_source_removed", {
          name,
          role: this._roleLabel(entry.role),
        });
      default:
        return this._t(kind === "water" ? "diff_rate_water" : "diff_rate", { name });
    }
  }

  _roleLabel(role: string | undefined): string {
    const key = `role_${role ?? ""}`;
    return hasKey(key) ? this._t(key) : (role ?? "");
  }

  /** A list of free sensors to pick from, for source dialogs. */
  private _sensorList(exclude: string[], pick: (stat: string) => void): TemplateResult {
    // Dialogs list all free sensors; the search box only filters its own column.
    const sensors = this._freeCandidates("").filter((c) => !exclude.includes(c.stat));
    if (sensors.length === 0) {
      return html`<p class="empty">${this._t("no_candidates")}</p>`;
    }
    return html`<ul class="targets">
      ${sensors.map(
        (c) => html`<li>
          <button class="target" data-target=${c.stat} @click=${() => pick(c.stat)}>
            ${c.name || c.stat}
          </button>
        </li>`,
      )}
    </ul>`;
  }

  /** The list of changes, problems and what Home Assistant rejects. */
  private _renderCheck(result: ValidateResult): TemplateResult {
    const errors = result.issues.filter((i) => i.severity === "error");
    const warnings = result.issues.filter((i) => i.severity === "warning");
    const issueList = (issues: Issue[]) =>
      html`<ul class="issues">
        ${issues.map((i) => html`<li class=${i.severity}>${this._name(i.stat)}: ${this._issueText(i)}</li>`)}
      </ul>`;
    return html`<ul class="diff">
        ${result.diff.map((entry) => html`<li>${this._diffText(entry)}</li>`)}
      </ul>
      ${errors.length ? html`<p>${this._t("confirm_errors")}</p>${issueList(errors)}` : nothing}
      ${warnings.length ? html`<p>${this._t("confirm_warnings")}</p>${issueList(warnings)}` : nothing}
      ${result.rejected
        ? html`<p>${this._t("confirm_rejected")}</p>
            <p class="rejected">${result.rejected}</p>`
        : nothing}`;
  }

  _summaryText(summary: Record<string, number>): string {
    return Object.entries(summary)
      .map(([type, count]) => {
        const key = `summary_${type}`;
        return hasKey(key) ? this._t(key, { count: String(count) }) : `${type}: ${count}`;
      })
      .join(", ");
  }

  private _renderDialog(): TemplateResult {
    return html`<dialog
      @close=${(event: Event) => {
        // The close event arrives later; a dialog opened meanwhile stays open.
        if (!(event.target as HTMLDialogElement).open) {
          this._dialog = null;
        }
      }}
      @cancel=${() => {
        this._dialog = null;
      }}
    >
      ${this._dialog ? this._renderDialogContent(this._dialog) : nothing}
    </dialog>`;
  }

  private _close(): void {
    this._dialog = null;
  }

  private _targetList(
    targets: (string | null)[],
    pick: (target: string | null) => void,
  ): TemplateResult {
    if (targets.length === 0) {
      return html`<p class="empty">${this._t("no_targets")}</p>`;
    }
    return html`<ul class="targets">
      ${targets.map(
        (target) => html`<li>
          <button class="target" data-target=${target ?? HOME} @click=${() => pick(target)}>
            ${target === null ? this._t("top_level") : this._name(target)}
          </button>
        </li>`,
      )}
    </ul>`;
  }

  private _renderDialogContent(dialog: Dialog): TemplateResult {
    const devices = this.draft;
    switch (dialog.kind) {
      case "actions": {
        const name = this._name(dialog.stat, devices);
        return html`<h2>${name}</h2>
          <div class="dialog-actions column-actions">
            <button @click=${() => (this._dialog = { kind: "move", stat: dialog.stat })}>
              ${this._t("move")}
            </button>
            <button
              @click=${() => {
                this._renameValue = devices.find((d) => d.stat_consumption === dialog.stat)?.name ?? "";
                this._dialog = { kind: "rename", stat: dialog.stat };
              }}
            >
              ${this._t("rename")}
            </button>
            <button
              class="danger"
              @click=${() => {
                this._close();
                if (this._selected === dialog.stat) {
                  this._selected = null;
                }
                this._change({ type: "remove", stat: dialog.stat, ...this._kind() });
              }}
            >
              ${this._t("remove")}
            </button>
            ${devices.some((d) => d.included_in_stat === dialog.stat)
              ? html`<p class="hint">${this._t("remove_hint")}</p>`
              : nothing}
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      }
      case "move": {
        const name = this._name(dialog.stat, devices);
        const targets: (string | null)[] = [
          ...(canMove(devices, dialog.stat, null) ? [null] : []),
          ...moveTargets(devices, dialog.stat),
        ];
        return html`<h2>${this._t("move_title", { name })}</h2>
          ${this._targetList(targets, (parent) => {
            this._close();
            this._change({ type: "move", stat: dialog.stat, parent, ...this._kind() });
          })}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      }
      case "add": {
        const candidate = this._candidates().find((c) => c.stat === dialog.stat);
        const name = candidate?.name || dialog.stat;
        const targets: (string | null)[] = [null, ...devices.map((d) => d.stat_consumption)];
        return html`<h2>${this._t("add_title", { name })}</h2>
          ${candidate?.power
            ? html`<p class="hint">
                ${this._t(this._tab === "water" ? "with_flow" : "with_power", { entity: candidate.power })}
              </p>`
            : nothing}
          ${this._targetList(targets, (parent) => {
            this._close();
            this._addCandidate(dialog.stat, parent);
          })}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      }
      case "rename": {
        const name = this._name(dialog.stat, devices);
        return html`<h2>${this._t("rename_title", { name })}</h2>
          <label
            >${this._t("name_label")}
            <input
              type="text"
              .value=${this._renameValue}
              placeholder=${this._snapshot?.stats[dialog.stat]?.name ?? ""}
              @input=${(e: Event) => (this._renameValue = (e.target as HTMLInputElement).value)}
            />
          </label>
          <p class="hint">${this._t("name_hint")}</p>
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              @click=${() => {
                this._close();
                this._change({
                  type: "rename",
                  stat: dialog.stat,
                  name: this._renameValue.trim() || null,
                  ...this._kind(),
                });
              }}
            >
              ${this._t("ok")}
            </button>
          </div>`;
      }
      case "confirm": {
        const result = dialog.result;
        if (result === null) {
          return html`<h2>${this._t("confirm_title")}</h2>
            <p>${this._t("checking")}</p>`;
        }
        return html`<h2>${this._t("confirm_title")}</h2>
          ${this._renderCheck(result)}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!result.valid || this._busy}
              @click=${() => this._save()}
            >
              ${this._busy ? this._t("saving") : this._t("save")}
            </button>
          </div>`;
      }
      case "backups":
        return html`<h2>${this._t("backups_title")}</h2>
          <p class="hint">${this._t("backups_hint")}</p>
          <div class="dialog-actions transfer-actions">
            <button @click=${() => this._export()}>${this._t("export_current")}</button>
            <button @click=${() => this._pickImportFile()}>${this._t("import_file")}</button>
          </div>
          ${dialog.entries.length === 0
            ? html`<p class="empty">${this._t("backups_empty")}</p>`
            : html`<ul class="backups">
                ${dialog.entries.map(
                  (backup) => html`<li>
                    <div class="candidate-text">
                      <span class="node-name">${formatDateTime(this.hass, backup.created)}</span>
                      <span class="sub"
                        >${this._summaryText(backup.summary)}${backup.user_name
                          ? ` · ${this._t("backup_by", { user: backup.user_name })}`
                          : ""}</span
                      >
                    </div>
                    <div class="backup-actions">
                      <button @click=${() => this._export(backup)}>${this._t("export")}</button>
                      <button
                        @click=${() => (this._dialog = { kind: "restore", backup, undo: false })}
                      >
                        ${this._t("restore")}
                      </button>
                    </div>
                  </li>`,
                )}
              </ul>`}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("close")}</button>
          </div>`;
      case "restore": {
        const date = formatDateTime(this.hass, dialog.backup.created);
        return html`<h2>${this._t(dialog.undo ? "undo" : "restore")}</h2>
          <p>${this._t(dialog.undo ? "undo_confirm" : "restore_confirm", { date })}</p>
          ${this._changes.length ? html`<p class="warning">${this._t("draft_lost")}</p>` : nothing}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${() => this._restore(dialog.backup)}
            >
              ${this._t("restore")}
            </button>
          </div>`;
      }
      case "import": {
        const result = dialog.result;
        const title = html`<h2>${this._t("import_title", { file: dialog.file })}</h2>`;
        if (result === null) {
          return html`${title}
            <p>${this._t("checking")}</p>`;
        }
        return html`${title}
          ${result.changed ? this._renderCheck(result) : html`<p>${this._t("import_unchanged")}</p>`}
          ${result.changed && this._changes.length ? html`<p class="warning">${this._t("draft_lost")}</p>` : nothing}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!result.valid || !result.changed || this._busy}
              @click=${() => this._import(dialog.document)}
            >
              ${this._t("import")}
            </button>
          </div>`;
      }
      case "source": {
        // Gas is only shown: no assign role, nothing to change.
        const assign = assignRole(dialog.role);
        const replaces = assign === "import" || assign === "export" || assign === "water";
        const source = this.draftSources.find(
          (s) => s.stat_energy_from === dialog.stat || s.stat_energy_to === dialog.stat,
        );
        const lastMeter =
          source?.type === "grid" &&
          !(source.stat_energy_from && source.stat_energy_to) &&
          !source.stat_rate &&
          !source.power_config;
        return html`<h2>${dialog.label}</h2>
          ${dialog.stat ? html`<p>${this._name(dialog.stat)}</p>` : nothing}
          ${dialog.stat && assign && lastMeter ? html`<p class="hint">${this._t("source_last_meter")}</p>` : nothing}
          <div class="dialog-actions column-actions">
            ${assign
              ? html`<button
                  @click=${() =>
                    (this._dialog = { kind: "assign", role: assign, replace: replaces ? dialog.stat : null })}
                >
                  ${this._t(dialog.stat && assign !== "production" && assign !== "battery" ? "source_replace" : "source_assign")}
                </button>`
              : nothing}
            ${dialog.stat && assign
              ? html`<button
                  class="danger"
                  @click=${() => {
                    this._close();
                    this._change({ type: "unassign_source", stat: dialog.stat! });
                  }}
                >
                  ${this._t("source_remove")}
                </button>`
              : nothing}
            <button
              @click=${() => {
                this._close();
                navigate("/config/energy");
              }}
            >
              ${this._t("open_energy_settings")}
            </button>
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      }
      case "assign":
        return html`<h2>${this._t("assign_title", { role: this._roleLabel(dialog.role) })}</h2>
          <p class="hint">${this._t(dialog.role === "water" ? "assign_hint_water" : "assign_hint")}</p>
          ${this._sensorList([], (stat) => this._assign(dialog.role, stat, dialog.replace ?? null))}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      case "battery":
        return html`<h2>${this._t("battery_title")}</h2>
          <p class="hint">${this._t("battery_hint", { name: this._name(dialog.discharge) })}</p>
          ${this._sensorList([dialog.discharge], (stat) => {
            this._close();
            this._change({
              type: "assign_source",
              role: "battery",
              stat: dialog.discharge,
              stat_to: stat,
            });
          })}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      case "integral": {
        const name = this._info(dialog.stat)?.name || dialog.stat;
        const water = this._tab === "water";
        return html`<h2>${this._t(water ? "create_water_meter_title" : "create_meter_title", { name })}</h2>
          <p>
            ${this._t(water ? "create_water_meter_text" : "create_meter_text", {
              helper: this._meterName(dialog.stat),
            })}
          </p>
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${() => this._createMeter(dialog.stat)}
            >
              ${this._busy ? this._t("creating") : this._t("create_meter")}
            </button>
          </div>`;
      }
      case "menu":
        return html`<div class="dialog-actions column-actions">
          <button ?disabled=${!this._snapshot} @click=${() => (this._dialog = { kind: "candidates" })}>
            ${this._t("free_sensors")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${() => this._openBackups(true)}>
            ${icon("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${() => this._openBackups(false)}>
            ${icon("history")} ${this._t("backups")}
          </button>
          <button
            @click=${() => {
              this._close();
              this._reload();
            }}
          >
            ${icon("refresh")} ${this._t("reload")}
          </button>
          <button @click=${() => this._close()}>${this._t("close")}</button>
        </div>`;
      case "candidates":
        return html`${this._renderCandidates()}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("close")}</button>
          </div>`;
      case "details":
        return html`${this._renderDetails()}
          <div class="dialog-actions">
            ${this._selected
              ? html`<button
                  @click=${() => (this._dialog = { kind: "actions", stat: this._selected! })}
                >
                  ${this._t("actions", { name: this._name(this._selected) })}
                </button>`
              : nothing}
            <button @click=${() => this._close()}>${this._t("close")}</button>
          </div>`;
    }
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      box-sizing: border-box;
      container: panel / inline-size;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--header-height, 56px);
      padding: 0 12px;
      background: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color, #fff));
      position: sticky;
      top: 0;
      z-index: 2;
    }
    h1 {
      flex: 1;
      margin: 0 4px;
      font-size: 20px;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .header button {
      color: inherit;
      border-color: transparent;
      background: transparent;
    }
    button {
      font: inherit;
      color: var(--primary-color);
      background: transparent;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button.primary {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    button.danger {
      color: var(--error-color);
    }
    button.icon {
      border: none;
      padding: 4px 8px;
      line-height: 1;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .mdi {
      width: 20px;
      height: 20px;
      fill: currentColor;
      flex: none;
    }
    .home .mdi {
      color: var(--secondary-text-color);
    }
    button.link {
      border: none;
      padding: 0;
      text-decoration: underline;
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 12px 16px 0;
    }
    .tabs button {
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: var(--secondary-text-color);
      padding: 8px 12px;
    }
    .tabs button.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }
    .content {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(360px, 3fr) minmax(240px, 1fr);
      grid-template-areas: "free main details";
      gap: 16px;
      padding: 16px;
      align-items: start;
    }
    .content > .free {
      grid-area: free;
    }
    .content > .main {
      grid-area: main;
    }
    .content > .details {
      grid-area: details;
    }
    /* Not enough room for three columns: details go below the free sensors. */
    @container panel (max-width: 960px) {
      .content {
        grid-template-columns: minmax(220px, 1fr) minmax(0, 2.5fr);
        grid-template-areas:
          "free main"
          "details main";
      }
    }
    .content.narrow {
      grid-template-columns: 1fr;
      grid-template-areas: "main";
      padding: 8px;
      gap: 8px;
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .card {
      background: var(--card-background-color, var(--ha-card-background));
      border-radius: var(--ha-card-border-radius, 12px);
      border: 1px solid var(--divider-color);
      padding: 12px 16px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    h3 {
      font-size: 15px;
      margin: 12px 0 4px;
    }
    .hint,
    .sub,
    .empty {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    .message {
      padding: 32px 16px;
      text-align: center;
    }
    .error,
    .issues .error {
      color: var(--error-color);
    }
    .warning,
    .issues .warning {
      color: var(--warning-color);
    }
    .sources {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .source {
      display: flex;
      flex-direction: column;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .source-role {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .tree ul {
      padding-left: 20px;
      border-left: 1px dashed var(--divider-color);
      margin-left: 12px;
    }
    .home,
    .node,
    .untracked {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      min-height: 32px;
    }
    .home {
      margin-top: 8px;
      font-weight: 500;
      border: 1px dashed transparent;
    }
    .node {
      cursor: grab;
    }
    .node:hover {
      background: var(--secondary-background-color);
    }
    .node.selected {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
    }
    .drop {
      outline: 2px dashed var(--primary-color);
      outline-offset: -2px;
    }
    .node.has-error .node-name {
      color: var(--error-color);
    }
    .untracked {
      color: var(--secondary-text-color);
      font-style: italic;
    }
    .toggle {
      width: 24px;
      flex: none;
      text-align: center;
    }
    .node-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .node-power {
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      background: var(--warning-color);
      color: #fff;
    }
    .has-error .badge {
      background: var(--error-color);
    }
    input[type="search"],
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      margin: 8px 0;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font: inherit;
    }
    .candidates li,
    .backups li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid var(--divider-color);
    }
    .backup-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }
    /* Two long buttons: they wrap on phones instead of overflowing. */
    .transfer-actions {
      flex-wrap: wrap;
    }
    .candidate {
      cursor: grab;
    }
    .candidate-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    /* Names wrap in narrow columns; the line below them is cut. */
    .candidate-text .node-name {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .candidate-text .sub {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    dl {
      display: grid;
      /* Long labels wrap instead of squeezing the values to one letter. */
      grid-template-columns: fit-content(45%) minmax(0, 1fr);
      gap: 4px 12px;
      margin: 12px 0 0;
      font-size: 14px;
    }
    dt {
      color: var(--secondary-text-color);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .diagram-card {
      padding-bottom: 0;
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .diagram-card .card-header {
      flex-wrap: wrap;
    }
    .periods,
    .orientation {
      display: flex;
    }
    .periods {
      margin-left: auto;
    }
    .orientation {
      margin-right: 4px;
    }
    .periods button,
    .orientation button {
      border-radius: 0;
      margin-left: -1px;
      padding: 4px 10px;
      color: var(--primary-text-color);
    }
    .periods button:first-child,
    .orientation button:first-child {
      border-radius: 8px 0 0 8px;
    }
    .periods button:last-child,
    .orientation button:last-child {
      border-radius: 0 8px 8px 0;
    }
    .periods button.active,
    .orientation button.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .hint .loading {
      font-style: italic;
    }
    .toolbar button.icon {
      font-size: 18px;
      min-width: 32px;
      border: 1px solid var(--divider-color);
    }
    .viewport {
      /* Contrast colours, derived from the theme so light and dark both work. */
      --block-bg: var(--card-background-color, var(--primary-background-color));
      --block-border: color-mix(in srgb, var(--primary-text-color) 35%, transparent);
      --canvas-bg: color-mix(in srgb, var(--primary-text-color) 4%, var(--primary-background-color));
      position: relative;
      overflow: hidden;
      /* Window height minus header, tabs, card header, hint and search. */
      height: calc(100vh - 365px);
      min-height: 360px;
      margin: 8px -16px 0;
      border-top: 1px solid var(--divider-color);
      touch-action: none;
      cursor: grab;
      background-color: var(--canvas-bg);
      background-image: radial-gradient(
        color-mix(in srgb, var(--primary-text-color) 18%, transparent) 1px,
        transparent 1px
      );
      background-size: 20px 20px;
    }
    .narrow .viewport {
      height: calc(100vh - 290px);
    }
    .canvas {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }
    .edges {
      position: absolute;
      left: 0;
      top: 0;
      overflow: visible;
      pointer-events: none;
    }
    .block {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 4px 6px 12px;
      border-radius: 10px;
      border: 1px solid var(--block-border);
      background: var(--block-bg);
      color: var(--primary-text-color);
      font-size: 14px;
      text-align: left;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    .block-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-self: stretch;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }
    .block .node-name {
      flex: none;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.25;
      font-size: 14px;
      font-weight: 500;
    }
    .block .sub {
      font-size: 13px;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .block.device {
      cursor: grab;
      border-left: 5px solid var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 10%, var(--block-bg));
    }
    .block.device.selected {
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 25%, var(--block-bg));
    }
    .block.home {
      border: 2px solid var(--primary-text-color);
      font-size: 15px;
    }
    .block.home .mdi {
      color: var(--primary-text-color);
    }
    .block.source {
      border: 1px solid var(--source-color);
      border-left: 5px solid var(--source-color);
      background: color-mix(in srgb, var(--source-color) 14%, var(--block-bg));
      padding-right: 10px;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      justify-content: flex-start;
    }
    .block.placeholder {
      border: 2px dashed var(--source-color);
      background: color-mix(in srgb, var(--source-color) 8%, transparent);
      box-shadow: none;
    }
    .block.placeholder .node-name {
      color: var(--source-color);
    }
    .block.untracked {
      border: 2px dashed var(--block-border);
      background: transparent;
      box-shadow: none;
    }
    .block.untracked .node-name {
      font-style: italic;
      font-weight: 400;
      color: var(--secondary-text-color);
    }
    .block .toggle {
      width: auto;
      padding: 2px 4px;
      color: var(--primary-text-color);
    }
    .dragging .block.device:not(.can-drop):not(.dragged),
    .dragging .block.home:not(.can-drop) {
      opacity: 0.45;
    }
    .block.can-drop {
      outline: 2px dashed var(--primary-color);
      outline-offset: 3px;
    }
    .block.drop {
      outline: 3px solid var(--primary-color);
      outline-offset: 3px;
      background: color-mix(in srgb, var(--primary-color) 35%, var(--block-bg));
    }
    .block.dragged {
      opacity: 0.35;
      border-style: dashed;
    }
    .block.has-error {
      border-color: var(--error-color);
    }
    .block.dim {
      opacity: 0.35;
    }
    .block.match {
      outline: 2px solid var(--primary-color);
      outline-offset: 3px;
    }
    .block.match.current {
      outline-width: 4px;
    }
    .find {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .find input {
      flex: 0 1 260px;
      min-width: 0;
    }
    .find-count {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    /* Sticks to the bottom of the panel, next to (not under) the sidebar. */
    .footer {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      background: var(--card-background-color, var(--primary-background-color));
      border-top: 1px solid var(--divider-color);
      z-index: 2;
    }
    .footer span {
      flex: 1;
    }
    dialog label {
      display: block;
      margin-top: 12px;
    }
    .rejected {
      color: var(--error-color);
      overflow-wrap: anywhere;
    }
    dialog {
      border: none;
      border-radius: 16px;
      padding: 20px;
      width: min(480px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      background: var(--card-background-color, var(--primary-background-color));
      color: var(--primary-text-color);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
    dialog .card {
      border: none;
      padding: 0;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .column-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .targets {
      max-height: 50vh;
      overflow: auto;
      margin-top: 12px;
    }
    .targets button {
      width: 100%;
      text-align: left;
      margin-bottom: 4px;
      color: var(--primary-text-color);
    }
    .diff li,
    .issues li {
      padding: 2px 0;
    }
    .diff {
      margin: 12px 0;
      padding-left: 18px;
      list-style: disc;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 80px;
      transform: translateX(-50%);
      max-width: calc(100vw - 32px);
      padding: 10px 16px;
      border-radius: 8px;
      background: var(--primary-text-color);
      color: var(--primary-background-color);
      z-index: 3;
    }
  `;
}

if (!customElements.get(PANEL_TAG)) {
  customElements.define(PANEL_TAG, EnergyFlowMapperPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    [PANEL_TAG]: EnergyFlowMapperPanel;
  }
}
