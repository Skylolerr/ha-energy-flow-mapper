import { html, LitElement, nothing, svg, type TemplateResult } from "lit";

import { evidenceText, inputEvidenceText } from "./evidence";
import { errorText, formatPower, hasKey, type StringKey } from "./localize";
import type {
  Change,
  HomeAssistant,
  SolarCandidate,
  SolarMethod,
  SolarMethodStatus,
  SolarPreview,
  SolarRole,
  StatsEvidence,
  WSError,
} from "./types";

const SOLAR_SETUP_TAG = "efm-solar-setup";
const DOMAIN = "energy_flow_mapper";

/** The user's choices. Only what the user picked is sent; the rest is the backend's. */
export interface SolarChoices {
  method: SolarMethod | null;
  drawn: string | null;
  returned: string | null;
  invert: boolean | null;
  /** The daily switch, only for the inputs the user touched. */
  periodic: Record<string, boolean>;
}

/** What the setup hands out when it leads to a power dialog, to come back to. */
export interface SolarSetupState {
  solar: string | null;
  choices: SolarChoices;
  names: Partial<Record<SolarRole, string>>;
}

/** What the panel tells the setup about the device and the draft. */
export interface SolarSetupContext {
  /** The electricity device the solar feeds into (saved or only in the draft). */
  stat: string;
  /** Its name in the draft. */
  deviceName: string;
  /** The solar sources of the draft. */
  solars: string[];
  /** The solar source the user came with (from a sum meter dialog), if any. */
  solar?: string | null;
  /** The state to come back to (after a power dialog the setup opened). */
  resume?: SolarSetupState;
  /** Whether the panel is still busy with the result of *Set up*. */
  busy: boolean;
  /** The display name of a statistic (a source or a device). */
  name: (stat: string) => string;
  /** The name of a sensor. */
  sensorName: (entityId: string) => string;
  /** The draft the setup plans on, read when asked (null: no changes). */
  draft: () => { base_hash: string; changes: Change[] } | null;
  /** Load the settings again after a conflict; the draft is kept. */
  reload: () => Promise<void>;
  /** Whether *My meter already counts the solar* may place `solar` here (as a drop could). */
  canPlace?: (solar: string) => boolean;
  /** Opened from the solar block: *Set up* places the solar here, wherever it was. */
  placeHere?: boolean;
}

/** Detail of `created`: the gross meter and its power, and the names for the toast. */
export interface SolarCreatedDetail {
  /** The device the gross meter replaces. */
  stat: string;
  entity_id: string;
  stat_rate: string | null;
  /** The device's name when the meter was created. */
  old: string;
  /** The name of the gross meter. */
  name: string;
}

type Translate = (key: StringKey, placeholders?: Record<string, string>) => string;

/** A power sensor of the draft the backend refuses: which one and why. */
interface Refused {
  entity: string;
  power: "circuit" | "solar";
  why: string;
}

const REFUSED_WHY = new Set(["used", "not_power", "ours"]);

const NO_EVIDENCE: StatsEvidence = {
  periodic: null,
  certain: false,
  reason: null,
  drops: [],
  went_negative: false,
  series: [],
};

/** Ids are unique per panel: one setup is open at a time. */
const WHY_ID = "solar-setup-why";

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 28;
const SPARK_PAD = 3;

/**
 * A small line of the hourly statistics as given, with the falls found
 * marked as dots. Nothing without a series.
 */
function sparkline(evidence: StatsEvidence): TemplateResult | typeof nothing {
  const { series, drops } = evidence;
  if (series.length === 0) {
    return nothing;
  }
  const times = series.map(([at]) => Date.parse(at));
  const values = series.map(([, value]) => value);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const [v0, v1] = [Math.min(...values), Math.max(...values)];
  const inner = (size: number) => size - 2 * SPARK_PAD;
  const x = (time: number) =>
    t1 === t0 ? SPARK_WIDTH / 2 : SPARK_PAD + ((Math.min(Math.max(time, t0), t1) - t0) / (t1 - t0)) * inner(SPARK_WIDTH);
  const y = (value: number) =>
    v1 === v0
      ? SPARK_HEIGHT / 2
      : SPARK_HEIGHT - SPARK_PAD - ((Math.min(Math.max(value, v0), v1) - v0) / (v1 - v0)) * inner(SPARK_HEIGHT);
  const round = (value: number) => Math.round(value * 10) / 10;
  const points = series.map(([at, value]) => `${round(x(Date.parse(at)))},${round(y(value))}`).join(" ");
  return html`<svg
    class="solar-sparkline"
    viewBox="0 0 120 28"
    width="120"
    height="28"
    aria-hidden="true"
  >
    <polyline points=${points} fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
    ${drops.map(
      (drop) => svg`<circle class="drop" cx=${round(x(Date.parse(drop.at)))} cy=${round(y(drop.after))} r="2.5"></circle>`,
    )}
  </svg>`;
}

