import { html, LitElement, nothing, type TemplateResult } from "lit";

import { errorText, type StringKey } from "./localize";
import type { Device, HomeAssistant, SolarMeterKind, SolarPreview, Source } from "./types";

export const SOLAR_SETUP_TAG = "efm-solar-setup";
const DOMAIN = "energy_flow_mapper";

/** What the panel tells the setup about the device and the draft. */
export interface SolarSetupContext {
  /** The electricity device the solar feeds into. */
  stat: string;
  /** Its name in the draft. */
  deviceName: string;
  /** Whether the device is saved: the backend reads the saved settings. */
  saved: boolean;
  /** The solar sources the setup can use (saved ones the draft still has). */
  solars: string[];
  /** Saved and draft sources and the device, for the note on unsaved power sensors. */
  savedSources: Source[];
  draftSources: Source[];
  savedDevice: Device | undefined;
  draftDevice: Device | undefined;
  /** Whether the panel is still busy with the result of *Set up*. */
  busy: boolean;
  /** The display name of a statistic (a source or a device). */
  name: (stat: string) => string;
  /** The name of a sensor. */
  sensorName: (entityId: string) => string;
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

/** Names of the helpers of the solar setup; `integrals` by power sensor. */
export interface SolarNames {
  energy: string;
  power: string;
  integrals: Record<string, string>;
}

export type Translate = (key: StringKey, placeholders?: Record<string, string>) => string;

/** Whether the solar setup creates a gross power: both power sensors exist and can be read. */
export function solarWithPower(preview: SolarPreview): boolean {
  return preview.circuit_power !== null && preview.solar_power !== null && !preview.unusable_power;
}

/**
 * "Solar feeds in here…" for an electricity device: the solar source, the
 * kind of the circuit meter (both explained, the suggested one preselected
 * with its reason), then what is created and replaced, with editable names.
 * A blocked setup says why and offers no *Set up*.
 *
 * It asks the backend for the preview and creates the helpers itself; the
 * panel applies `created` to the draft. Events (none bubble): `close`,
 * `created` (`SolarCreatedDetail`), `failed` (`{ error }`), `set-solar-power`
 * (`{ solar }`) and `open-settings` (`{ entity_id }`).
 *
 * It renders into the panel's shadow root (no own shadow root), so the
 * panel's dialog styles apply.
 */
export class EfmSolarSetup extends LitElement {
  static override properties = {
    hass: { attribute: false },
    localize: { attribute: false },
    context: { attribute: false },
    _solar: { state: true },
    _meterKind: { state: true },
    _preview: { state: true },
    _error: { state: true },
    _names: { state: true },
    _busy: { state: true },
  };

  declare hass?: HomeAssistant;
  /** The panel's texts; not `translate`, which every HTML element has. */
  declare localize: Translate;
  declare context: SolarSetupContext;
  /** The chosen solar source. */
  declare _solar: string | null;
  /** The meter kind (null: the suggested one). */
  declare _meterKind: SolarMeterKind | null;
  /** The backend's preview (null while it loads) or its error. */
  declare _preview: SolarPreview | null;
  declare _error: string | null;
  /** The names of the helpers, filled with defaults once the first preview arrives. */
  declare _names: SolarNames | null;
  /** Whether *Set up* is on its way. */
  declare _busy: boolean;

  /** Counts previews asked for; a late answer for an earlier one is dropped. */
  private _request = 0;

  constructor() {
    super();
    this.localize = (key) => key;
    this._solar = null;
    this._meterKind = null;
    this._preview = null;
    this._error = null;
    this._names = null;
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
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // A preview still on its way belongs to a closed dialog.
    this._request++;
  }

  protected override willUpdate(): void {
    // The only solar source is preselected.
    if (!this.hasUpdated && this.context.solars.length === 1 && this.context.saved) {
      void this._loadPreview(this.context.solars[0], null);
    }
  }

  private _emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Ask the backend what the setup would create for a solar and meter kind
   * (null: the suggested one). The names are filled with their defaults once
   * and kept when the kind changes; outdated answers are ignored.
   */
  async _loadPreview(solar: string, meterKind: SolarMeterKind | null): Promise<void> {
    if (!this.hass) {
      return;
    }
    const request = ++this._request;
    const stat = this.context.stat;
    this._solar = solar;
    this._meterKind = meterKind;
    this._preview = null;
    this._error = null;
    let preview: SolarPreview | null = null;
    let error: string | null = null;
    try {
      preview = await this.hass.callWS<SolarPreview>({
        type: `${DOMAIN}/solar_setup_preview`,
        stat,
        solar,
        ...(meterKind ? { kind: meterKind } : {}),
      });
    } catch (err) {
      error = errorText(this.hass, err);
    }
    if (request !== this._request || !this.isConnected || this.context.stat !== stat || this._solar !== solar) {
      return;
    }
    const name = this.context.deviceName;
    const names: SolarNames = this._names ?? {
      energy: this.localize("solar_gross_name", { name }),
      power: this.localize("solar_gross_power_name", { name }),
      integrals: {},
    };
    const integrals = { ...names.integrals };
    for (const { power } of preview?.integrals ?? []) {
      integrals[power] ??= `${this.context.sensorName(power)} ${this.localize("energy_suffix")}`;
    }
    this._preview = preview;
    this._error = error;
    this._meterKind = preview?.kind ?? meterKind;
    this._names = { ...names, integrals };
  }

