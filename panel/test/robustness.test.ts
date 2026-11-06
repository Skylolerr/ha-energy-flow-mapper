import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnergyFlowMapperPanel, PANEL_TAG } from "../src/energy-flow-mapper-panel";
import { anonymize, diagramSvg, escapeXml, FOOTER_H } from "../src/export";
import type { Change, HassEntity, HomeAssistant, Snapshot, StatInfo } from "../src/types";

function info(stat: string, name: string | null, extra: Partial<StatInfo> = {}): StatInfo {
  return {
    stat,
    entity_id: stat,
    name,
    unit: "kWh",
    device_class: "energy",
    device_id: null,
    device_name: null,
    area_id: null,
    area_name: null,
    floor_id: null,
    floor_name: null,
    ...extra,
  };
}

function snapshot(): Snapshot {
  return {
    prefs: {
      energy_sources: [{ type: "grid", stat_energy_from: "sensor.import", stat_energy_to: "sensor.export" }],
      device_consumption: [
        { stat_consumption: "sensor.server", stat_rate: "sensor.server_power" },
        { stat_consumption: "sensor.sonos", stat_rate: "sensor.sonos_power", included_in_stat: "sensor.server" },
        { stat_consumption: "sensor.tv", name: "TV" },
      ],
      device_consumption_water: [],
    },
    hash: "hash-1",
    stats: {
      "sensor.server": info("sensor.server", "Server & co", { area_name: "Office" }),
      "sensor.sonos": info("sensor.sonos", "Sonos amp"),
      "sensor.tv": info("sensor.tv", "TV backlight"),
      "sensor.import": info("sensor.import", "Grid import"),
      "sensor.export": info("sensor.export", "Grid export"),
    },
    candidates: [],
    water_candidates: [],
    power_candidates: [],
    issues: [],
  };
}

function entity(entity_id: string, state: string, unit = "W"): HassEntity {
  return { entity_id, state, attributes: { unit_of_measurement: unit } };
}

interface Mock {
  hass: HomeAssistant;
  calls: { type: string; [key: string]: unknown }[];
  responses: Record<string, unknown>;
}

function mockHass(snap: Snapshot = snapshot()): Mock {
  const mock: Mock = {
    calls: [],
    responses: {
      "energy_flow_mapper/get": snap,
      "energy_flow_mapper/validate": (msg: { changes: Change[] }) => ({
        valid: true,
        issues: [],
        diff: msg.changes.map((c) => ({ type: "moved", stat: c.stat })),
      }),
    },
    hass: undefined as unknown as HomeAssistant,
  };
  mock.hass = {
    locale: { language: "en" },
    states: {
      "sensor.server_power": entity("sensor.server_power", "50"),
      "sensor.sonos_power": entity("sensor.sonos_power", "10"),
    },
    callWS: vi.fn(async (msg: { type: string }) => {
      mock.calls.push(msg);
      const entry = mock.responses[msg.type];
      const response = typeof entry === "function" ? entry(msg) : entry;
      if (response instanceof Error) {
        throw response;
      }
      return structuredClone(response);
    }) as unknown as HomeAssistant["callWS"],
  };
  return mock;
}

async function settle(el: EnergyFlowMapperPanel): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }
}

async function mount(mock: Mock): Promise<EnergyFlowMapperPanel> {
  const el = document.createElement(PANEL_TAG);
  el.hass = mock.hass;
  document.body.append(el);
  await settle(el);
  return el;
}

function capture(el: EnergyFlowMapperPanel) {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const toPng = vi.fn(async (_svg: string, _w: number, _h: number) => new Blob(["png"], { type: "image/png" }));
  el._toPng = toPng;
  return toPng;
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("export: XML validity", () => {
  it("never puts characters into the SVG that XML 1.0 forbids", async () => {
    const snap = snapshot();
    // A name pasted from somewhere with a control character (vertical tab).
    snap.prefs.device_consumption[2].name = "TV\u000bcorner";
    const el = await mount(mockHass(snap));
    const toPng = capture(el);
    await el._saveImage(false);
    const svg = toPng.mock.calls[0][0];
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/.test(svg)).toBe(false);
  });
});

