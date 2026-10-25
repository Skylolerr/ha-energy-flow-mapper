// Loader of the dashboard card, loaded on every page of the frontend. It is
// kept small: the card itself is imported only when a dashboard shows it.

import { CARD_EDITOR_TAG, CARD_TAG, CARD_VIEW_TAG, cardConfig, type CardConfig } from "./card-config";

const VIEW_FILE = "energy-flow-mapper-card-view.js";

/** Description in the card picker; the card itself has the full translations. */
export const DESCRIPTIONS: Record<string, string> = {
  en: "The device tree of your energy dashboard, for electricity or water, now or in a period.",
  de: "Der Geräte-Baum deines Energie-Dashboards, für Strom oder Wasser, jetzt oder im Zeitraum.",
  fr: "L’arbre des appareils de ton tableau de bord énergie, pour l’électricité ou l’eau, maintenant ou sur une période.",
  it: "L’albero dei dispositivi della tua dashboard energia, per elettricità o acqua, ora o in un periodo.",
};

export function description(language: string): string {
  return DESCRIPTIONS[language] ?? DESCRIPTIONS[language.split("-")[0]] ?? DESCRIPTIONS.en;
}

/** Import the card; its URL keeps the loader's version query. */
let loadView = (): Promise<unknown> =>
  import(/* @vite-ignore */ new URL(VIEW_FILE + new URL(import.meta.url).search, import.meta.url).href);

/** Replace how the card is imported (tests). */
export function setViewLoader(load: () => Promise<unknown>): void {
  loadView = load;
}

type View = HTMLElement & { config?: CardConfig; hass?: unknown };

export class EnergyFlowMapperCard extends HTMLElement {
  private _config?: CardConfig;
  private _hass?: unknown;
  private _view?: View;

  /** Called by Home Assistant; an invalid configuration throws at once. */
  setConfig(config: unknown): void {
    this._config = cardConfig(config);
    void this._update();
  }

  set hass(hass: unknown) {
    this._hass = hass;
    void this._update();
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions(): { columns: number; min_columns: number } {
    return { columns: 12, min_columns: 6 };
  }

  static async getConfigElement(): Promise<HTMLElement> {
    await loadView();
    return document.createElement(CARD_EDITOR_TAG);
  }

  static getStubConfig(): Partial<CardConfig> {
    return { kind: "electricity", period: "today" };
  }

  private async _update(): Promise<void> {
    if (!this._view) {
      await loadView();
      // Another call may have created it while the card was loading.
      this._view ??= this.appendChild(document.createElement(CARD_VIEW_TAG) as View);
    }
    this._view.config = this._config;
    this._view.hass = this._hass;
  }
}

/**
 * Define the card on the registry the frontend uses now. Home Assistant puts
 * its own (scoped) registry in place of `window.customElements` while it
 * starts, and it loads this module at the same time as its own code, so this
 * module may run first. The registry is in place once `<home-assistant>` is
 * defined; then the card is defined again on it.
 */
export function defineCard(): void {
  if (!window.customElements.get(CARD_TAG)) {
    window.customElements.define(CARD_TAG, EnergyFlowMapperCard);
  }
}

defineCard();
void window.customElements.whenDefined("home-assistant").then(defineCard);

const page = window as Window & { customCards?: { type: string }[] };
page.customCards ??= [];
if (!page.customCards.some((card) => card.type === CARD_TAG)) {
  page.customCards.push({
    type: CARD_TAG,
    name: "Energy Flow Mapper",
    description: description(document.documentElement.lang || "en"),
    preview: true,
    documentationURL: "https://github.com/Skylolerr/ha-energy-flow-mapper#dashboard-card",
  } as { type: string });
}