  /**
   * Create the helpers of the setup right away; the panel then puts the gross
   * meter in the device's place in the draft (`created`). The user saves as
   * usual.
   */
  async _create(): Promise<void> {
    const preview = this._preview;
    const names = this._names;
    const solar = this._solar;
    if (!this.hass || !preview || !names || !solar || preview.blocked) {
      return;
    }
    const stat = this.context.stat;
    const name = names.energy.trim();
    const withPower = solarWithPower(preview);
    this._busy = true;
    try {
      const result = await this.hass.callWS<{ entity_id: string; stat_rate: string | null }>({
        type: `${DOMAIN}/create_solar_setup`,
        stat,
        solar,
        kind: preview.kind,
        name,
        ...(withPower ? { power_name: names.power.trim() } : {}),
        ...(preview.integrals.length
          ? {
              integral_names: Object.fromEntries(
                preview.integrals.map(({ power }) => [power, (names.integrals[power] ?? "").trim()]),
              ),
            }
          : {}),
      });
      const detail: SolarCreatedDetail = {
        stat,
        entity_id: result.entity_id,
        stat_rate: result.stat_rate,
        old: this.context.deviceName,
        name,
      };
      this._emit("created", detail);
    } catch (err) {
      this._emit("failed", { error: err });
    } finally {
      this._busy = false;
    }
  }

  private _setName(patch: Partial<SolarNames>): void {
    if (this._names) {
      this._names = { ...this._names, ...patch };
    }
  }

