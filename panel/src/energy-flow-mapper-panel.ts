import { css, html, LitElement, nothing, svg, type PropertyValues, type TemplateResult } from "lit";

import {
  applyChanges,
  buildTree,
  canMove,
  displayName,
  moveTargets,
  powerInWatts,
  sourceRows,
  type TreeNode,
  untracked,
} from "./draft";
import { icon } from "./icons";
import {
  arrowHead,
  type Block,
  type Edge,
  edgePath,
  HOME_ID,
  layout,
  strokeWidth,
} from "./layout";
import {
  formatDateTime,
  formatNumber,
  formatPower,
  hasKey,
  localize,
  type StringKey,
} from "./localize";
import type {
  BackupEntry,
  Candidate,
  Change,
  Device,
  DiffEntry,
  HomeAssistant,
  Issue,
  SaveResult,
  Snapshot,
  ValidateResult,
  WSError,
} from "./types";

export const PANEL_TAG = "energy-flow-mapper-panel";
export const DOMAIN = "energy_flow_mapper";
export const TOAST_MS = 4000;
const HOME = "__home__";
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;

interface Zoom {
  x: number;
  y: number;
  k: number;
}

/** CSS colour of a source edge or block by its role. */
const SOURCE_COLORS: Record<string, string> = {
  import: "var(--energy-grid-consumption-color, #488fc2)",
  export: "var(--energy-grid-return-color, #8353d1)",
  production: "var(--energy-solar-color, #ff9800)",
  battery: "var(--energy-battery-out-color, #4db6ac)",
  discharge: "var(--energy-battery-out-color, #4db6ac)",
  charge: "var(--energy-battery-in-color, #f06292)",
  consumption: "var(--energy-gas-color, #8e021b)",
};

type Dragged = { kind: "device" | "candidate"; stat: string };

type Dialog =
  | { kind: "actions"; stat: string }
  | { kind: "move"; stat: string }
  | { kind: "add"; stat: string }
  | { kind: "rename"; stat: string }
  | { kind: "confirm"; result: ValidateResult | null }
  | { kind: "backups"; entries: BackupEntry[] }
  | { kind: "restore"; backup: BackupEntry; undo: boolean }
  | { kind: "candidates" }
  | { kind: "details" }
  | { kind: "menu" };

