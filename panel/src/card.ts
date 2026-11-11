// The dashboard card: a read-only view of one device tree, for every user.
// Editing stays in the admin panel. Loaded by card-loader.ts when needed.

import { css, html, LitElement, nothing, svg, type PropertyValues, type TemplateResult } from "lit";

import {
  CARD_EDITOR_TAG,
  CARD_KINDS,
  CARD_ORIENTATIONS,
  CARD_PERIODS,
  CARD_VIEW_TAG,
  cardConfig,
  type CardConfig,
} from "./card-config";
import { buildTree, coverage, homeNow, rateValue, type SourceRole, type TreeNode, untracked, walk } from "./draft";
import {
  arrowHead,
  arrowSize,
  type Block,
  dashPattern,
  type Edge,
  edgePath,
  type Frame,
  HOME_ID,
  layout,
  SOURCE_COLORS,
  strokeWidth,
} from "./layout";
import { type DisplayNode, displayTree, groupBlockId, groupDevices, groupValue, GROUP_PREFIX } from "./groups";
import {
  coverageText,
  errorText,
  formatEnergy,
  formatFlow,
  formatNumber,
  formatPower,
  formatVolume,
  haIssueText,
  localize,
  type StringKey,
} from "./localize";
import type { Device, DeviceKind, Group, HaIssue, HomeAssistant, HomeResult, Issue } from "./types";

const DOMAIN = "energy_flow_mapper";
/** How often the card reads the tree and the period values again. */
export const CARD_REFRESH_MS = 60_000;
/** Space around the diagram, in px of the diagram. */
const PAD = 8;
/** Horizontal padding of the card around the diagram, in px. */
const CARD_PADDING = 32;
/** Smallest scale; a wider diagram scrolls sideways in the card instead. */
export const CARD_MIN_SCALE = 0.5;

/** A device as the card command returns it. */
export interface CardDevice {
  stat: string;
  name: string;
  parent: string | null;
  stat_rate: string | null;
  area: string | null;
}

export interface CardSource {
  type: string;
  role: SourceRole;
  stat: string;
  name: string;
  /** Power sensor of the home meter, for Home now. */
  stat_rate?: string;
}

/** Answer of `energy_flow_mapper/card`; period values only with a period. */
export interface CardData {
  kind: DeviceKind;
  devices: CardDevice[];
  sources: CardSource[];
  water_unit: string;
  energy?: Record<string, number | null>;
  issues?: Issue[];
  home_supported?: boolean;
  /** Groups of the list (display only). */
  groups?: Group[];
  /** Home consumption of the period (electricity). */
  home?: HomeResult;
  /** Home Assistant's own check, only for what the card shows. */
  ha_issues?: HaIssue[];
}

/** Only entities have a history to show; external statistics have none. */
function isEntity(stat: string): boolean {
  return /^[a-z0-9_]+\.[a-z0-9_]+$/.test(stat);
}

/** Every node of a display tree, parents before children. */
function walkDisplay(nodes: DisplayNode[]): DisplayNode[] {
  return nodes.flatMap((n) => [n, ...walkDisplay(n.children)]);
}

/** The device nodes that sit directly in a display node (through its groups). */
function topDevices(node: DisplayNode): TreeNode[] {
  return node.type === "device" ? [node.node] : node.children.flatMap(topDevices);
}

export class EnergyFlowMapperCardView extends LitElement {
  static override properties = {
    hass: { attribute: false },
    config: { attribute: false },
    _data: { state: true },
    _error: { state: true },
    _width: { state: true },
    _collapsed: { state: true },
  };

  declare hass?: HomeAssistant;
  declare config?: CardConfig;
  /** Block ids of the collapsed groups; in memory only, never saved. */
  declare _collapsed: Set<string>;
  /** Groups already met, so only new ones start collapsed. */
  private _seenGroups = new Set<string>();
  declare _data: CardData | null;
  declare _error: string | null;
  declare _width: number;

  private _loaded: string | null = null;
  /** Whether a scrolling diagram was moved to Home yet, and for which orientation. */
  private _centred = false;
  private _orientation: CardConfig["orientation"] | null = null;
  private _request = 0;
  /** Whether Home Assistant's texts for its energy check were requested. */
  private _haTexts = false;
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _resizeObserver?: ResizeObserver;