  protected override render(): TemplateResult {
    const t = this.localize;
    const { stat, deviceName: name, solars, saved } = this.context;
    const preview = this._preview;
    const names = this._names;
    const nameInput = (value: string, set: (value: string) => void) =>
      html`<input type="text" .value=${value} @input=${(e: Event) => set((e.target as HTMLInputElement).value)} />`;
    const cancel = html`<div class="dialog-actions">
      <button @click=${() => this._emit("close")}>${t("cancel")}</button>
    </div>`;
    const head = html`<h2>${t("solar_setup_title", { name })}</h2>
      <p class="hint">${t("solar_setup_intro")}</p>`;
    if (!saved || solars.length === 0) {
      return html`${head}
        <p class="warning solar-save-first">${t(saved ? "solar_setup_no_solar" : "solar_setup_save_first")}</p>
        ${cancel}`;
    }
    const kind = this._meterKind ?? preview?.kind ?? null;
    const returned = preview?.returned ?? null;
    const solarName = this._solar ? this.context.name(this._solar) : "";
    const meterKinds: SolarMeterKind[] = ["net", "draws"];
    // A disabled returned sensor gets its own note with a link; the reason
    // below names any other block.
    const disabledNote = preview !== null && kind === "draws" && preview.returned_disabled && returned !== null;
    const blocked =
      preview?.blocked && !(disabledNote && preview.blocked === "returned_disabled")
        ? errorText(this.hass, {
            translation_key: preview.blocked,
            translation_placeholders: {
              entity_id: preview.blocked_entity ? this.context.sensorName(preview.blocked_entity) : name,
            },
          })
        : null;
    const term = (entityId: string) => this.context.sensorName(entityId);
    const energyFormula =
      preview === null
        ? ""
        : kind === "draws" && returned !== null
          ? `${term(stat)} − ${term(returned)} + ${solarName}`
          : `${term(stat)} + ${solarName}`;
    // The constant that starts the gross meter above 0 (kWh).
    const offset = preview?.offset ?? 0;
    const withPower = preview !== null && solarWithPower(preview);
    // Every name shown is needed; an empty one would get the backend's untranslated default.
    const shownNames = [
      names?.energy,
      ...(withPower ? [names?.power] : []),
      ...(preview?.integrals ?? []).map(({ power }) => names?.integrals[power]),
    ];
    const namesMissing = shownNames.some((value) => !(value ?? "").trim());
    // The backend reads the saved power sensors; a draft that changes one is not used yet.
    const rate = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
    const savedSource = this.context.savedSources.find((s) => s.type === "solar" && s.stat_energy_from === this._solar);
    const draftSource = this.context.draftSources.find((s) => s.type === "solar" && s.stat_energy_from === this._solar);
    const { savedDevice, draftDevice } = this.context;
    const unsavedPower =
      preview !== null &&
      (rate(savedSource?.stat_rate) !== rate(draftSource?.stat_rate) ||
        rate(savedDevice?.stat_rate) !== rate(draftDevice?.stat_rate));
    const busy = this._busy || this.context.busy;
    return html`${head}
      <h3>${t("solar_setup_source")}</h3>
      ${solars.length === 1
        ? html`<p class="solar-source">${this.context.name(solars[0])}</p>`
        : html`<div class="solar-sources">
            ${solars.map(
              (solar) => html`<label class="check">
                <input
                  type="radio"
                  name="solar-source"
                  value=${solar}
                  .checked=${this._solar === solar}
                  @change=${() => void this._loadPreview(solar, this._meterKind)}
                />
                ${this.context.name(solar)}
              </label>`,
            )}
          </div>`}
      ${preview !== null && preview.solar_power === null && this._solar
        ? html`<p class="hint warning solar-no-power">${t("solar_setup_no_solar_power")}</p>
            <button class="solar-set-power" @click=${() => this._emit("set-solar-power", { solar: this._solar })}>
              ${t("solar_setup_set_solar_power")}
            </button>`
        : nothing}
      ${unsavedPower ? html`<p class="hint warning solar-unsaved-power">${t("solar_setup_unsaved_power")}</p>` : nothing}
      ${this._error ? html`<p class="warning">${this._error}</p>` : nothing}
      ${this._solar && preview === null && this._error === null ? html`<p>${t("checking")}</p>` : nothing}
      ${preview !== null
        ? html`<h3>${t("solar_setup_kind", { name })}</h3>
            <div class="solar-kinds">
              ${meterKinds.map(
                (meterKind) => html`<label class="check">
                    <input
                      type="radio"
                      name="solar-kind"
                      value=${meterKind}
                      .checked=${kind === meterKind}
                      @change=${() => this._solar && void this._loadPreview(this._solar, meterKind)}
                    />
                    ${t(meterKind === "net" ? "solar_kind_net" : "solar_kind_draws")}
                  </label>
                  <p class="hint solar-kind-hint">
                    ${t(meterKind === "net" ? "solar_kind_net_hint" : "solar_kind_draws_hint")}
                  </p>`,
              )}
            </div>
            <p class="hint solar-suggested">
              ${preview.suggested_kind === "draws" && returned !== null
                ? t("solar_suggested_draws", { entity: term(returned) })
                : t("solar_suggested_net")}
            </p>
            ${disabledNote
              ? html`<p class="warning solar-returned-disabled">
                    ${t("solar_setup_returned_disabled", { entity: term(returned!) })}
                  </p>
                  <button @click=${() => this._emit("open-settings", { entity_id: returned })}>
                    ${t("solar_setup_open_settings")}
                  </button>`
              : nothing}
            <h3>${t("solar_setup_preview")}</h3>
            ${blocked !== null || disabledNote
              ? blocked !== null
                ? html`<p class="warning solar-blocked">${blocked}</p>`
                : nothing
              : html`<ul class="solar-helpers">
                    ${preview.integrals.map(
                      ({ stat: meter, power }) => html`<li>
                        <label
                          >${t("solar_setup_integral", { power: term(power), meter: term(meter) })}
                          ${nameInput(names?.integrals[power] ?? "", (value) =>
                            this._setName({ integrals: { ...(names?.integrals ?? {}), [power]: value } }),
                          )}
                        </label>
                      </li>`,
                    )}
                    <li>
                      <label
                        >${t("solar_setup_energy", {
                          formula: offset ? `${energyFormula} + ${offset} kWh` : energyFormula,
                        })}
                        ${nameInput(names?.energy ?? "", (energy) => this._setName({ energy }))}
                      </label>
                      ${offset
                        ? html`<p class="hint solar-offset">${t("solar_setup_offset", { offset: String(offset) })}</p>`
                        : nothing}
                    </li>
                    ${withPower
                      ? html`<li>
                          <label
                            >${t("solar_setup_power", {
                              formula: `${term(preview.circuit_power!)} + ${term(preview.solar_power!)}`,
                            })}
                            ${nameInput(names?.power ?? "", (power) => this._setName({ power }))}
                          </label>
                        </li>`
                      : nothing}
                  </ul>
                  ${preview.circuit_power === null
                    ? html`<p class="hint solar-no-circuit-power">${t("solar_setup_no_circuit_power", { name })}</p>`
                    : preview.unusable_power
                      ? html`<p class="hint solar-unusable-power">
                          ${t("solar_setup_unusable_power", { entity: term(preview.unusable_power) })}
                        </p>`
                      : nothing}
                  <p class="hint">${t(withPower ? "solar_setup_text" : "solar_setup_text_no_power", { name })}</p>`}`
        : nothing}
      <div class="dialog-actions">
        <button @click=${() => this._emit("close")}>${t("cancel")}</button>
        ${preview !== null && blocked === null && !disabledNote
          ? html`<button class="primary" ?disabled=${busy || namesMissing} @click=${() => void this._create()}>
              ${busy ? t("creating") : t("solar_setup_button")}
            </button>`
          : nothing}
      </div>`;
  }
}

if (!customElements.get(SOLAR_SETUP_TAG)) {
  customElements.define(SOLAR_SETUP_TAG, EfmSolarSetup);
}
