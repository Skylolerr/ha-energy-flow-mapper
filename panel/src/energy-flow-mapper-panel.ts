import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";

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

  private _loading = false;
  private _validateRequest = 0;
  private _toastTimer: ReturnType<typeof setTimeout> | undefined;

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
    this._dragged = dragged;
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
        <main class="column main">${this._renderSources()} ${this._renderTree()}</main>
        ${this.narrow ? nothing : html`<aside class="column">${this._renderDetails()}</aside>`}
      </div>
    `;
  }

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