/**
 * "Solar feeds in here…" for an electricity device, saved or only in the
 * draft: the solar source, the ways to build the gross meter (each with one
 * sentence, the suggested one with its rule, an unverified one with why), the
 * sensors to pick, every energy input with its statistics and the daily
 * switch, the powers with a live check, and what is created, with names.
 *
 * It asks the backend for the preview on the panel's draft and creates the
 * helpers itself; the panel applies `created` to the draft. It never leaves a
 * dead end: a failed check offers «Try again», a block or a refused power
 * sensor names the way on, and a disabled *Set up* says why. Only what the
 * user chose is sent; above all the daily switch only for the inputs the user
 * touched.
 *
 * Events (none bubble): `close`, `created` (`SolarCreatedDetail`), `failed`
 * (`{ error }`), `place` (`{ stat, solar }`: the meter counts the solar
 * already, only place it), `set-solar-power` (`{ solar, state }`), `set-circuit-power`
 * (`{ stat, state }`) and `open-settings` (`{ entity_id, state }`); `state`
 * (`SolarSetupState`) lets the panel open the setup again as it was. It
 * renders into the panel's shadow root (no own shadow root), so the panel's
 * dialog styles apply.
 */
export class EfmSolarSetup extends LitElement {
  static override properties = {
    hass: { attribute: false },
    localize: { attribute: false },
    context: { attribute: false },
    _solar: { state: true },
    _choices: { state: true },
    _preview: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _refused: { state: true },
    _notice: { state: true },
    _names: { state: true },
    _busy: { state: true },
  };

  declare hass?: HomeAssistant;
  /** The panel's texts; not `translate`, which every HTML element has. */
  declare localize: Translate;
  declare context: SolarSetupContext;
  /** The chosen solar source. */
  declare _solar: string | null;
  declare _choices: SolarChoices;
  /** The backend's last preview; kept while a new one loads or fails. */
  declare _preview: SolarPreview | null;
  declare _loading: boolean;
  /** Why the last preview failed, or null. */
  declare _error: string | null;
  /** A power sensor of the draft the backend refused, or null. */
  declare _refused: Refused | null;
  /** Why the setup checked again (values changed meanwhile), or null. */
  declare _notice: string | null;
  /** The names the user typed, per helper role; the others are the defaults. */
  declare _names: Partial<Record<SolarRole, string>>;
  /** Whether *Set up* is on its way. */
  declare _busy: boolean;

  /** Counts previews asked for; a late answer for an earlier one is dropped. */
  private _request = 0;
  /** Whether the solar was preselected, and the first preview asked for. */
  private _started = false;
  private _asked = false;