describe("export: DOM block order equals layout order", () => {
  it("has one top-level .block per layout block, kind by kind, with home meter, gas, collapsed, vertical", async () => {
    const snap = snapshot();
    snap.home_supported = true;
    snap.prefs.energy_sources.push({ type: "gas", stat_energy_from: "sensor.gas" } as never);
    snap.prefs.energy_sources.push({ type: "home", stat_energy_to: "sensor.main", stat_rate: "sensor.main_power" });
    snap.stats["sensor.main"] = info("sensor.main", "Main meter");
    snap.stats["sensor.gas"] = info("sensor.gas", "Gas meter");
    const mock = mockHass(snap);
    mock.hass.states["sensor.main_power"] = entity("sensor.main_power", "500");
    mock.hass.states["sensor.tv_power"] = entity("sensor.tv_power", "5");
    const el = await mount(mock);
    for (const orientation of ["horizontal", "vertical"] as const) {
      for (const collapsed of [new Set<string>(), new Set(["sensor.server"])]) {
        el._orientation = orientation;
        el._collapsed = collapsed;
        await settle(el);
        const blocks = el.diagramLayout().blocks;
        const elements = [...el.shadowRoot!.querySelectorAll(".canvas > .block")];
        expect(elements.length).toBe(blocks.length);
        blocks.forEach((b, i) => {
          const cls = elements[i].classList;
          const kind = b.kind === "placeholder" ? "placeholder" : b.kind;
          expect(cls.contains(kind), `${orientation} ${i} ${b.id}`).toBe(true);
          if (b.stat && b.kind === "device") {
            expect(elements[i].getAttribute("data-stat")).toBe(b.stat);
          }
        });
      }
    }
  });
});

describe("export: anonymize", () => {
  it("does not leak custom source names, the gas or water source name", async () => {
    const snap = snapshot();
    snap.home_supported = true;
    snap.prefs.energy_sources[0] = { ...snap.prefs.energy_sources[0], name: "Bahnhofstrasse 5" } as never;
    snap.prefs.energy_sources.push({ type: "gas", stat_energy_from: "sensor.gas", name: "Gas Muster" } as never);
    snap.prefs.energy_sources.push({ type: "home", stat_energy_to: "sensor.main", name: "Haupt Zähler" } as never);
    snap.stats["sensor.gas"] = info("sensor.gas", "Gasmeter Meier");
    snap.stats["sensor.main"] = info("sensor.main", "Main meter Meier");
    const el = await mount(mockHass(snap));
    const toPng = capture(el);
    await el._saveImage(true);
    const svg = toPng.mock.calls[0][0];
    for (const secret of ["Bahnhofstrasse", "Gas Muster", "Haupt", "Meier", "sensor."]) {
      expect(svg).not.toContain(secret);
    }
  });

  it("does not leak names in the water tab", async () => {
    const snap = snapshot();
    snap.prefs.energy_sources.push({ type: "water", stat_energy_from: "sensor.water", name: "Wasser Meier" } as never);
    snap.prefs.device_consumption_water = [{ stat_consumption: "sensor.tap", name: "Garten Meier" }];
    snap.stats["sensor.water"] = info("sensor.water", "Water Meier", { unit: "L" });
    snap.stats["sensor.tap"] = info("sensor.tap", "Tap Meier", { unit: "L", area_name: "Kinderzimmer" });
    const el = await mount(mockHass(snap));
    el.setTab("water");
    await settle(el);
    const toPng = capture(el);
    await el._saveImage(true);
    const svg = toPng.mock.calls[0][0];
    expect(svg).not.toContain("Meier");
    expect(svg).not.toContain("Kinderzimmer");
  });
});

describe("export: footer fits", () => {
  it("is not wider than the image in a small water diagram", async () => {
    const snap = snapshot();
    snap.prefs.device_consumption_water = [{ stat_consumption: "sensor.tap", name: "Tap" }];
    snap.stats["sensor.tap"] = info("sensor.tap", "Tap", { unit: "L" });
    const el = await mount(mockHass(snap));
    el.setTab("water");
    el._change({ type: "rename", stat: "sensor.tap", name: "Tap 2", kind: "water" } as Change);
    await settle(el);
    const toPng = capture(el);
    await el._saveImage(false);
    const svg = toPng.mock.calls[0][0];
    const width = Number(/width="(\d+)"/.exec(svg)![1]);
    const footer = /<text x="24"[^>]*>([^<]*)<\/text><\/svg>/.exec(svg)![1];
    // ~6 px per character at 12 px (a low estimate for Roboto), from x = 24.
    expect(24 + footer.length * 6).toBeLessThanOrEqual(width);
  });
});

describe("suggestions", () => {
  const pair = (stat: string, parent: string) => ({ kind: "electricity" as const, stat, parent });

  it("apply all with a cycle of suggestions applies only one", async () => {
    const snap = snapshot();
    snap.child_pairs = [pair("sensor.tv", "sensor.server"), pair("sensor.server", "sensor.tv")];
    const el = await mount(mockHass(snap));
    el._applyAllSuggestions();
    await settle(el);
    expect(el._changes).toHaveLength(1);
  });

  it("keeps the suggestion and reports when ignoring fails", async () => {
    const snap = snapshot();
    snap.child_pairs = [pair("sensor.tv", "sensor.server")];
    const mock = mockHass(snap);
    mock.responses["energy_flow_mapper/ignore_suggestion"] = new Error("boom");
    const el = await mount(mock);
    await el._ignoreSuggestion(snap.child_pairs[0]);
    await settle(el);
    expect(el.shadowRoot!.querySelector(".suggested")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".toast")).not.toBeNull();
  });
});

