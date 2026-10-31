import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CARD_EDITOR_TAG, CARD_TAG, CARD_VIEW_TAG, cardConfig, type CardConfig } from "../src/card-config";
import {
  DESCRIPTIONS,
  defineCard,
  description,
  EnergyFlowMapperCard,
  LOAD_ERRORS,
  setViewLoader,
} from "../src/card-loader";
import {
  CARD_REFRESH_MS,
  type CardData,
  type EnergyFlowMapperCardEditor,
  type EnergyFlowMapperCardView,
} from "../src/card";
import { LANGUAGES } from "../src/localize";
import type { HomeAssistant } from "../src/types";

function data(extra: Partial<CardData> = {}): CardData {
  return {
    kind: "electricity",
    devices: [
      { stat: "sensor.server", name: "Server & co", parent: null, stat_rate: "sensor.server_power", area: "Office" },
      { stat: "sensor.nas", name: "NAS", parent: "sensor.server", stat_rate: "sensor.nas_power", area: "Office" },
      { stat: "portal:tv", name: "TV", parent: null, stat_rate: null, area: null },
    ],
    sources: [{ type: "grid", role: "import", stat: "sensor.import", name: "Grid import" }],
    water_unit: "L",
    ...extra,
  };
}

interface Mock {
  hass: HomeAssistant;
  calls: Record<string, unknown>[];
  answer: (msg: Record<string, unknown>) => unknown;
}

function mockHass(answer: Mock["answer"] = (msg) => (msg.period ? data(periodValues()) : data())): Mock {
  const mock: Mock = { calls: [], answer, hass: undefined as unknown as HomeAssistant };
  mock.hass = {
    locale: { language: "en" },
    states: {
      "sensor.server_power": { entity_id: "sensor.server_power", state: "50", attributes: { unit_of_measurement: "W" } },
      "sensor.nas_power": { entity_id: "sensor.nas_power", state: "10", attributes: { unit_of_measurement: "W" } },
    },
    callWS: vi.fn(async (msg: Record<string, unknown>) => {
      mock.calls.push(msg);
      const result = mock.answer(msg);
      if (result instanceof Error || (result as { translation_key?: string })?.translation_key) {
        throw result;
      }
      return result instanceof Promise ? result : structuredClone(result);
    }) as unknown as HomeAssistant["callWS"],
  };
  return mock;
}

function periodValues(): Partial<CardData> {
  return {
    energy: { "sensor.server": 12.5, "sensor.nas": 14, "portal:tv": 0.42 },
    issues: [{ code: "children_exceed_parent", severity: "warning", stat: "sensor.server", details: {}, kind: "electricity" }],
  };
}

async function settle(el: HTMLElement & { updateComplete?: Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }
}

async function view(config: Partial<CardConfig>, mock = mockHass()): Promise<EnergyFlowMapperCardView> {
  const el = document.createElement(CARD_VIEW_TAG) as EnergyFlowMapperCardView;
  el.config = cardConfig({ type: `custom:${CARD_TAG}`, ...config });
  el.hass = mock.hass;
  document.body.append(el);
  await settle(el);
  return el;
}

function text(el: HTMLElement): string {
  return el.shadowRoot!.textContent!.replace(/\s+/g, " ");
}

function block(el: HTMLElement, stat: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`.block.device[data-stat="${stat}"]`);
}