/** The error message of a failed WebSocket call, translated if possible. */
export function errorText(hass: HomeAssistant | undefined, err: unknown): string {
  const error = (err ?? {}) as WSError;
  const key = `error_${error.translation_key ?? ""}`;
  if (error.translation_key && hasKey(key)) {
    return localize(hass, key);
  }
  return localize(hass, "error_unknown", { message: error.message ?? String(err) });
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

  private _loading = false;
  private _validateRequest = 0;
  private _toastTimer: ReturnType<typeof setTimeout> | undefined;
  private _fitted = false;
  private _pointers = new Map<number, { x: number; y: number }>();

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
    await this._validate();
  }

  /** The device list with the draft applied. */
  get draft(): Device[] {
    return applyChanges(this._snapshot?.prefs.device_consumption ?? [], this._changes);
  }

  private _name(stat: string, devices: Device[] = this.draft): string {
    return displayName(stat, devices, {
      ...this._snapshot?.stats,
      ...Object.fromEntries((this._snapshot?.candidates ?? []).map((c) => [c.stat, c])),
    });
  }

  private _issues(): Issue[] {
    return this._validation?.issues ?? this._snapshot?.issues ?? [];
  }

  private _issuesFor(stat: string): Issue[] {
    return this._issues().filter((issue) => issue.stat === stat);
  }

  _change(change: Change): void {
    this._changes = [...this._changes, change];
    void this._validate();
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

  _discard(): void {
    this._changes = [];
    this._validation = null;
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

  private _showToast(text: string): void {
    this._toast = text;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = null;
    }, TOAST_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._toastTimer);
  }

  // --- drag and drop --------------------------------------------------------

  /** Can the dragged item be dropped on `target` (HOME: top level)? */
  _canDrop(target: string): boolean {
    const dragged = this._dragged;
    if (dragged === null) {
      return false;
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
    const parent = target === HOME ? null : target;
    if (dragged.kind === "candidate") {
      this._addCandidate(dragged.stat, parent);
    } else {
      this._change({ type: "move", stat: dragged.stat, parent });
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
    const { k } = this._zoom;
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
    transfer.setDragImage(
      ghost,
      Math.min(width, Math.max(0, event.clientX - rect.left)),
      Math.min(height, Math.max(0, event.clientY - rect.top)),
    );
    // The browser takes its snapshot synchronously; the copy can go right after.
    setTimeout(() => ghost.remove(), 0);
  }

  _addCandidate(stat: string, parent: string | null): void {
    const candidate = this._snapshot?.candidates.find((c) => c.stat === stat);
    this._change({
      type: "add",
      stat,
      parent,
      stat_rate: candidate?.power ?? null,
    });
    this._selected = stat;
  }

  /** Free sensors that are not added in the draft yet. */
  _freeCandidates(): Candidate[] {
    const used = new Set(this.draft.map((d) => d.stat_consumption));
    const search = this._search.trim().toLowerCase();
    return (this._snapshot?.candidates ?? []).filter(
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
    if (!this._fitted && this._snapshot && this._view === "diagram") {
      this._fitted = this.fit();
    }
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
      <div class="content ${this.narrow ? "narrow" : ""}">
        ${this.narrow ? nothing : html`<aside class="column">${this._renderCandidates()}</aside>`}
        <main class="column main">
          ${this._view === "list"
            ? html`${this._renderSources()} ${this._renderTree()}`
            : this._renderDiagram()}
        </main>
        ${this.narrow ? nothing : html`<aside class="column">${this._renderDetails()}</aside>`}
      </div>
    `;
  }

  // --- diagram --------------------------------------------------------------

  private _powerMap(devices: Device[]): Map<string, number | null> {
    return new Map(
      devices.map((d) => [d.stat_consumption, this.hass ? powerInWatts(this.hass, d.stat_rate) : null]),
    );
  }

  /** The diagram layout of the current draft. */
  diagramLayout() {
    const devices = this.draft;
    const roots = buildTree(devices);
    const power = this._powerMap(devices);
    return layout(
      roots,
      sourceRows(this._snapshot?.prefs.energy_sources ?? []),
      power,
      untracked(roots, power),
      this._collapsed,
    );
  }

  private _viewport(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".viewport");
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
    const viewport = this._viewport();
    this.zoomAt((viewport?.clientWidth ?? 0) / 2, (viewport?.clientHeight ?? 0) / 2, factor);
  }

  private _local(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this._viewport()?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  _onWheel(event: WheelEvent): void {
    event.preventDefault();
    const { x, y } = this._local(event);
    this.zoomAt(x, y, Math.exp(-event.deltaY * 0.0015));
  }

  _onPointerDown(event: PointerEvent): void {
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
    const power = this._powerMap(devices);
    const rest = untracked(buildTree(devices), power);
    const known = buildTree(devices)
      .map((n) => power.get(n.stat))
      .filter((v): v is number => v != null);
    const measured = known.length ? known.reduce((a, b) => a + b, 0) : null;
    const { x, y, k } = this._zoom;
    return html`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t("diagram")}</h2>
          <div class="toolbar">
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
            <button @click=${() => this.fit()}>${this._t("fit")}</button>
          </div>
        </div>
        <p class="hint">${this._t("devices_hint")} ${this._t("zoom_hint")}</p>
        <div
          class="viewport"
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
    return svg`<g class="edge edge-${edge.kind}" data-from=${edge.from} data-to=${edge.to}>
      <path
        d=${edgePath(from, to)}
        fill="none"
        stroke=${color}
        stroke-width=${strokeWidth(edge.power, maxPower)}
        stroke-dasharray=${dashed ? "4 4" : "none"}
        stroke-linecap="round"
      ></path>
      <polygon points=${arrowHead(from, to)} fill=${color}></polygon>
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
          class="block home ${this._dropTarget === HOME ? "drop" : ""}"
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
                  >${this._t("home_measured", { power: formatPower(this.hass, measured) })}</span
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
        return html`<button
          class="block source ${block.kind}"
          style="${style};--source-color:${SOURCE_COLORS[role] ?? "var(--divider-color)"}"
          title=${this._t("sources_hint")}
          @click=${() => navigate("/config/energy")}
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
            <span class="sub">${value == null ? this._t("none") : formatPower(this.hass, value)}</span>
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
    const watts = this.hass ? powerInWatts(this.hass, device?.stat_rate) : null;
    const info =
      this._snapshot?.stats[stat] ?? this._snapshot?.candidates.find((c) => c.stat === stat);
    const sub = [watts === null ? null : formatPower(this.hass, watts), info?.area_name]
      .filter(Boolean)
      .join(" · ");
    const collapsed = this._collapsed.has(stat);
    return html`<div
      class="block device node ${this._selected === stat ? "selected" : ""} ${this._dropTarget ===
      stat
        ? "drop"
        : ""} ${hasError ? "has-error" : issues.length ? "has-warning" : ""}"
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
    const rows = sourceRows(this._snapshot?.prefs.energy_sources ?? []);
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
    const power = new Map<string, number | null>(
      devices.map((d) => [d.stat_consumption, this.hass ? powerInWatts(this.hass, d.stat_rate) : null]),
    );
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
          <span class="node-power">${watts === null ? nothing : formatPower(this.hass, watts)}</span>
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
                      >${untrackedWatts === null ? this._t("none") : formatPower(this.hass, untrackedWatts)}</span
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
        <p class="hint">${this._t("free_sensors_hint")}</p>
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${(e: Event) => (this._search = (e.target as HTMLInputElement).value)}
        />
        ${candidates.length === 0
          ? html`<p class="empty">${this._t("no_candidates")}</p>`
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
                    <span class="sub">${[c.area_name, c.device_name].filter(Boolean).join(" · ") || c.stat}</span>
                  </div>
                  <button @click=${() => (this._dialog = { kind: "add", stat: c.stat })}>
                    ${this._t("add")}
                  </button>
                </li>`,
              )}
            </ul>`}
      </section>
    `;
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
    const info = this._snapshot?.stats[stat] ?? this._snapshot?.candidates.find((c) => c.stat === stat);
    const watts = this.hass ? powerInWatts(this.hass, device.stat_rate) : null;
    const roots = buildTree(devices);
    const power = new Map<string, number | null>(
      devices.map((d) => [d.stat_consumption, this.hass ? powerInWatts(this.hass, d.stat_rate) : null]),
    );
    const rest = untracked(roots, power).get(stat);
    const issues = this._issuesFor(stat);
    const row = (label: StringKey, value: string | null | undefined) =>
      html`<dt>${this._t(label)}</dt>
        <dd>${value || this._t("none")}</dd>`;
    return html`
      <section class="card">
        <div class="card-header"><h2>${this._name(stat, devices)}</h2></div>
        <dl>
          ${row("detail_statistic", stat)} ${row("detail_power_sensor", device.stat_rate)}
          ${row("detail_device", info?.device_name)} ${row("detail_area", info?.area_name)}
          ${row("detail_power", watts === null ? null : formatPower(this.hass, watts))}
          ${rest !== undefined
            ? row("detail_untracked", rest === null ? null : formatPower(this.hass, rest))
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

  _diffText(entry: DiffEntry): string {
    const name = this._name(entry.stat);
    const to = entry.to ? this._name(entry.to) : "";
    switch (entry.type) {
      case "added":
        return entry.parent
          ? this._t("diff_added_under", { name, to: this._name(entry.parent) })
          : this._t("diff_added", { name });
      case "removed":
        return this._t("diff_removed", {
          name: this._name(entry.stat, this._snapshot?.prefs.device_consumption),
        });
      case "moved":
        return entry.to ? this._t("diff_moved", { name, to }) : this._t("diff_moved_top", { name });
      case "renamed":
        return entry.to
          ? this._t("diff_renamed", { name: entry.from || this._name(entry.stat), to: entry.to })
          : this._t("diff_renamed_reset", { name });
      default:
        return this._t("diff_rate", { name });
    }
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
      @close=${() => {
        this._dialog = null;
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
                this._change({ type: "remove", stat: dialog.stat });
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
            this._change({ type: "move", stat: dialog.stat, parent });
          })}
          <div class="dialog-actions">
            <button @click=${() => this._close()}>${this._t("cancel")}</button>
          </div>`;
      }
      case "add": {
        const candidate = this._snapshot?.candidates.find((c) => c.stat === dialog.stat);
        const name = candidate?.name || dialog.stat;
        const targets: (string | null)[] = [null, ...devices.map((d) => d.stat_consumption)];
        return html`<h2>${this._t("add_title", { name })}</h2>
          ${candidate?.power
            ? html`<p class="hint">${this._t("with_power", { entity: candidate.power })}</p>`
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
                this._change({ type: "rename", stat: dialog.stat, name: this._renameValue.trim() || null });
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
        const errors = result.issues.filter((i) => i.severity === "error");
        const warnings = result.issues.filter((i) => i.severity === "warning");
        const issueList = (issues: Issue[]) =>
          html`<ul class="issues">
            ${issues.map((i) => html`<li class=${i.severity}>${this._name(i.stat)}: ${this._issueText(i)}</li>`)}
          </ul>`;
        return html`<h2>${this._t("confirm_title")}</h2>
          <ul class="diff">
            ${result.diff.map((entry) => html`<li>${this._diffText(entry)}</li>`)}
          </ul>
          ${errors.length ? html`<p>${this._t("confirm_errors")}</p>${issueList(errors)}` : nothing}
          ${warnings.length ? html`<p>${this._t("confirm_warnings")}</p>${issueList(warnings)}` : nothing}
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
                    <button
                      @click=${() => (this._dialog = { kind: "restore", backup, undo: false })}
                    >
                      ${this._t("restore")}
                    </button>
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
      display: block;
      min-height: 100vh;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      padding-bottom: 72px;
      box-sizing: border-box;
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
    .content {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(320px, 2fr) minmax(220px, 1fr);
      gap: 16px;
      padding: 16px;
      align-items: start;
    }
    .content.narrow {
      grid-template-columns: 1fr;
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
    .candidate {
      cursor: grab;
    }
    .candidate-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
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
      gap: 4px;
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
      height: calc(100vh - 250px);
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
      height: calc(100vh - 230px);
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
    .block.has-error {
      border-color: var(--error-color);
    }
    .footer {
      position: fixed;
      left: var(--mdc-drawer-width, 0);
      right: 0;
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