describe("coverage storage", () => {
  it("survives a throwing localStorage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const el = await mount(mockHass());
    expect(el._coverage).toBe(true);
    el.setCoverage(false);
    expect(el._coverage).toBe(false);
  });
});

describe("export unit helpers", () => {
  it("escapes", () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe("&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;");
  });
  it("anonymize numbers devices top to bottom", () => {
    const b = (id: string, kind: "device" | "source", x: number, y: number) => ({
      block: { id, kind, x, y, w: 10, h: 10 },
      title: id,
      sub: "s",
      area: "a",
      color: "#000",
      warn: false,
    });
    const out = anonymize([b("x", "device", 0, 50), b("y", "device", 0, 10), b("s", "source", 0, 0)], (n) => `D${n}`);
    expect(out.map((o) => o.title)).toEqual(["D2", "D1", "s"]);
    expect(FOOTER_H).toBe(40);
    expect(diagramSvg).toBeTypeOf("function");
  });
});

describe("export: Home with coverage", () => {
  it("keeps the coverage readable inside the Home block", async () => {
    localStorage.clear();
    const snap = snapshot();
    snap.home_supported = true;
    snap.prefs.energy_sources.push({ type: "home", stat_energy_to: "sensor.main", stat_rate: "sensor.main_power" });
    snap.stats["sensor.main"] = info("sensor.main", "Main meter");
    const mock = mockHass(snap);
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: { "sensor.server": 12.5, "sensor.sonos": 2, "sensor.tv": 0.5 },
      untracked: { home: 7 },
      issues: [],
      home: { value: 20, basis: "measured", stale: null, untracked: 7 },
    });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const toPng = capture(el);
    await el._saveImage(false);
    const svg = toPng.mock.calls[0][0];
    const home = el.diagramLayout().blocks.find((b) => b.kind === "home")!;
    const sub = [...svg.matchAll(/<text x="(\d+)"[^>]*font-size="12"[^>]*>([^<]*)<\/text>/g)].find(
      (m) => Number(m[1]) === home.x + 14 && m[2].includes("covered"),
    )!;
    expect(sub[2]).toContain("covered by devices");
    // The clip ends at x + w - 10; ~6 px per character at 12 px.
    expect(sub[2].length * 6).toBeLessThanOrEqual(home.w - 24);
  });
});

describe("export: collapsed devices", () => {
  it("shows that a collapsed device has hidden children", async () => {
    const el = await mount(mockHass());
    el._collapsed = new Set(["sensor.server"]);
    await settle(el);
    const toPng = capture(el);
    await el._saveImage(false);
    const svg = toPng.mock.calls[0][0];
    expect(svg).not.toContain("Sonos");
    // The panel shows ▸ on the block; the picture shows nothing of it.
    expect(svg).toMatch(/▸|\+1/);
  });
});

describe("export: failures and repeats", () => {
  it("closes the dialog and says plainly that the image failed", async () => {
    const el = await mount(mockHass());
    el._toPng = vi.fn(async () => {
      throw new Error("canvas");
    });
    el._dialog = { kind: "export", hideNames: false };
    await settle(el);
    await el._saveImage(false);
    await settle(el);
    expect(el.shadowRoot!.querySelector("dialog[open]")).toBeNull();
    expect(el.shadowRoot!.textContent).toContain("The image could not be created.");
    expect(el.shadowRoot!.textContent).not.toContain("vertical view");
  });

  it("saves once when Save is clicked twice", async () => {
    const el = await mount(mockHass());
    const toPng = capture(el);
    await Promise.all([el._saveImage(false), el._saveImage(false)]);
    expect(toPng).toHaveBeenCalledTimes(1);
  });
});

describe("suggestions are computed once per draft", () => {
  it("returns the same list until the draft changes", async () => {
    const snap = snapshot();
    snap.child_pairs = [{ kind: "electricity", stat: "sensor.tv", parent: "sensor.server" }];
    const el = await mount(mockHass(snap));
    const first = el._suggestions();
    expect(el._suggestions()).toBe(first);
    el._change({ type: "rename", stat: "sensor.tv", name: "Telly" });
    expect(el._suggestions()).not.toBe(first);
  });
});

describe("Home Assistant's texts", () => {
  it("tries loading them again after a failure", async () => {
    const mock = mockHass();
    mock.hass.loadBackendTranslation = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const el = await mount(mock);
    await el._load();
    await settle(el);
    expect(mock.hass.loadBackendTranslation).toHaveBeenCalledTimes(2);
  });
});

describe("Home without a home meter", () => {
  it("shows no value for a negative sum of the devices", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      // A meter that went backwards (reset) gives negative values.
      energy: { "sensor.server": -500, "sensor.sonos": 2, "sensor.tv": -19 },
      untracked: {},
      issues: [],
    });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const home = el.shadowRoot!.querySelector(".block.home")!.textContent!;
    expect(home).not.toMatch(/-\s?5/);
    expect(home).not.toContain("measured");
  });
});