  constructor() {
    super();
    this._data = null;
    this._error = null;
    this._width = 400;
    this._collapsed = new Set();
  }

  private _t(key: StringKey, placeholders: Record<string, string> = {}): string {
    return localize(this.hass, key, placeholders);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Back on a cached dashboard: the values may be a minute old.
    if (this._loaded !== null) {
      void this._load();
    }
    this._timer = setInterval(() => void this._load(), CARD_REFRESH_MS);
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver ??= new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width) {
          this._width = width;
        }
      });
      this._resizeObserver.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._resizeObserver?.disconnect();
  }

  /** Load again when the list or the period changes, and once hass is there. */
  protected override willUpdate(_changed: PropertyValues<this>): void {
    if (!this.hass || !this.config) {
      return;
    }
    const key = `${this.config.kind}|${this.config.period}`;
    if (key !== this._loaded) {
      this._loaded = key;
      this._data = null;
      this._centred = false;
      this._collapsed = new Set();
      this._seenGroups = new Set();
      void this._load();
    }
    if (this.config.orientation !== this._orientation) {
      this._orientation = this.config.orientation;
      this._centred = false;
    }
  }

  /**
   * A diagram wider than the card starts where Home is: scrolled to the middle,
   * or at the left when it runs from left to right.
   */
  protected override updated(): void {
    const diagram = this.shadowRoot?.querySelector<HTMLElement>(".diagram");
    if (!this._centred && diagram) {
      diagram.scrollLeft = this._orientation === "vertical" ? 0 : (diagram.scrollWidth - diagram.clientWidth) / 2;
      this._centred = true;
    }
  }

  /** Read the tree (and the period values); outdated answers are ignored. */
  async _load(): Promise<void> {
    if (!this.hass || !this.config) {
      return;
    }
    const request = ++this._request;
    const { kind, period } = this.config;
    try {
      const data = await this.hass.callWS<CardData>({
        type: `${DOMAIN}/card`,
        kind,
        ...(period === "now" ? {} : { period }),
      });
      if (request === this._request) {
        this._data = data;
        if (!this._haTexts && data.ha_issues?.length && this.hass.loadBackendTranslation) {
          this._haTexts = true;
          this.hass
            .loadBackendTranslation("issues", "energy")
            .then(() => this.requestUpdate())
            .catch(() => {
              this._haTexts = false;
            });
        }
        this._error = null;
      }
    } catch (err) {
      if (request === this._request) {
        this._error = errorText(this.hass, err);
      }
    }
  }

  /** The devices as entries of the energy dashboard, for the tree functions. */
  private _devices(): Device[] {
    return (this._data?.devices ?? []).map((d) => ({
      stat_consumption: d.stat,
      ...(d.stat_rate ? { stat_rate: d.stat_rate } : {}),
      ...(d.parent ? { included_in_stat: d.parent } : {}),
    }));
  }

  /** Power or flow now, or the consumption of the period, per device. */
  _values(devices: Device[]): Map<string, number | null> {
    if (this.config?.period === "now") {
      const kind = this.config.kind;
      return new Map(
        devices.map((d) => [d.stat_consumption, this.hass ? rateValue(this.hass, d.stat_rate, kind) : null]),
      );
    }
    const energy = this._data?.energy ?? {};
    return new Map(devices.map((d) => [d.stat_consumption, energy[d.stat_consumption] ?? null]));
  }

  _format(value: number): string {
    const water = this.config?.kind === "water";
    const unit = this._data?.water_unit ?? "L";
    if (this.config?.period === "now") {
      return water ? formatFlow(this.hass, value, unit) : formatPower(this.hass, value);
    }
    return water ? formatVolume(this.hass, value, unit) : formatEnergy(this.hass, value);
  }

  /** The header text; an empty title hides the whole header. */
  private _title(): string {
    return this.config?.title ?? this._t(this.config?.kind === "water" ? "diagram_water" : "diagram");
  }

  protected override render(): TemplateResult {
    const title = this._title();
    return html`<ha-card>
      ${title && this.config
        ? html`<div class="header">
            <span class="title">${title}</span>
            <span class="period">${this._t(`period_${this.config.period}`)}</span>
          </div>`
        : nothing}
      ${this._renderBody()}
    </ha-card>`;
  }

  private _renderBody(): TemplateResult {
    if (this._error) {
      return html`<p class="message error">${this._error}</p>`;
    }
    if (!this._data || !this.config) {
      return html`<p class="message">${this._t("loading")}</p>`;
    }
    const devices = this._devices();
    let roots = buildTree(devices);
    const groups = this._data.groups ?? [];
    this._startCollapsed(groups);
    let display = displayTree(roots, groups);
    const root = this.config.root;
    if (root?.startsWith(GROUP_PREFIX)) {
      const node = walkDisplay(display).find((n) => n.type === "group" && groupBlockId(n.group.id) === root);
      if (!node) {
        return html`<p class="message">${this._t("card_root_missing")}</p>`;
      }
      display = [node];
      roots = topDevices(node);
    } else if (root) {
      const node = walk(roots).find((n) => n.stat === root);
      if (!node) {
        return html`<p class="message">${this._t("card_root_missing")}</p>`;
      }
      roots = [node];
      display = displayTree(roots, groups);
    }
    if (roots.length === 0) {
      return html`<p class="message">${this._t("card_empty")}</p>`;
    }
    return this._renderDiagram(roots, display, devices, groups);
  }

  /** Groups start collapsed, once each; a group the card starts at starts open. */
  private _startCollapsed(groups: Group[]): void {
    for (const group of groups) {
      if (!this._seenGroups.has(group.id)) {
        this._seenGroups.add(group.id);
        if (this.config?.root !== groupBlockId(group.id)) {
          this._collapsed.add(groupBlockId(group.id));
        }
      }
    }
  }

  private _toggle(id: string): void {
    const next = new Set(this._collapsed);
    if (!next.delete(id)) {
      next.add(id);
    }
    this._collapsed = next;
  }

  /**
   * What the whole home uses (not below a start device): now from the home
   * meter's power sensor, in a period from the card command.
   */
  _home(roots: TreeNode[], values: Map<string, number | null>): HomeResult | null {
    const config = this.config;
    if (!config || config.root || config.kind !== "electricity") {
      return null;
    }
    if (config.period !== "now") {
      return this._data?.home ?? null;
    }
    const meter = this._data?.sources.find((s) => s.role === "home");
    const value =
      this.hass && meter?.stat_rate
        ? homeNow(this.hass, [{ type: "home", stat_energy_to: meter.stat, stat_rate: meter.stat_rate }])
        : null;
    if (value === null) {
      return null;
    }
    const tops = roots.map((n) => values.get(n.stat) ?? null);
    const rest = tops.some((v) => v === null) ? null : value - tops.reduce<number>((a, b) => a + (b ?? 0), 0);
    return { value, basis: "measured", stale: null, untracked: rest };
  }

  private _renderDiagram(
    roots: TreeNode[],
    display: DisplayNode[],
    devices: Device[],
    groups: Group[],
  ): TemplateResult {
    const config = this.config!;
    const values = this._values(devices);
    const rest = untracked(roots, values);
    const home = this._home(roots, values);
    if (home?.value != null) {
      rest.set(HOME_ID, home.untracked);
    }
    const sources =
      config.show_sources && !config.root
        ? (this._data?.sources ?? []).map((s) => ({ type: s.type, role: s.role, stat: s.stat, name: s.name }))
        : [];
    const result = layout(
      display,
      sources,
      values,
      rest,
      this._collapsed,
      [],
      config.show_untracked,
      config.orientation,
      home?.value != null,
    );
    // Below a device the diagram starts at that device: no sources, no Home.
    const shown = result.blocks.filter((b) => !(config.root && b.kind === "home"));
    const ids = new Set(shown.map((b) => b.id));
    const edges = result.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    const boxes = [...shown, ...result.frames];
    const left = Math.min(...boxes.map((b) => b.x)) - PAD;
    const top = Math.min(...boxes.map((b) => b.y)) - PAD;
    const width = Math.max(...boxes.map((b) => b.x + b.w)) + PAD - left;
    const height = Math.max(...boxes.map((b) => b.y + b.h)) + PAD - top;
    const groupNodes = new Map(
      walkDisplay(display)
        .filter((n) => n.type === "group")
        .map((n) => [groupBlockId(n.group.id), n]),
    );
    const room = Math.max(1, this._width - CARD_PADDING);
    const k = Math.max(CARD_MIN_SCALE, Math.min(1, room / width));
    const offset = Math.max(0, (room - width * k) / 2);
    const blocks = new Map(result.blocks.map((b) => [b.id, b]));
    const maxValue = Math.max(0, ...edges.map((e) => e.power ?? 0));
    const known = roots.map((n) => values.get(n.stat)).filter((v): v is number => v != null);
    // A negative sum (a meter that went backwards) is no consumption of Home.
    const sum = known.reduce((a, b) => a + b, 0);
    const measured = known.length && sum >= 0 ? sum : null;
    return html`<div class="diagram">
      <div class="sizer" style="width:${width * k > room ? `${width * k}px` : "100%"};height:${height * k}px">
      <div
        class="canvas"
        style="left:${offset}px;width:${width}px;height:${height}px;transform:scale(${k}) translate(${-left}px, ${-top}px)"
      >
        <svg class="edges" width=${width + left} height=${height + top} aria-hidden="true">
          ${edges.map((edge) => this._renderEdge(edge, blocks, maxValue))}
        </svg>
        ${result.frames.map((frame) => this._renderFrame(frame))}
        ${shown.map((block) => this._renderBlock(block, measured, rest, home, groupNodes, values, groups))}
      </div>
      </div>
    </div>`;
  }

  private _renderEdge(edge: Edge, blocks: Map<string, Block>, maxValue: number) {
    const from = blocks.get(edge.from)!;
    const to = blocks.get(edge.to)!;
    const source = blocks.get(edge.from === HOME_ID ? edge.to : edge.from);
    const color =
      edge.kind === "untracked"
        ? "var(--secondary-text-color)"
        : edge.kind === "source"
          ? (SOURCE_COLORS[source?.role ?? ""] ?? "var(--secondary-text-color)")
          : "var(--primary-color)";
    const dashed = edge.kind === "untracked" || ((edge.kind === "device" || edge.kind === "group") && edge.power === null) || (edge.kind === "source" && from.role === "home");
    const width = strokeWidth(edge.power, maxValue);
    const head = arrowSize(width);
    const orientation = this.config?.orientation;
    return svg`<g class="edge edge-${edge.kind}" data-from=${edge.from} data-to=${edge.to}>
      <path d=${edgePath(from, to, head.length - 1, orientation)} fill="none" stroke=${color} stroke-width=${width}
        stroke-dasharray=${dashed ? dashPattern(width) : "none"} stroke-linecap="butt"></path>
      <polygon points=${arrowHead(from, to, head.half, head.length, orientation)} fill=${color}></polygon>
    </g>`;
  }

  private _renderBlock(
    block: Block,
    measured: number | null,
    rest: Map<string, number | null>,
    home: HomeResult | null = null,
    groupNodes: Map<string, DisplayNode> = new Map(),
    values: Map<string, number | null> = new Map(),
    groups: Group[] = [],
  ): TemplateResult {
    const style = `left:${block.x}px;top:${block.y}px;width:${block.w}px;height:${block.h}px`;
    switch (block.kind) {
      case "home": {
        const warned = (this._data?.issues ?? []).some((i) => i.stat === HOME_ID);
        return html`<div class="block home" style=${style}>
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${this._homeText(measured, home)}
          </div>
          ${warned ? html`<span class="badge" title=${this._t("issue_devices_exceed_home")}>!</span>` : nothing}
        </div>`;
      }
      case "source": {
        const role = block.role ?? "import";
        return html`<div
          class="block source"
          style="${style};--source-color:${SOURCE_COLORS[role] ?? "var(--divider-color)"}"
          data-role=${role}
        >
          <div class="block-text">
            <span class="node-name">${this._t(`role_${role}` as StringKey)}</span>
            <span class="sub">${block.source?.name ?? block.stat}</span>
          </div>
          ${block.stat && this._haTitles(block.stat).length
            ? html`<span class="badge" title=${this._haTitles(block.stat).join("\n")}>!</span>`
            : nothing}
        </div>`;
      }
      case "untracked": {
        const value = rest.get(block.stat!);
        return html`<div class="block untracked" style=${style} data-parent=${block.stat!}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub">${value == null ? this._t("none") : this._format(value)}</span>
          </div>
        </div>`;
      }
      case "group": {
        const node = groupNodes.get(block.id);
        return this._renderGroup(block, style, node ? groupValue(node, values) : null, groups);
      }
      default:
        return this._renderDevice(block, style);
    }
  }

  /** "1 device", "4 devices": all devices in a group, also in the groups inside it. */
  private _devicesText(groups: Group[], id: string): string {
    const count = groupDevices(groups, id).length;
    return count === 1
      ? this._t("group_devices_one")
      : this._t("group_devices_other", { count: formatNumber(this.hass, count) });
  }

  /**
   * A group: collapsed, a dashed block with its name, devices and value;
   * expanded, the header of its frame, name and value. A tap toggles it.
   */
  private _renderGroup(block: Block, style: string, value: number | null, groups: Group[]): TemplateResult {
    const group = block.group!;
    const collapsed = this._collapsed.has(block.id);
    const valueText = value === null ? null : this._format(value);
    const toggle = () => this._toggle(block.id);
    return html`<div
      class="block group ${collapsed ? "collapsed" : "header"}"
      style=${style}
      data-group=${group.id}
      role="button"
      tabindex="0"
      aria-expanded=${String(!collapsed)}
      @click=${toggle}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span class="toggle" aria-hidden="true">${collapsed ? "\u25b8" : "\u25be"}</span>
      <div class="block-text">
        ${collapsed
          ? html`<span class="node-name" title=${group.name}>${group.name}</span>
              <span class="sub">${[this._devicesText(groups, group.id), valueText].filter(Boolean).join(" \u00b7 ")}</span>`
          : html`<span class="node-name" title=${group.name}>${[group.name, valueText].filter(Boolean).join(" \u00b7 ")}</span>
              <span class="sub">${this._devicesText(groups, group.id)}</span>`}
      </div>
    </div>`;
  }

  /** The dashed frame around an expanded group. */
  private _renderFrame(frame: Frame): TemplateResult {
    const style = `left:${frame.x}px;top:${frame.y}px;width:${frame.w}px;height:${frame.h}px`;
    return html`<div class="frame" style=${style} data-group=${frame.group.id}></div>`;
  }

  /** Subtitle of Home: the home consumption, or the sum of the top-level devices. */
  private _homeText(measured: number | null, home: HomeResult | null): TemplateResult | typeof nothing {
    if (home?.stale) {
      const name = this._data?.sources.find((s) => s.stat === home.stale)?.name ?? home.stale;
      return html`<span class="sub">${this._t("home_stale", { name })}</span>`;
    }
    // With a home meter, the sum of the devices is no measurement of Home.
    const meter = !this.config?.root && (this._data?.sources ?? []).some((s) => s.role === "home");
    if (home?.value == null && meter) {
      return nothing;
    }
    const [key, value] =
      home?.value != null
        ? ([home.basis === "calculated" ? "home_calculated" : "home_measured", home.value] as const)
        : (["home_measured", measured] as const);
    if (value === null) {
      return nothing;
    }
    const ratio =
      this.config?.show_coverage && home?.value != null && !this.config.root
        ? coverage(home.value, this._tops())
        : null;
    return html`<span class="sub">${this._t(key, { power: this._format(value) })}</span>${ratio === null
        ? nothing
        : html`<span class="sub coverage">${coverageText(this.hass, ratio)}</span>`}`;
  }

  /** Values of the top-level devices of the list. */
  private _tops(): (number | null)[] {
    const devices = this._devices();
    const values = this._values(devices);
    return buildTree(devices).map((node) => values.get(node.stat) ?? null);
  }

  private _renderDevice(block: Block, style: string): TemplateResult {
    const stat = block.stat!;
    const device = this._data?.devices.find((d) => d.stat === stat);
    const value = this._values(this._devices().filter((d) => d.stat_consumption === stat)).get(stat) ?? null;
    const sub = [value === null ? null : this._format(value), device?.area].filter(Boolean).join(" · ");
    const issues = (this._data?.issues ?? []).filter((i) => i.stat === stat);
    const titles = [
      ...(issues.length ? [this._t("issue_children_exceed_parent")] : []),
      ...this._haTitles(stat),
    ];
    const entity = isEntity(stat);
    return html`<div
      class="block device ${entity ? "link" : ""}"
      style=${style}
      data-stat=${stat}
      role=${entity ? "button" : nothing}
      tabindex=${entity ? "0" : nothing}
      @click=${() => this._moreInfo(stat)}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._moreInfo(stat);
        }
      }}
    >
      <div class="block-text">
        <span class="node-name" title=${device?.name ?? stat}>${device?.name ?? stat}</span>
        ${sub ? html`<span class="sub">${sub}</span>` : nothing}
      </div>
      ${titles.length ? html`<span class="badge" title=${titles.join("\n")}>!</span>` : nothing}
    </div>`;
  }

  /** Home Assistant's check messages for a block, in HA's words. */
  private _haTitles(stat: string): string[] {
    return (this._data?.ha_issues ?? [])
      .filter((issue) => issue.stat === stat)
      .map((issue) => haIssueText(this.hass, issue, stat));
  }

  /** Open Home Assistant's dialog with the history of the meter. */
  _moreInfo(stat: string): void {
    if (isEntity(stat)) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { detail: { entityId: stat }, bubbles: true, composed: true }),
      );
    }
  }

  static override styles = css`
    :host {
      display: block;
    }
    ha-card {
      display: block;
      padding: 12px 16px 16px;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .title {
      font-size: 20px;
      color: var(--primary-text-color);
    }
    .period,
    .message,
    .sub {
      color: var(--secondary-text-color);
    }
    .period {
      font-size: 13px;
    }
    .message {
      margin: 8px 0;
    }
    .error {
      color: var(--error-color);
    }
    .diagram {
      overflow-x: auto;
      overflow-y: hidden;
      --group-color: var(--accent-color, #ff9800);
      --block-bg: var(--card-background-color, var(--primary-background-color));
      --block-border: color-mix(in srgb, var(--primary-text-color) 35%, transparent);
    }
    .sizer {
      position: relative;
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
    }
    .block {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px 6px 12px;
      border-radius: 10px;
      border: 1px solid var(--block-border);
      background: var(--block-bg);
      color: var(--primary-text-color);
      font-size: 14px;
    }
    .block-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }
    .node-name {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.25;
      font-weight: 500;
    }
    .sub {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .block.device {
      border-left: 5px solid var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 10%, var(--block-bg));
    }
    .block.device.link {
      cursor: pointer;
    }
    .block.device.link:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    .block.group {
      cursor: pointer;
      border: 2px dashed var(--group-color);
      background: color-mix(in srgb, var(--group-color) 10%, var(--block-bg));
    }
    .block.group:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    .toggle {
      flex: none;
      width: 16px;
      color: var(--secondary-text-color);
    }
    .frame {
      position: absolute;
      box-sizing: border-box;
      border: 2px dashed var(--group-color);
      border-radius: 14px;
      background: color-mix(in srgb, var(--group-color) 5%, transparent);
    }
    .block.home {
      border: 2px solid var(--primary-text-color);
    }
    .block.source {
      border: 1px solid var(--source-color);
      border-left: 5px solid var(--source-color);
      background: color-mix(in srgb, var(--source-color) 14%, var(--block-bg));
    }
    .block.untracked {
      border: 2px dashed var(--block-border);
      background: transparent;
    }
    .block.untracked .node-name {
      font-style: italic;
      font-weight: 400;
      color: var(--secondary-text-color);
    }
    .badge {
      flex: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--warning-color);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
}

interface FormSchema {
  name: string;
  selector: Record<string, unknown>;
}

/** Editor of the card, built with Home Assistant's own form element. */
export class EnergyFlowMapperCardEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _devices: { state: true },
    _groups: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config: CardConfig | null;
  /** Devices of the chosen list, for "Start at device". */
  declare _devices: CardDevice[];
  /** Groups of the chosen list, for "Start at device". */
  declare _groups: Group[];

  private _kindLoaded: DeviceKind | null = null;

  constructor() {
    super();
    this._config = null;
    this._devices = [];
    this._groups = [];
  }

  setConfig(config: unknown): void {
    this._config = cardConfig(config);
  }

  private _t(key: StringKey, placeholders: Record<string, string> = {}): string {
    return localize(this.hass, key, placeholders);
  }

  protected override willUpdate(): void {
    const kind = this._config?.kind;
    if (this.hass && kind && kind !== this._kindLoaded) {
      this._kindLoaded = kind;
      void this._loadDevices(kind);
    }
  }

  async _loadDevices(kind: DeviceKind): Promise<void> {
    try {
      const data = await this.hass!.callWS<CardData>({ type: `${DOMAIN}/card`, kind });
      if (kind === this._kindLoaded) {
        this._devices = data.devices;
        this._groups = data.groups ?? [];
      }
    } catch {
      if (kind === this._kindLoaded) {
        this._devices = [];
        this._groups = [];
      }
    }
  }

  /** The fields of the editor. */
  schema(): FormSchema[] {
    const options = (values: readonly string[], prefix: string) =>
      values.map((value) => ({ value, label: this._t(`${prefix}${value}` as StringKey) }));
    return [
      { name: "title", selector: { text: {} } },
      { name: "kind", selector: { select: { mode: "dropdown", options: options(CARD_KINDS, "tab_") } } },
      { name: "period", selector: { select: { mode: "dropdown", options: options(CARD_PERIODS, "period_") } } },
      {
        name: "root",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "", label: this._t("card_root_all") },
              ...this._devices.map((d) => ({ value: d.stat, label: d.name })),
              ...this._groups.map((g) => ({
                value: groupBlockId(g.id),
                label: this._t("card_root_group", { name: g.name }),
              })),
            ],
          },
        },
      },
      {
        name: "orientation",
        selector: { select: { mode: "dropdown", options: options(CARD_ORIENTATIONS, "orientation_") } },
      },
      { name: "show_sources", selector: { boolean: {} } },
      { name: "show_untracked", selector: { boolean: {} } },
      // Coverage is measured against the home consumption: electricity only.
      ...(this._config?.kind === "water" ? [] : [{ name: "show_coverage", selector: { boolean: {} } }]),
    ];
  }

  computeLabel = (field: FormSchema): string => {
    const labels: Record<string, StringKey> = {
      title: "card_field_title",
      kind: "card_field_kind",
      period: "period_label",
      root: "card_field_root",
      orientation: "orientation_label",
      show_sources: "card_field_show_sources",
      show_untracked: "card_field_show_untracked",
      show_coverage: "card_field_show_coverage",
    };
    return this._t(labels[field.name]);
  };

  /** Apply a change of the form; another list has other devices, so root goes. */
  _valueChanged(value: Record<string, unknown>): void {
    if (!this._config) {
      return;
    }
    const next: Record<string, unknown> = { ...this._config, ...value };
    if (value.kind !== undefined && value.kind !== this._config.kind) {
      delete next.root;
    }
    // Default values stay out of the YAML; an empty title is kept, it hides
    // the header.
    if (!next.root) {
      delete next.root;
    }
    if (next.title === null || next.title === undefined) {
      delete next.title;
    }
    const defaults: Record<string, unknown> = {
      kind: "electricity",
      period: "today",
      orientation: "horizontal",
      show_sources: true,
      show_untracked: true,
      show_coverage: false,
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (next[key] === value) {
        delete next[key];
      }
    }
    this._config = cardConfig(next);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    return html`<ha-form
      .hass=${this.hass}
      .data=${{ ...this._config, root: this._config.root ?? "" }}
      .schema=${this.schema()}
      .computeLabel=${this.computeLabel}
      @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) => this._valueChanged(e.detail.value)}
    ></ha-form>`;
  }
}

if (!customElements.get(CARD_VIEW_TAG)) {
  customElements.define(CARD_VIEW_TAG, EnergyFlowMapperCardView);
}
if (!customElements.get(CARD_EDITOR_TAG)) {
  customElements.define(CARD_EDITOR_TAG, EnergyFlowMapperCardEditor);
}