beforeAll(async () => {
  setViewLoader(() => import("../src/card"));
  await import("../src/card");
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("card configuration", () => {
  it("fills in defaults and refuses wrong values", () => {
    expect(cardConfig({ type: "custom:x" })).toEqual({
      type: "custom:x",
      kind: "electricity",
      period: "today",
      orientation: "horizontal",
      show_sources: true,
      show_untracked: true,
    });
    expect(cardConfig({ orientation: "vertical" }).orientation).toBe("vertical");
    expect(() => cardConfig({ orientation: "diagonal" })).toThrow("orientation must be one of");
    expect(cardConfig({ kind: "water", period: "now", show_sources: false, root: "sensor.a" })).toMatchObject({
      type: `custom:${CARD_TAG}`,
      kind: "water",
      period: "now",
      show_sources: false,
      root: "sensor.a",
    });
    expect(() => cardConfig(null)).toThrow("Invalid configuration");
    expect(() => cardConfig({ kind: "gas" })).toThrow("kind must be one of");
    expect(() => cardConfig({ period: "year" })).toThrow("period must be one of");
    expect(() => cardConfig({ title: 3 })).toThrow("title must be text");
  });
});

describe("card loader", () => {
  it("registers the card for the picker in every language", () => {
    const cards = (window as Window & { customCards?: { type: string; name: string }[] }).customCards!;
    expect(cards.find((c) => c.type === CARD_TAG)?.name).toBe("Energy Flow Mapper");
    expect(Object.keys(DESCRIPTIONS).sort()).toEqual(Object.keys(LANGUAGES).sort());
    expect(description("de-CH")).toBe(DESCRIPTIONS.de);
    expect(description("xx")).toBe(DESCRIPTIONS.en);
  });

  it("defines the card again on a registry Home Assistant puts in place later", () => {
    const native = window.customElements;
    const defined = new Map<string, CustomElementConstructor>();
    const scoped = {
      get: (tag: string) => defined.get(tag),
      define: (tag: string, cls: CustomElementConstructor) => void defined.set(tag, cls),
    } as unknown as CustomElementRegistry;
    Object.defineProperty(window, "customElements", { value: scoped, configurable: true });
    try {
      defineCard();
      defineCard();
      expect(defined.get(CARD_TAG)).toBe(EnergyFlowMapperCard);
      expect(defined.size).toBe(1);
    } finally {
      Object.defineProperty(window, "customElements", { value: native, configurable: true });
    }
    const cards = (window as Window & { customCards?: { type: string }[] }).customCards!;
    expect(cards.filter((c) => c.type === CARD_TAG).length).toBe(1);
  });

  it("says so when the card cannot be loaded, and does not try again", async () => {
    const load = vi.fn(() => Promise.reject(new Error("offline")));
    setViewLoader(load);
    try {
      const card = document.createElement(CARD_TAG) as EnergyFlowMapperCard;
      card.setConfig({ type: `custom:${CARD_TAG}` });
      card.hass = { locale: { language: "de" } };
      document.body.append(card);
      await settle(card);
      card.hass = { locale: { language: "de" } };
      await settle(card);
      expect(card.textContent).toBe(LOAD_ERRORS.de);
      expect(card.querySelectorAll("ha-card").length).toBe(1);
      expect(load).toHaveBeenCalledTimes(1);
      expect(Object.keys(LOAD_ERRORS).sort()).toEqual(Object.keys(LANGUAGES).sort());
    } finally {
      setViewLoader(() => import("../src/card"));
    }
  });

  it("checks the configuration at once and passes it to the card", async () => {
    const card = document.createElement(CARD_TAG) as EnergyFlowMapperCard;
    expect(() => card.setConfig({ kind: "gas" })).toThrow();
    const mock = mockHass();
    card.setConfig({ type: `custom:${CARD_TAG}`, period: "now" });
    card.hass = mock.hass;
    document.body.append(card);
    await settle(card);
    await settle(card);
    const inner = card.querySelector(CARD_VIEW_TAG) as EnergyFlowMapperCardView;
    expect(card.querySelectorAll(CARD_VIEW_TAG).length).toBe(1);
    expect(inner.config?.period).toBe("now");
    expect(inner.hass).toBe(mock.hass);
    expect(card.getCardSize()).toBe(6);
    expect(card.getGridOptions()).toEqual({ columns: 12, min_columns: 6 });
    expect(EnergyFlowMapperCard.getStubConfig()).toEqual({ kind: "electricity", period: "today" });
    expect((await EnergyFlowMapperCard.getConfigElement()).tagName.toLowerCase()).toBe(CARD_EDITOR_TAG);
  });
});

describe("card", () => {
  it("shows sources, Home, devices with energy and untracked, and the warning", async () => {
    const mock = mockHass();
    const el = await view({ period: "week" }, mock);
    expect(mock.calls).toEqual([{ type: "energy_flow_mapper/card", kind: "electricity", period: "week" }]);
    expect(text(el)).toContain("Energy flow");
    expect(text(el)).toContain("7 days");
    expect(el.shadowRoot!.querySelector('.block.source[data-role="import"]')!.textContent).toContain("Grid import");
    expect(el.shadowRoot!.querySelector(".block.home")!.textContent).toContain("12.9 kWh measured");
    expect(block(el, "sensor.server")!.textContent).toContain("12.5 kWh · Office");
    expect(block(el, "sensor.server")!.querySelector(".badge")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".block.untracked")!.textContent).toContain("-1.5 kWh");
    const edges = [...el.shadowRoot!.querySelectorAll<SVGGElement>(".edge")].map((e) => `${e.dataset.from}>${e.dataset.to}`);
    expect(edges).toEqual(expect.arrayContaining(["source:0>home", "home>sensor.server", "sensor.server>sensor.nas"]));
    // The diagram is scaled to the card, but not below 50 %: then it scrolls.
    el._width = 300;
    await settle(el);
    const canvas = el.shadowRoot!.querySelector<HTMLElement>(".canvas")!;
    expect(canvas.style.transform).toMatch(/^scale\(0\.5\)/);
    const sizer = el.shadowRoot!.querySelector<HTMLElement>(".sizer")!;
    expect(Number.parseFloat(sizer.style.width)).toBeGreaterThan(268);
    // It starts scrolled to the middle, once.
    const diagram = el.shadowRoot!.querySelector<HTMLElement>(".diagram")!;
    Object.defineProperty(diagram, "scrollWidth", { value: 900, configurable: true });
    Object.defineProperty(diagram, "clientWidth", { value: 300, configurable: true });
    (el as unknown as { _centred: boolean })._centred = false;
    el.requestUpdate();
    await settle(el);
    expect(diagram.scrollLeft).toBe(300);
    diagram.scrollLeft = 10;
    el.requestUpdate();
    await settle(el);
    expect(diagram.scrollLeft).toBe(10);
    // With enough room it keeps its size and is centred.
    el._width = 2000;
    await settle(el);
    expect(canvas.style.transform).toMatch(/^scale\(1\)/);
    expect(sizer.style.width).toBe("100%");
    expect(Number.parseFloat(canvas.style.left)).toBeGreaterThan(0);
  });

  it("shows power now from the states, without asking for a period", async () => {
    const mock = mockHass();
    const el = await view({ period: "now" }, mock);
    expect(mock.calls[0]).toEqual({ type: "energy_flow_mapper/card", kind: "electricity" });
    expect(block(el, "sensor.server")!.textContent).toContain("50 W");
    expect(el.shadowRoot!.querySelector(".block.untracked")!.textContent).toContain("40 W");
    expect(text(el)).toContain("Now");
  });

  it("starts at a device, without sources and Home", async () => {
    const el = await view({ root: "sensor.server", period: "now" });
    expect(el.shadowRoot!.querySelector(".block.home")).toBeNull();
    expect(el.shadowRoot!.querySelector(".block.source")).toBeNull();
    expect(block(el, "sensor.nas")).not.toBeNull();
    expect(block(el, "portal:tv")).toBeNull();
    const missing = await view({ root: "sensor.gone" });
    expect(text(missing)).toContain("This device is no longer in the energy dashboard.");
  });

  it("hides sources, untracked blocks and the title on request", async () => {
    const el = await view({ show_sources: false, show_untracked: false, title: "", period: "now" });
    expect(el.shadowRoot!.querySelector(".block.source")).toBeNull();
    expect(el.shadowRoot!.querySelector(".block.untracked")).toBeNull();
    // An empty title hides the whole header, the period included.
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    const titled = await view({ title: "Basement" });
    expect(titled.shadowRoot!.querySelector(".title")!.textContent).toBe("Basement");
  });

  it("shows the tree from left to right when vertical, starting at the left", async () => {
    const position = (el: HTMLElement, selector: string) => {
      const style = el.shadowRoot!.querySelector<HTMLElement>(selector)!.style;
      return { x: Number.parseFloat(style.left), y: Number.parseFloat(style.top) };
    };
    const el = await view({ period: "now", orientation: "vertical" });
    const home = position(el, ".block.home");
    const server = position(el, '.block.device[data-stat="sensor.server"]');
    const nas = position(el, '.block.device[data-stat="sensor.nas"]');
    const tv = position(el, '.block.device[data-stat="portal:tv"]');
    expect(position(el, ".block.source").x).toBeLessThan(home.x);
    expect(server.x).toBeGreaterThan(home.x);
    expect(nas.x).toBeGreaterThan(server.x);
    expect(tv.x).toBe(server.x);
    expect(tv.y).toBeGreaterThan(server.y);
    // The arrow leaves Home on its right side and points right.
    const edge = el.shadowRoot!.querySelector<SVGGElement>('.edge[data-from="home"][data-to="sensor.server"]')!;
    const start = edge.querySelector("path")!.getAttribute("d")!.split(" ");
    expect(Number(start[1])).toBe(home.x + 220);
    // Home is at the left now, so a scrolling diagram stays there.
    const diagram = el.shadowRoot!.querySelector<HTMLElement>(".diagram")!;
    Object.defineProperty(diagram, "scrollWidth", { value: 900, configurable: true });
    Object.defineProperty(diagram, "clientWidth", { value: 300, configurable: true });
    el.config = cardConfig({ type: "x", period: "now" });
    await settle(el);
    expect(diagram.scrollLeft).toBe(300);
    expect(position(el, ".block.home").y).toBeGreaterThan(position(el, ".block.source").y);
    el.config = cardConfig({ type: "x", period: "now", orientation: "vertical" });
    await settle(el);
    expect(diagram.scrollLeft).toBe(0);
  });

  it("loads again when it comes back, and stops watching its size when it leaves", async () => {
    const disconnect = vi.fn();
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect = disconnect;
    } as unknown as typeof ResizeObserver;
    try {
      const mock = mockHass();
      const el = await view({ period: "week" }, mock);
      expect(mock.calls.length).toBe(1);
      el.remove();
      expect(disconnect).toHaveBeenCalled();
      document.body.append(el);
      await settle(el);
      expect(mock.calls.length).toBe(2);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it("shows water in litres and m³, and flow now", async () => {
    const water: CardData = {
      kind: "water",
      devices: [
        { stat: "sensor.house", name: "House", parent: null, stat_rate: "sensor.house_flow", area: null },
        { stat: "sensor.shower", name: "Shower", parent: "sensor.house", stat_rate: null, area: null },
      ],
      sources: [{ type: "water", role: "water", stat: "sensor.main", name: "Water main" }],
      water_unit: "L",
    };
    const mock = mockHass((msg) =>
      msg.period ? { ...water, energy: { "sensor.house": 1500, "sensor.shower": 400 }, issues: [] } : water,
    );
    mock.hass.states["sensor.house_flow"] = {
      entity_id: "sensor.house_flow",
      state: "0.5",
      attributes: { unit_of_measurement: "m³/h" },
    };
    const month = await view({ kind: "water", period: "month" }, mock);
    expect(mock.calls[0]).toMatchObject({ kind: "water", period: "month" });
    expect(text(month)).toContain("Water flow");
    expect(block(month, "sensor.house")!.textContent).toContain("1.5 m³");
    expect(block(month, "sensor.shower")!.textContent).toContain("400 L");
    expect(month.shadowRoot!.querySelector('.block.source[data-role="water"]')!.textContent).toContain("Water main");
    const now = await view({ kind: "water", period: "now" }, mock);
    expect(block(now, "sensor.house")!.textContent).toContain("8.33 L/min");
  });

  it("opens the history of entities, not of external statistics", async () => {
    const el = await view({ period: "now" });
    const events: string[] = [];
    el.addEventListener("hass-more-info", (e) => events.push((e as CustomEvent).detail.entityId));
    block(el, "sensor.server")!.click();
    block(el, "sensor.nas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    block(el, "sensor.nas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    block(el, "portal:tv")!.click();
    expect(events).toEqual(["sensor.server", "sensor.nas"]);
    expect(block(el, "portal:tv")!.getAttribute("role")).toBeNull();
  });

  it("reports errors, loading and an empty tree", async () => {
    const failing = await view({}, mockHass(() => ({ translation_key: "not_loaded" })));
    expect(text(failing)).toContain("Energy Flow Mapper is not loaded.");
    const empty = await view({}, mockHass(() => ({ ...data(), devices: [] })));
    expect(text(empty)).toContain("No devices in the energy dashboard yet.");
    const pending = await view({}, mockHass(() => new Promise(() => undefined)));
    expect(text(pending)).toContain("Loading");
    const bare = document.createElement(CARD_VIEW_TAG) as EnergyFlowMapperCardView;
    document.body.append(bare);
    await settle(bare);
    await bare._load();
    expect(text(bare)).toContain("Loading");
  });

  it("loads again on a new period and every minute, ignoring outdated answers", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const mock = mockHass();
    const el = await view({ period: "now" }, mock);
    expect(mock.calls.length).toBe(1);
    vi.advanceTimersByTime(CARD_REFRESH_MS);
    await settle(el);
    expect(mock.calls.length).toBe(2);
    el.config = cardConfig({ type: "x", period: "today" });
    await settle(el);
    expect(mock.calls.at(-1)).toMatchObject({ period: "today" });
    // A slow answer for an older request does not win.
    let release: (value: unknown) => void = () => undefined;
    mock.answer = () => new Promise((resolve) => (release = resolve));
    const slow = el._load();
    mock.answer = () => data({ devices: [] });
    await el._load();
    release(data());
    await slow;
    await settle(el);
    expect(text(el)).toContain("No devices in the energy dashboard yet.");
    el.remove();
    vi.advanceTimersByTime(CARD_REFRESH_MS);
    expect(mock.calls.length).toBe(5);
  });
});

describe("card editor", () => {
  async function editor(config: Partial<CardConfig>, mock = mockHass()): Promise<EnergyFlowMapperCardEditor> {
    const el = document.createElement(CARD_EDITOR_TAG) as EnergyFlowMapperCardEditor;
    el.setConfig({ type: `custom:${CARD_TAG}`, ...config });
    el.hass = mock.hass;
    document.body.append(el);
    await settle(el);
    return el;
  }

  it("offers the fields with the devices of the list", async () => {
    const mock = mockHass();
    const el = await editor({ kind: "electricity" }, mock);
    expect(mock.calls).toEqual([{ type: "energy_flow_mapper/card", kind: "electricity" }]);
    const schema = el.schema();
    expect(schema.map((f) => f.name)).toEqual([
      "title",
      "kind",
      "period",
      "root",
      "orientation",
      "show_sources",
      "show_untracked",
    ]);
    const root = schema[3].selector as { select: { options: { value: string; label: string }[] } };
    expect(root.select.options).toEqual([
      { value: "", label: "Whole home" },
      { value: "sensor.server", label: "Server & co" },
      { value: "sensor.nas", label: "NAS" },
      { value: "portal:tv", label: "TV" },
    ]);
    const kind = schema[1].selector as { select: { options: { label: string }[] } };
    expect(kind.select.options.map((o) => o.label)).toEqual(["Electricity", "Water"]);
    const orientation = schema[4].selector as { select: { options: { value: string; label: string }[] } };
    expect(orientation.select.options).toEqual([
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
    ]);
    expect(schema.map((f) => el.computeLabel(f))).toEqual([
      "Title (empty: no title)",
      "Show",
      "Period",
      "Start at device",
      "Orientation",
      "Show sources",
      "Show what is not tracked individually",
    ]);
    const form = el.shadowRoot!.querySelector("ha-form") as HTMLElement & { data: Record<string, unknown> };
    expect(form.data.root).toBe("");
  });

  it("reports changes; another list drops the device", async () => {
    const el = await editor({ kind: "electricity", root: "sensor.server", title: "Home" });
    const changes: Record<string, unknown>[] = [];
    el.addEventListener("config-changed", (e) => changes.push((e as CustomEvent).detail.config));
    const form = el.shadowRoot!.querySelector("ha-form")!;
    form.dispatchEvent(new CustomEvent("value-changed", { detail: { value: { period: "week", title: "" } } }));
    // An empty title is kept (it hides the header); defaults stay out.
    expect(changes.at(-1)).toEqual({ type: `custom:${CARD_TAG}`, period: "week", root: "sensor.server", title: "" });
    el._valueChanged({ period: "today", root: "", title: null });
    expect(changes.at(-1)).toEqual({ type: `custom:${CARD_TAG}` });
    el._valueChanged({ show_untracked: false });
    expect(changes.at(-1)).toMatchObject({ show_untracked: false });
    el._valueChanged({ orientation: "vertical" });
    expect(changes.at(-1)).toMatchObject({ orientation: "vertical" });
    el._valueChanged({ orientation: "horizontal" });
    expect(changes.at(-1)).not.toHaveProperty("orientation");
    el._valueChanged({ kind: "water" });
    expect(changes.at(-1)).toMatchObject({ kind: "water" });
    expect(changes.at(-1)).not.toHaveProperty("root");
    await settle(el);
    expect(el._config?.kind).toBe("water");
  });

  it("keeps working without devices or configuration", async () => {
    const failing = await editor({}, mockHass(() => ({ translation_key: "not_loaded" })));
    expect(failing._devices).toEqual([]);
    // A late failure for the old list does not empty the list of the new one.
    let fail: (reason: unknown) => void = () => undefined;
    const mock = mockHass((msg) => (msg.kind === "water" ? data({ kind: "water" }) : new Promise((_, reject) => (fail = reject))));
    const switching = await editor({ kind: "electricity" }, mock);
    switching._valueChanged({ kind: "water" });
    await settle(switching);
    expect(switching._devices.length).toBe(3);
    fail({ translation_key: "not_loaded" });
    await settle(switching);
    expect(switching._devices.length).toBe(3);
    const bare = document.createElement(CARD_EDITOR_TAG) as EnergyFlowMapperCardEditor;
    document.body.append(bare);
    await settle(bare);
    bare._valueChanged({ period: "now" });
    expect(bare.shadowRoot!.querySelector("ha-form")).toBeNull();
  });
});