  constructor() {
    super();
    this.localize = (key) => key;
    this._solar = null;
    this._choices = { method: null, drawn: null, returned: null, invert: null, periodic: {} };
    this._preview = null;
    this._loading = false;
    this._error = null;
    this._refused = null;
    this._notice = null;
    this._names = {};
    this._busy = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Without a box of its own, the dialog lays out the content as before.
    this.style.display = "contents";
    // Render now: the panel opens the dialog right after, and showModal
    // focuses its first button only if the content is already there.
    if (this.context && this.isUpdatePending) {
      this.performUpdate();
    } else if (this._loading) {
      // Moved: the preview dropped on the way out is asked for again.
      void this._loadPreview();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // A preview still on its way belongs to a closed dialog.
    this._request++;
  }

  protected override willUpdate(): void {
    if (!this._started) {
      this._started = true;
      const { solar, solars, resume } = this.context;
      if (resume) {
        // Back from a power dialog: as the user left it.
        this._choices = { ...resume.choices, periodic: { ...resume.choices.periodic } };
        this._names = { ...resume.names };
      }
      // The solar the user had or came with, else the only one.
      const wanted = resume?.solar ?? solar;
      this._solar = wanted && solars.includes(wanted) ? wanted : solars.length === 1 ? solars[0] : null;
    }
    // Also when Home Assistant arrives after the first update.
    if (!this._asked && this.hass && this._solar) {
      this._asked = true;
      void this._loadPreview();
    }
  }

  private _emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** What the panel keeps to open the setup again as it is. */
  private _state(): SolarSetupState {
    return {
      solar: this._solar,
      choices: { ...this._choices, periodic: { ...this._choices.periodic } },
      names: { ...this._names },
    };
  }

  private _setSolarPower(): void {
    this._emit("set-solar-power", { solar: this._solar, state: this._state() });
  }

  private _setCircuitPower(): void {
    this._emit("set-circuit-power", { stat: this.context.stat, state: this._state() });
  }

  private _openSettings(entity: string): void {
    this._emit("open-settings", { entity_id: entity, state: this._state() });
  }

  /** A device, solar or sensor by the name the user knows. */
  private _display(entity: string): string {
    if (entity === this.context.stat) {
      return this.context.deviceName;
    }
    return this.context.solars.includes(entity) ? this.context.name(entity) : this.context.sensorName(entity);
  }

  /** The text of an error key, with its entity by name. */
  private _errorText(err: unknown): string {
    const error = (err ?? {}) as WSError;
    const entity = error.translation_placeholders?.entity_id;
    if (typeof entity !== "string") {
      return errorText(this.hass, err);
    }
    return errorText(this.hass, {
      ...error,
      translation_placeholders: { ...error.translation_placeholders, entity_id: this._display(entity) },
    });
  }

  /** The message for the backend: the device, solar, the user's choices and the draft. */
  private _message(type: string): { type: string; [key: string]: unknown } {
    const { method, drawn, returned, invert, periodic } = this._choices;
    const draft = this.context.draft();
    return {
      type: `${DOMAIN}/${type}`,
      stat: this.context.stat,
      solar: this._solar,
      ...(method ? { method } : {}),
      ...(drawn ? { drawn } : {}),
      ...(returned ? { returned } : {}),
      ...(invert !== null ? { invert } : {}),
      ...(Object.keys(periodic).length ? { periodic: { ...periodic } } : {}),
      ...(draft ? { base_hash: draft.base_hash, changes: draft.changes } : {}),
    };
  }

  /** A refused power sensor of the draft, if the error is one. */
  private _refusedPower(error: WSError): Refused | null {
    const placeholders = error.translation_placeholders ?? {};
    const { entity_id: entity, power, why } = placeholders;
    if (
      error.translation_key !== "not_offered" ||
      typeof entity !== "string" ||
      (power !== "circuit" && power !== "solar") ||
      typeof why !== "string" ||
      !REFUSED_WHY.has(why)
    ) {
      return null;
    }
    return { entity, power, why };
  }

  /** Drop the user's pick the backend no longer offers; whether there was one. */
  private _dropPick(error: WSError): boolean {
    const entity = error.translation_placeholders?.entity_id;
    const { drawn, returned } = this._choices;
    if (entity === undefined || (entity !== drawn && entity !== returned)) {
      return false;
    }
    this._choices = {
      ...this._choices,
      drawn: entity === drawn ? null : drawn,
      returned: entity === returned ? null : returned,
    };
    return true;
  }

  /** Drop the user's method the backend no longer offers, with a note. */
  private _dropMethod(): void {
    this._choices = { ...this._choices, method: null };
    this._notice = this.localize("solar_setup_method_gone");
  }

  /**
   * Ask the backend what the setup would create with the current choices, on
   * the panel's draft. A stale draft (`conflict`) is loaded again, and a pick
   * or a method the backend no longer offers is dropped, each once. A refused
   * power sensor of the draft is named with the way on; any other failure
   * keeps the choices and the last preview and offers «Try again». Outdated
   * answers are ignored.
   */
  async _loadPreview(): Promise<void> {
    const hass = this.hass;
    const solar = this._solar;
    if (!hass || !solar) {
      return;
    }
    const request = ++this._request;
    const stale = () => request !== this._request || this._solar !== solar;
    this._loading = true;
    this._error = null;
    this._refused = null;
    let reloaded = false;
    let dropped = false;
    let methodDropped = false;
    for (;;) {
      try {
        const preview = await hass.callWS<SolarPreview>(this._message("solar_setup_preview"));
        if (stale()) {
          return;
        }
        const chosen = this._choices.method;
        if (chosen && !methodDropped && !preview.methods.some((m) => m.method === chosen && m.offered)) {
          // Something else changed (a daily switch): the method went.
          methodDropped = true;
          this._dropMethod();
          continue;
        }
        this._preview = preview;
        this._loading = false;
        return;
      } catch (err) {
        if (stale()) {
          return;
        }
        const error = (err ?? {}) as WSError;
        if (error.translation_key === "conflict" && !reloaded) {
          reloaded = true;
          try {
            await this.context.reload();
          } catch {
            // The next answer says what is wrong.
          }
          if (stale()) {
            return;
          }
          continue;
        }
        const refused = this._refusedPower(error);
        if (refused !== null) {
          // A retry cannot help: another power sensor can.
          this._refused = refused;
          this._loading = false;
          return;
        }
        if (error.translation_key === "not_offered" && !dropped && this._dropPick(error)) {
          dropped = true;
          this._notice = this._errorText(err);
          continue;
        }
        this._error = this._errorText(err);
        this._loading = false;
        return;
      }
    }
  }

  /** Take a choice and check again; a note of the last check goes. */
  private _choose(patch: Partial<SolarChoices>): void {
    this._choices = { ...this._choices, ...patch };
    this._notice = null;
    void this._loadPreview();
  }

  private _pickSolar(solar: string): void {
    this._solar = solar;
    // Asked for here: the next update must not ask again.
    this._asked = true;
    this._preview = null;
    this._error = null;
    this._notice = null;
    void this._loadPreview();
  }

  /** The name of a helper: the user's, else the default in the user's language. */
  private _nameOf(role: SolarRole, preview: SolarPreview): string {
    const typed = this._names[role];
    if (typed !== undefined) {
      return typed;
    }
    const t = this.localize;
    const name = this.context.deviceName;
    const power = preview.power.solar ? this.context.sensorName(preview.power.solar) : "";
    switch (role) {
      case "energy":
        return t("solar_gross_name", { name });
      case "power":
        return t("solar_gross_power_name", { name });
      case "solar_power":
        return t("solar_term_power_name", { name: power });
      default:
        return t("solar_term_energy_name", { name: power });
    }
  }

  /** Why *Set up* cannot be pressed now, or null. */
  private _why(): string | null {
    const t = this.localize;
    const preview = this._preview;
    if (!this._solar) {
      return t("solar_setup_why_solar");
    }
    if (this._refused !== null) {
      return t("solar_setup_why_power");
    }
    if (this._error !== null) {
      return t("solar_setup_why_failed");
    }
    if (this._loading || preview === null || this.context.busy) {
      return t("solar_setup_why_checking");
    }
    if (preview.blocked) {
      return t("solar_setup_why_blocked");
    }
    if (!preview.method) {
      return t("solar_setup_why_method");
    }
    if (preview.helpers.some(({ role }) => !this._nameOf(role, preview).trim())) {
      return t("solar_setup_why_names");
    }
    return null;
  }

  /**
   * Create the helpers right away; the panel then puts the gross meter in the
   * device's place in the draft (`created`), also when the dialog was closed
   * meanwhile. What the preview showed is sent. When the values or the
   * settings changed meanwhile, a sensor or the method is no longer offered,
   * the setup checks again and says so; any other failure also goes to the
   * panel (`failed`), the dialog stays and checks again, so a block shows.
   */
  async _create(): Promise<void> {
    const hass = this.hass;
    const preview = this._preview;
    if (!hass || !preview || this._busy || this._why() !== null) {
      return;
    }
    const stat = this.context.stat;
    const old = this.context.deviceName;
    const names = Object.fromEntries(preview.helpers.map(({ role }) => [role, this._nameOf(role, preview).trim()]));
    this._busy = true;
    this._notice = null;
    try {
      const result = await hass.callWS<{ entity_id: string; stat_rate: string | null }>({
        ...this._message("create_solar_setup"),
        method: preview.method,
        drawn: preview.drawn,
        ...(preview.returned ? { returned: preview.returned } : {}),
        invert: preview.invert,
        offset: preview.offset,
        names,
        ...(this.context.placeHere ? { place: true } : {}),
      });
      const detail: SolarCreatedDetail = {
        stat,
        entity_id: result.entity_id,
        stat_rate: result.stat_rate,
        old,
        name: names.energy ?? "",
      };
      this._emit("created", detail);
    } catch (err) {
      const error = (err ?? {}) as WSError;
      const key = error.translation_key ?? "";
      if (key === "conflict") {
        try {
          await this.context.reload();
        } catch {
          // The preview says what is wrong.
        }
        this._notice = this.localize("solar_setup_conflict");
      } else if (key === "not_offered" && this._refusedPower(error) === null) {
        if (error.translation_placeholders?.entity_id === stat) {
          // The method, chosen or suggested, went.
          this._dropMethod();
        } else {
          this._dropPick(error);
          this._notice = this._errorText(err);
        }
      } else if (key === "values_changed") {
        this._notice = this._errorText(err);
      } else if (key !== "not_offered") {
        this._emit("failed", { error: err });
      }
      // Check again: what changed, or which block it is, shows in the dialog.
      void this._loadPreview();
    } finally {
      this._busy = false;
    }
  }

  private _t(key: string, placeholders?: Record<string, string>): string {
    return hasKey(key) ? this.localize(key, placeholders) : key;
  }

  /** The device of a meter, for the rule («fits your device (Shelly Pro EM)»). */
  private _device(entity: string): string {
    const id = this.hass?.entities?.[entity]?.device_id;
    const device = id ? this.hass?.devices?.[id] : undefined;
    // Every device rule is a Shelly one.
    return device?.model || device?.name_by_user || device?.name || "Shelly";
  }

  protected override render(): TemplateResult {
    const t = this.localize;
    const { deviceName: name, solars } = this.context;
    const head = html`<h2>${t("solar_setup_title", { name })}</h2>
      <p class="hint">${t("solar_setup_intro")}</p>`;
    if (solars.length === 0) {
      return html`${head}
        <p class="warning solar-no-solar">${t("solar_setup_no_solar")}</p>
        <div class="dialog-actions">
          <button @click=${() => this._emit("close")}>${t("cancel")}</button>
        </div>`;
    }
    const preview = this._preview;
    const why = this._busy ? null : this._why();
    return html`${head}
      ${solars.length === 1
        ? html`<h3>${t("solar_setup_source")}</h3>
            <p class="solar-source">${this.context.name(solars[0])}</p>`
        : html`<fieldset class="solar-sources">
            <legend>${t("solar_setup_source")}</legend>
            ${solars.map(
              (solar) => html`<label class="check">
                <input
                  type="radio"
                  name="solar-source"
                  value=${solar}
                  .checked=${this._solar === solar}
                  ?disabled=${this._busy}
                  @change=${() => this._pickSolar(solar)}
                />
                ${this.context.name(solar)}
              </label>`,
            )}
          </fieldset>`}
      <div class="solar-status" aria-live="polite">
        ${this._loading ? html`<p class="hint solar-checking">${t("checking")}</p>` : nothing}
        ${this._error !== null ? html`<p class="warning solar-error">${this._error}</p>` : nothing}
        ${this._refused !== null ? this._renderRefused(this._refused) : nothing}
        ${this._notice !== null ? html`<p class="warning solar-notice">${this._notice}</p>` : nothing}
      </div>
      ${this._error !== null
        ? html`<button class="solar-retry" @click=${() => void this._loadPreview()}>${t("solar_setup_retry")}</button>`
        : nothing}
      ${this._refused !== null
        ? html`<button class="solar-refused-action" @click=${() =>
            this._refused?.power === "solar" ? this._setSolarPower() : this._setCircuitPower()}>
            ${this._refused.power === "solar"
              ? t("solar_setup_set_solar_power")
              : t("solar_setup_set_circuit_power", { name })}
          </button>`
        : nothing}
      ${this._refused?.why === "not_power"
        ? html`<button class="solar-refused-check" @click=${() => void this._loadPreview()}>
            ${t("solar_setup_check_again")}
          </button>`
        : nothing}
      ${preview !== null ? this._renderPreview(preview) : nothing}
      ${this._solar !== null && (this.context.canPlace?.(this._solar) ?? true)
        ? html`<button
            class="link solar-place-only"
            ?disabled=${this._busy}
            @click=${() => this._emit("place", { stat: this.context.stat, solar: this._solar })}
          >
            ${t("solar_setup_place_only")}
          </button>`
        : nothing}
      <div class="dialog-actions">
        ${why !== null ? html`<span class="hint solar-why" id=${WHY_ID}>${why}</span>` : nothing}
        <button @click=${() => this._emit("close")}>${t("cancel")}</button>
        <button
          class="primary solar-create"
          aria-describedby=${why !== null ? WHY_ID : nothing}
          ?disabled=${why !== null || this._busy}
          @click=${() => void this._create()}
        >
          ${this._busy ? t("creating") : t("solar_setup_button")}
        </button>
      </div>`;
  }

  /** A refused power sensor of the draft: which, whose and why. */
  private _renderRefused(refused: Refused): TemplateResult {
    const owner = refused.power === "solar" ? this._display(this._solar ?? "") : this.context.deviceName;
    return html`<p class="warning solar-refused">
      ${this._t(`solar_setup_power_refused_${refused.why}`, {
        entity: this.context.sensorName(refused.entity),
        owner,
      })}
    </p>`;
  }

  private _renderPreview(preview: SolarPreview): TemplateResult {
    const t = this.localize;
    const method = preview.method;
    const energy = method !== null && method !== "power";
    const blocked = preview.blocked;
    return html`<fieldset class="solar-methods">
        <legend>${t("solar_setup_method")}</legend>
        ${preview.methods.map((status) => this._renderMethod(preview, status))}
      </fieldset>
      ${energy && (preview.drawn_candidates.length > 1 || preview.drawn_candidates.some((c) => c.disabled))
        ? this._renderPicker(preview, "drawn", preview.drawn_candidates, preview.drawn)
        : nothing}
      ${method === "em" || method === "plug"
        ? this._renderPicker(preview, "returned", preview.returned_candidates, preview.returned)
        : nothing}
      ${this._renderInputs(preview)} ${this._renderPower(preview)} ${energy ? this._renderSolarTerm(preview) : nothing}
      ${blocked
        ? html`<p class="warning solar-blocked">
              ${this._errorText({
                translation_key: blocked,
                translation_placeholders: { entity_id: preview.blocked_entity ?? this.context.stat },
              })}
            </p>
            ${this._renderBlockedAction(preview, blocked)}`
        : this._renderHelpers(preview)}`;
  }

  private _renderMethod(preview: SolarPreview, status: SolarMethodStatus): TemplateResult {
    const t = this.localize;
    const { method } = status;
    const state = status.verified ? "verified" : status.offered ? "unverified" : "not-offered";
    return html`<div class="solar-method ${state}" data-method=${method}>
      <label class="check">
        <input
          type="radio"
          name="solar-method"
          value=${method}
          .checked=${preview.method === method}
          ?disabled=${!status.offered || this._busy}
          @change=${() => this._choose({ method })}
        />
        <span>${this._t(`solar_method_${method}`)}</span>
        ${preview.suggested === method
          ? html`<span class="solar-suggested">${t("solar_method_suggested")}</span>`
          : nothing}
      </label>
      <p class="hint solar-method-hint">${this._t(`solar_method_${method}_hint`)}</p>
      ${status.reason
        ? html`<p class="hint solar-method-status">
            ${this._t(`reason_${status.reason}`, { device: this._device(preview.drawn) })}
          </p>`
        : nothing}
    </div>`;
  }

  /** A picker of the drawn or returned sensor; a disabled one offers its settings. */
  private _renderPicker(
    preview: SolarPreview,
    kind: "drawn" | "returned",
    candidates: SolarCandidate[],
    value: string | null,
  ): TemplateResult {
    const t = this.localize;
    const name = (entity: string) => this.context.sensorName(entity);
    return html`<label class="solar-picker">
        ${t(kind === "drawn" ? "solar_setup_drawn" : "solar_setup_returned")}
        <select
          class="solar-${kind}"
          ?disabled=${this._busy}
          @change=${(e: Event) => this._choose({ [kind]: (e.target as HTMLSelectElement).value || null })}
        >
          ${value === null ? html`<option value="" .selected=${true}>${t("solar_setup_choose")}</option>` : nothing}
          ${candidates.map(
            (c) =>
              html`<option value=${c.entity} .selected=${c.entity === value}>
                ${c.disabled ? t("solar_setup_disabled_option", { entity: name(c.entity) }) : name(c.entity)}
              </option>`,
          )}
        </select>
      </label>
      ${candidates
        .filter((c) => c.disabled && c.entity !== preview.blocked_entity)
        .map(
          (c) => html`<p class="hint solar-disabled">
            ${t("solar_setup_disabled_sensor", { entity: name(c.entity) })}
            <button
              class="link"
              ?disabled=${this._busy}
              @click=${() => this._openSettings(c.entity)}
            >
              ${t("solar_setup_open_settings")}
            </button>
          </p>`,
        )}`;
  }

  /**
   * The energy inputs: the circuit meter, the returned sensor and, without a
   * solar power, the solar's counter; each with its statistics and the daily
   * switch (fixed when certain; without statistics the user says which).
   */
  private _renderInputs(preview: SolarPreview): TemplateResult {
    const t = this.localize;
    const entities = [
      preview.drawn,
      ...(preview.returned ? [preview.returned] : []),
      ...(preview.power.solar === null && this._solar ? [this._solar] : []),
    ];
    return html`<h3>${t("solar_setup_inputs")}</h3>
      ${[...new Set(entities)].map((entity) => this._renderInput(preview, entity))}`;
  }

  private _renderInput(preview: SolarPreview, entity: string): TemplateResult {
    const meter = this._display(entity);
    const head = (sentence: string, evidence: StatsEvidence) => html`<div class="solar-input-head">
        <span class="solar-input-name">${meter}</span>
        ${sparkline(evidence)}
      </div>
      <p class="hint solar-evidence">${sentence}</p>`;
    if (preview.blocked === "daily_check_failed") {
      // The statistics were not read: nothing to judge, «Check again» below.
      return html`<div class="solar-input" data-entity=${entity}>
        ${head(this.localize("evidence_unchecked"), NO_EVIDENCE)}
      </div>`;
    }
    const evidence = preview.evidence[entity] ?? NO_EVIDENCE;
    const unit = this.hass?.states[entity]?.attributes.unit_of_measurement;
    const sentence = inputEvidenceText(this.hass, evidence, typeof unit === "string" ? unit : null);
    return html`<div class="solar-input" data-entity=${entity}>
      ${head(sentence, evidence)} ${this._renderDaily(entity, meter, evidence)}
    </div>`;
  }

  /** The daily switch of an input: fixed when certain, a choice without statistics. */
  private _renderDaily(entity: string, meter: string, evidence: StatsEvidence): TemplateResult | typeof nothing {
    const t = this.localize;
    const touched = this._choices.periodic[entity];
    const set = (value: boolean) => this._choose({ periodic: { ...this._choices.periodic, [entity]: value } });
    const daily = t("solar_setup_daily");
    if (evidence.certain) {
      return html`<label class="check">
          <input type="checkbox" class="solar-daily" .checked=${true} disabled aria-label=${`${meter}: ${daily}`} />
          ${daily}
        </label>
        <p class="hint solar-daily-locked">
          ${t("solar_setup_daily_locked", { evidence: evidenceText(this.hass, evidence, null) })}
        </p>`;
    }
    if (evidence.periodic === null) {
      if (entity === this._solar) {
        // Without statistics the solar's counter is never read as lifetime:
        // either answer leaves it blocked, so none is asked for.
        return nothing;
      }
      const choice = (value: "daily" | "lifetime") => {
        const label = t(value === "daily" ? "solar_setup_daily" : "solar_setup_lifetime");
        return html`<label class="check">
          <input
            type="radio"
            class="solar-daily-choice"
            name="solar-daily-${entity}"
            value=${value}
            aria-label=${`${meter}: ${label}`}
            .checked=${touched === (value === "daily")}
            ?disabled=${this._busy}
            @change=${() => set(value === "daily")}
          />
          ${label}
        </label>`;
      };
      return html`<div role="radiogroup" aria-label=${t("solar_setup_daily_question", { name: meter })}>
        ${choice("daily")} ${choice("lifetime")}
      </div>`;
    }
    return html`<label class="check">
        <input
          type="checkbox"
          class="solar-daily"
          aria-label=${`${meter}: ${daily}`}
          .checked=${touched ?? evidence.periodic}
          ?disabled=${this._busy}
          @change=${(e: Event) => set((e.target as HTMLInputElement).checked)}
        />
        ${daily}
      </label>
      ${touched === undefined ? html`<p class="hint">${t("solar_setup_daily_hint")}</p>` : nothing}`;
  }

  /**
   * The power sensors and where they come from. Whenever a gross power is
   * created (any method) the live check and the switch that turns the
   * circuit's power around; EM, Plug and Net without one say why.
   */
  private _renderPower(preview: SolarPreview): TemplateResult {
    const t = this.localize;
    const { power, live } = preview;
    const from = (source: string | null) => t(`solar_setup_from_${source ?? "saved"}` as StringKey);
    const watts = (value: number | null) => (value === null ? "–" : formatPower(this.hass, value));
    // A block that needs a power has the buttons already.
    const askPower = !["solar_needs_power", "solar_needs_data", "daily_without_power", "no_safe_method"].includes(
      preview.blocked ?? "",
    );
    const grossPower = preview.helpers.some(({ role }) => role === "power");
    return html`<h3>${t("solar_setup_power_title")}</h3>
      <p class="hint solar-circuit-power">
        ${power.circuit
          ? t("solar_setup_circuit_power", { entity: this.context.sensorName(power.circuit), from: from(power.circuit_from) })
          : t("solar_setup_circuit_none")}
      </p>
      <p class="hint solar-solar-power">
        ${power.solar
          ? t("solar_setup_solar_power", { entity: this.context.sensorName(power.solar), from: from(power.solar_from) })
          : t("solar_setup_solar_none")}
        ${power.solar === null && askPower
          ? html`<button class="link solar-set-power" ?disabled=${this._busy} @click=${() => this._setSolarPower()}>
              ${t("solar_setup_set_solar_power")}
            </button>`
          : nothing}
      </p>
      ${preview.power_reason
        ? html`<p class="hint solar-power-reason">${this._t(`reason_${preview.power_reason}`)}</p>
            <p class="hint solar-power-not-kept">
              ${t("solar_setup_power_not_kept", { device: this.context.deviceName })}
            </p>`
        : nothing}
      ${grossPower
        ? html`<p class="solar-live">
              ${t("solar_setup_live", {
                circuit: watts(live.circuit_w),
                solar: watts(live.solar_w),
                gross: watts(live.gross_w),
              })}
            </p>
            <p class="hint">${t("solar_setup_live_hint")}</p>
            <label class="check">
              <input
                type="checkbox"
                class="solar-invert"
                .checked=${preview.invert}
                ?disabled=${this._busy}
                @change=${(e: Event) => this._choose({ invert: (e.target as HTMLInputElement).checked })}
              />
              ${t("solar_setup_invert")}
            </label>
            <p class="hint">${t("solar_setup_invert_hint")}</p>`
        : nothing}
      ${preview.method === "power"
        ? html`<p class="hint solar-power-history">${t("solar_setup_power_history")}</p>`
        : nothing}`;
  }

  /** Where the solar energy of EM, Plug and Net comes from. */
  private _renderSolarTerm(preview: SolarPreview): TemplateResult | typeof nothing {
    const t = this.localize;
    const { kind, reuse } = preview.solar_term;
    if (kind === "counter") {
      return html`<p class="hint solar-counter">
        ${t("solar_setup_counter_night", { solar: this._display(this._solar ?? "") })}
      </p>`;
    }
    if (kind !== "integral") {
      return nothing;
    }
    return html`${reuse
        ? html`<p class="hint solar-reuse">${t("solar_setup_reuse", { entity: this.context.sensorName(reuse) })}</p>`
        : nothing}
      <p class="hint solar-hold">${t("solar_setup_hold")}</p>`;
  }

  /**
   * The way on from a block: set a missing or unusable power sensor (also
   * one that cannot be read or already holds the solar), check again, or
   * open a sensor's settings.
   */
  private _renderBlockedAction(preview: SolarPreview, blocked: string): TemplateResult | typeof nothing {
    const t = this.localize;
    const action = (label: string, run: () => void) =>
      html`<button class="solar-blocked-action" @click=${run}>${label}</button>`;
    switch (blocked) {
      case "solar_needs_power":
      case "solar_needs_data":
        return action(t("solar_setup_set_solar_power"), () => this._setSolarPower());
      case "daily_without_power":
      case "no_safe_method": {
        // "From power" needs both: name the missing or unusable ones, each
        // with its way on.
        const name = this.context.deviceName;
        const solar = this._display(this._solar ?? "");
        const circuit = preview.power.circuit;
        const unusable =
          circuit !== null &&
          preview.methods.some((m) => m.method === "power" && m.reason === "unusable_power");
        return html`${circuit === null
          ? html`<p class="hint solar-missing-power">${t("solar_setup_missing_power", { name })}</p>`
          : nothing}
        ${unusable
          ? html`<p class="hint solar-unusable-power">
              ${t("solar_setup_unusable_power", { entity: this.context.sensorName(circuit), name })}
            </p>`
          : nothing}
        ${preview.power.solar === null
          ? html`<p class="hint solar-missing-power">${t("solar_setup_missing_power", { name: solar })}</p>`
          : nothing}
        ${circuit === null || unusable
          ? action(t("solar_setup_set_circuit_power", { name }), () => this._setCircuitPower())
          : nothing}
        ${unusable
          ? action(t("solar_setup_open_settings"), () => this._openSettings(circuit))
          : nothing}
        ${preview.power.solar === null ? action(t("solar_setup_set_solar_power"), () => this._setSolarPower()) : nothing}`;
      }
      case "daily_check_failed":
      case "input_not_ready":
      case "not_offered":
        return action(t("solar_setup_check_again"), () => this._choose({}));
      case "unsupported_input":
      case "solar_already_in_meter":
        // A power sensor the setup cannot use: set another one. A meter
        // that already holds the solar is used as it is.
        if (preview.blocked_entity !== null && preview.blocked_entity === preview.power.solar) {
          return action(t("solar_setup_set_solar_power"), () => this._setSolarPower());
        }
        if (preview.blocked_entity !== null && preview.blocked_entity === preview.power.circuit) {
          return action(t("solar_setup_set_circuit_power", { name: this.context.deviceName }), () =>
            this._setCircuitPower(),
          );
        }
        return nothing;
      case "input_disabled":
      case "returned_disabled":
        return preview.blocked_entity
          ? action(t("solar_setup_open_settings"), () => this._openSettings(preview.blocked_entity ?? ""))
          : nothing;
      default:
        return nothing;
    }
  }

  /** What is created: one line and one name per helper, the offset with the gross energy. */
  private _renderHelpers(preview: SolarPreview): TemplateResult | typeof nothing {
    const t = this.localize;
    if (preview.helpers.length === 0) {
      return nothing;
    }
    const name = (entity: string) => this.context.sensorName(entity);
    const { power, method, offset } = preview;
    const solarTerm = preview.solar_term.reuse
      ? name(preview.solar_term.reuse)
      : preview.solar_term.kind === "counter"
        ? this._display(this._solar ?? "")
        : this._nameOf("solar_energy", preview);
    const returned = preview.returned ? name(preview.returned) : "?";
    const formula =
      method === "em"
        ? `${name(preview.drawn)} − ${returned} + ${solarTerm}`
        : method === "plug"
          ? `${name(preview.drawn)} − 2 × ${returned} + ${solarTerm}`
          : `${name(preview.drawn)} + ${solarTerm}`;
    const circuit = power.circuit ? name(power.circuit) : "?";
    const text = (role: SolarRole): string => {
      switch (role) {
        case "solar_power":
          return t("solar_setup_role_solar_power");
        case "solar_energy":
          return t("solar_setup_role_solar_energy");
        case "power":
          return t("solar_setup_power", {
            formula: `${preview.invert ? `−1 × ${circuit}` : circuit} + ${power.solar ? name(power.solar) : "?"}`,
          });
        default:
          return method === "power"
            ? t("solar_setup_role_energy_power")
            : t("solar_setup_energy", { formula: offset ? `${formula} + ${offset} kWh` : formula });
      }
    };
    const withPower = preview.helpers.some(({ role }) => role === "power");
    return html`<h3>${t("solar_setup_preview")}</h3>
      <ul class="solar-helpers">
        ${preview.helpers.map(
          ({ role }) => html`<li>
            <label
              >${text(role)}
              <input
                type="text"
                class="solar-name"
                data-role=${role}
                .value=${this._nameOf(role, preview)}
                ?disabled=${this._busy}
                @input=${(e: Event) => (this._names = { ...this._names, [role]: (e.target as HTMLInputElement).value })}
              />
            </label>
            ${role === "energy" && method !== "power" && offset
              ? html`<p class="hint solar-offset">${t("solar_setup_offset", { offset: String(offset) })}</p>`
              : nothing}
          </li>`,
        )}
      </ul>
      <p class="hint">
        ${t(withPower ? "solar_setup_text" : "solar_setup_text_no_power", { name: this.context.deviceName })}
      </p>`;
  }
}

if (!customElements.get(SOLAR_SETUP_TAG)) {
  customElements.define(SOLAR_SETUP_TAG, EfmSolarSetup);
}
