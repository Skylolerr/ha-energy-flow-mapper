import { afterEach, describe, expect, it, vi } from "vitest";

import { hasKey, LANGUAGES, localize } from "../src/localize";
import "../src/solar-setup";
import type { EfmSolarSetup, SolarSetupContext } from "../src/solar-setup";
import type { Change, HassEntity, HomeAssistant, SolarPreview, StatsEvidence } from "../src/types";

interface Mock {
  hass: HomeAssistant;
  calls: { type: string; [key: string]: unknown }[];
  responses: Record<string, unknown>;
}

function state(entity_id: string, name: string, unit: string): HassEntity {
  return { entity_id, state: "1", attributes: { friendly_name: name, unit_of_measurement: unit } };
}

function mockHass(language = "en"): Mock {
  const mock: Mock = { calls: [], responses: {}, hass: undefined as unknown as HomeAssistant };
  mock.hass = {
    locale: { language },
    config: { time_zone: "Europe/Zurich" },
    states: {
      "sensor.server": state("sensor.server", "Server energy", "kWh"),
      "sensor.server_returned": state("sensor.server_returned", "Server returned", "kWh"),
      "sensor.server_consumed": state("sensor.server_consumed", "Server consumed", "kWh"),
      "sensor.server_power": state("sensor.server_power", "Server power", "W"),
      "sensor.solar": state("sensor.solar", "Roof solar", "kWh"),
      "sensor.solar_power": state("sensor.solar_power", "Solar power", "W"),
    },
    entities: { "sensor.server": { entity_id: "sensor.server", device_id: "dev1" } },
    devices: { dev1: { name: "Circuit F11", model: "Shelly Pro EM" } },
    callWS: vi.fn(async (msg: { type: string }) => {
      mock.calls.push(msg);
      const entry = mock.responses[msg.type];
      const response = typeof entry === "function" ? entry(msg) : entry;
      if (response instanceof Promise) {
        return response;
      }
      if (response instanceof Error || (response as { translation_key?: string })?.translation_key) {
        throw response;
      }
      return structuredClone(response);
    }) as unknown as HomeAssistant["callWS"],
  };
  return mock;
}

function evidence(extra: Partial<StatsEvidence> = {}): StatsEvidence {
  return {
    periodic: false,
    certain: false,
    reason: null,
    drops: [],
    went_negative: false,
    series: [
      ["2026-11-21T00:00:00+01:00", 10],
      ["2026-11-21T01:00:00+01:00", 11],
      ["2026-11-21T02:00:00+01:00", 12],
    ],
    ...extra,
  };
}

function preview(extra: Partial<SolarPreview> = {}): SolarPreview {
  return {
    method: "em",
    suggested: "em",
    rule: "rule_shelly_em",
    methods: [
      { method: "em", offered: true, verified: true, reason: "rule_shelly_em" },
      { method: "plug", offered: true, verified: false, reason: "unverified_against_rule" },
      { method: "net", offered: true, verified: false, reason: "unverified_net" },
      { method: "power", offered: true, verified: true, reason: "power_signed" },
    ],
    drawn: "sensor.server",
    returned: "sensor.server_returned",
    invert: false,
    drawn_candidates: [{ entity: "sensor.server", disabled: false }],
    returned_candidates: [{ entity: "sensor.server_returned", disabled: false }],
    power: {
      circuit: "sensor.server_power",
      solar: "sensor.solar_power",
      signed: true,
      circuit_from: "saved",
      solar_from: "saved",
    },
    live: { circuit_w: -150, solar_w: 600, gross_w: 450 },
    evidence: {
      "sensor.server": evidence(),
      "sensor.server_returned": evidence(),
      "sensor.solar": evidence(),
    },
    solar_term: { kind: "integral", reuse: null },
    helpers: [
      { role: "solar_power", name_default: "Solar power (0 when offline)" },
      { role: "solar_energy", name_default: "Solar power energy" },
      { role: "power", name_default: "Server gross power" },
      { role: "energy", name_default: "Server gross" },
    ],
    offset: 0,
    blocked: null,
    blocked_entity: null,
    ...extra,
  };
}

const NAMES: Record<string, string> = {
  "sensor.server": "Server & co",
  "sensor.solar": "Roof solar",
  "sensor.balcony": "Balcony solar",
};

function context(mock: Mock, extra: Partial<SolarSetupContext> = {}): SolarSetupContext {
  return {
    stat: "sensor.server",
    deviceName: "Server & co",
    solars: ["sensor.solar"],
    solar: null,
    busy: false,
    name: (stat) => NAMES[stat] ?? stat,
    sensorName: (entityId) => String(mock.hass.states[entityId]?.attributes.friendly_name ?? entityId),
    draft: () => null,
    reload: async () => {},
    ...extra,
  };
}

type Events = Record<string, unknown[]>;

async function settle(el: EfmSolarSetup): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }
}

async function mount(
  mock: Mock,
  extra: Partial<SolarSetupContext> = {},
): Promise<{ el: EfmSolarSetup; events: Events }> {
  const el = document.createElement("efm-solar-setup") as EfmSolarSetup;
  const events: Events = {};
  for (const type of ["close", "created", "failed", "set-solar-power", "set-circuit-power", "open-settings"]) {
    events[type] = [];
    el.addEventListener(type, (e) => events[type].push((e as CustomEvent).detail));
  }
  el.localize = (key, placeholders) => localize(mock.hass, key, placeholders);
  el.hass = mock.hass;
  el.context = context(mock, extra);
  document.body.append(el);
  await settle(el);
  return { el, events };
}

function content(el: EfmSolarSetup): string {
  return el.textContent!.replace(/\s+/g, " ");
}

function button(el: EfmSolarSetup, label: string): HTMLButtonElement | undefined {
  return [...el.querySelectorAll("button")].find((b) => b.textContent!.includes(label));
}

function setUp(el: EfmSolarSetup): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>("button.solar-create")!;
}

function method(el: EfmSolarSetup, value: string): HTMLInputElement {
  return el.querySelector<HTMLInputElement>(`input[name="solar-method"][value="${value}"]`)!;
}

function methodRow(el: EfmSolarSetup, value: string): string {
  return el.querySelector(`.solar-method[data-method="${value}"]`)!.textContent!.replace(/\s+/g, " ");
}

function input(el: EfmSolarSetup, entity: string): HTMLElement {
  return el.querySelector<HTMLElement>(`.solar-input[data-entity="${entity}"]`)!;
}

function previews(mock: Mock): { type: string; [key: string]: unknown }[] {
  return mock.calls.filter((c) => c.type === "energy_flow_mapper/solar_setup_preview");
}

function last(mock: Mock, type: string) {
  return [...mock.calls].reverse().find((call) => call.type === type);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("solar setup methods", () => {
  it("shows suggested method with rule", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    const { el } = await mount(mock);
    expect(method(el, "em").checked).toBe(true);
    expect(methodRow(el, "em")).toContain("Suggested");
    expect(methodRow(el, "em")).toContain("fits your device (Shelly Pro EM)");
    expect(methodRow(el, "em")).toContain("gross = drawn − returned + solar");
    expect(methodRow(el, "power")).not.toContain("Suggested");
    expect(methodRow(el, "power")).toContain("its power went below 0");
    // Without the device registry the rule still names the kind of device.
    delete mock.hass.devices;
    el.requestUpdate();
    await settle(el);
    expect(methodRow(el, "em")).toContain("fits your device (Shelly)");
    // Each method has one sentence.
    for (const value of ["em", "plug", "net", "power"]) {
      expect(el.querySelector(`.solar-method[data-method="${value}"] .solar-method-hint`)!.textContent!.trim()).not.toBe("");
    }
  });

  it("unverified method shows nicht geprüft", async () => {
    const mock = mockHass("de");
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      method: "net",
      suggested: null,
      rule: null,
      methods: [
        { method: "em", offered: false, verified: false, reason: "no_returned_sensor" },
        { method: "plug", offered: false, verified: false, reason: "no_returned_sensor" },
        { method: "net", offered: true, verified: false, reason: "unverified_net" },
        { method: "power", offered: false, verified: false, reason: "no_power" },
      ],
    });
    const { el } = await mount(mock);
    expect(methodRow(el, "net")).toContain(
      "nicht geprüft – nur wählen, wenn dein Zähler beim Einspeisen rückwärts zählt; er ging in den letzten Tagen nie unter 0",
    );
    // Not offered: disabled, with the reason.
    expect(method(el, "em").disabled).toBe(true);
    expect(methodRow(el, "em")).toContain("keinen Sensor für zurückgespeiste Energie");
    expect(method(el, "power").disabled).toBe(true);
    expect(method(el, "net").disabled).toBe(false);
    // Every reason key the backend sends has a text, in every language.
    const reasons = [
      "rule_shelly_em",
      "rule_shelly_plug",
      "rule_shelly_consumed",
      "rule_net_negative",
      "power_signed",
      "unverified_against_rule",
      "unverified_may_reset",
      "unverified_net",
      "unverified_no_data",
      "unverified_power_unsigned",
      "net_needs_signed_meter",
      "no_returned_sensor",
      "daily_input",
      "unsupported_input",
      "no_power",
      "unusable_power",
    ];
    for (const reason of reasons) {
      expect(hasKey(`reason_${reason}`), reason).toBe(true);
    }
    for (const reason of reasons.filter((r) => r.startsWith("unverified_"))) {
      expect(localize(mock.hass, `reason_${reason}` as never)).toMatch(/^nicht geprüft – /);
    }
  });

  it("picking a method runs the preview with it", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string }) =>
      preview(msg.method ? { method: msg.method as SolarPreview["method"] } : {});
    const { el } = await mount(mock);
    expect(previews(mock)[0]).toEqual({
      type: "energy_flow_mapper/solar_setup_preview",
      stat: "sensor.server",
      solar: "sensor.solar",
    });
    method(el, "power").click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ method: "power" });
    expect(method(el, "power").checked).toBe(true);
  });
});

describe("solar setup inputs", () => {
  it("sparkline marks drops and daily switch locked when certain", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      evidence: {
        "sensor.server": evidence({
          periodic: true,
          certain: true,
          reason: "utility_meter",
          drops: [{ at: "2026-11-21T01:00:00+01:00", before: 11, after: 0 }],
          series: [
            ["2026-11-21T00:00:00+01:00", 10],
            ["2026-11-21T01:00:00+01:00", 0],
            ["2026-11-21T02:00:00+01:00", 1],
          ],
        }),
        "sensor.server_returned": evidence(),
      },
    });
    const { el } = await mount(mock);
    const drawn = input(el, "sensor.server");
    const line = drawn.querySelector("svg.solar-sparkline polyline")!;
    // The series as given: three points, no invented ones.
    expect(line.getAttribute("points")!.trim().split(/\s+/)).toHaveLength(3);
    expect(drawn.querySelectorAll("svg.solar-sparkline .drop")).toHaveLength(1);
    const daily = drawn.querySelector<HTMLInputElement>("input.solar-daily")!;
    expect(daily.checked).toBe(true);
    expect(daily.disabled).toBe(true);
    expect(drawn.textContent!.replace(/\s+/g, " ")).toContain("Starts again at 0 every day (periodic)");
    expect(drawn.textContent!.replace(/\s+/g, " ")).toContain("Fixed: a utility meter helper that resets in a cycle");
    // A lifetime meter: open switch, its own sentence, no drop mark.
    const returned = input(el, "sensor.server_returned");
    expect(returned.querySelectorAll("svg.solar-sparkline .drop")).toHaveLength(0);
    expect(returned.querySelector<HTMLInputElement>("input.solar-daily")!.disabled).toBe(false);
    expect(returned.querySelector<HTMLInputElement>("input.solar-daily")!.checked).toBe(false);
    expect(returned.textContent).toContain("rose in the last days without starting again at 0");
    // The solar has a power sensor: its counter is not read, so it is not listed.
    expect(el.querySelector('.solar-input[data-entity="sensor.solar"]')).toBeNull();
  });

  it("sends periodic only for switches the user touched", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      evidence: { "sensor.server": evidence({ periodic: true, reason: "drops" }), "sensor.server_returned": evidence() },
    });
    mock.responses["energy_flow_mapper/create_solar_setup"] = { entity_id: "sensor.server_gross", stat_rate: null };
    const { el } = await mount(mock);
    // The preselection from the statistics is shown, not sent.
    expect(input(el, "sensor.server").querySelector<HTMLInputElement>("input.solar-daily")!.checked).toBe(true);
    setUp(el).click();
    await settle(el);
    for (const call of mock.calls) {
      expect(call).not.toHaveProperty("periodic");
    }
    // Touched: only that input, with the user's value.
    input(el, "sensor.server_returned").querySelector<HTMLInputElement>("input.solar-daily")!.click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({
      periodic: { "sensor.server_returned": true },
    });
    setUp(el).click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/create_solar_setup")!.periodic).toEqual({ "sensor.server_returned": true });
  });

  it("an input without statistics asks the user and sends nothing until asked", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      evidence: {
        "sensor.server": evidence({ periodic: null, reason: "no_data", series: [] }),
        "sensor.server_returned": evidence(),
      },
    });
    const { el } = await mount(mock);
    const drawn = input(el, "sensor.server");
    expect(drawn.textContent).toContain("no statistics in the last days");
    expect(drawn.querySelector("svg")).toBeNull();
    const choices = [...drawn.querySelectorAll<HTMLInputElement>("input.solar-daily-choice")];
    expect(choices.map((c) => c.value)).toEqual(["daily", "lifetime"]);
    expect(choices.some((c) => c.checked)).toBe(false);
    choices[1].click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ periodic: { "sensor.server": false } });
  });

  it("a solar counter without power is listed and notes the night pause", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      power: { circuit: "sensor.server_power", solar: null, signed: true, circuit_from: "saved", solar_from: null },
      solar_term: { kind: "counter", reuse: null },
      helpers: [{ role: "energy", name_default: "Server gross" }],
    });
    const { el, events } = await mount(mock);
    expect(input(el, "sensor.solar")).not.toBeNull();
    expect(content(el)).toContain("At night the gross meter may pause");
    expect(content(el)).toContain("the totals stay right");
    button(el, "Set power sensor of the solar")!.click();
    expect(events["set-solar-power"]).toMatchObject([{ solar: "sensor.solar" }]);
  });
});

describe("solar setup pickers", () => {
  it("disabled returned opens settings", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { returned?: string }) =>
      preview({
        returned: msg.returned ?? "sensor.server_returned",
        returned_candidates: [
          { entity: "sensor.server_returned", disabled: false },
          { entity: "sensor.server_returned_b", disabled: true },
        ],
        drawn_candidates: [
          { entity: "sensor.server", disabled: false },
          { entity: "sensor.server_consumed", disabled: false },
        ],
      });
    const { el, events } = await mount(mock);
    const returned = el.querySelector<HTMLSelectElement>("select.solar-returned")!;
    // The preview's preselection.
    expect(returned.value).toBe("sensor.server_returned");
    expect([...returned.options].map((o) => o.textContent!.trim())).toEqual([
      "Server returned",
      "sensor.server_returned_b (disabled in Home Assistant)",
    ]);
    expect(content(el)).toContain("sensor.server_returned_b is disabled in Home Assistant.");
    button(el, "Open its settings")!.click();
    expect(events["open-settings"]).toEqual([{ entity_id: "sensor.server_returned_b" }]);
    // Picking runs the preview with the pick.
    const drawn = el.querySelector<HTMLSelectElement>("select.solar-drawn")!;
    drawn.value = "sensor.server_consumed";
    drawn.dispatchEvent(new Event("change"));
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ drawn: "sensor.server_consumed" });
  });
});

describe("solar setup power and offset", () => {
  it("invert switch changes live sum", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { invert?: boolean }) =>
      preview({
        method: "power",
        invert: msg.invert ?? false,
        live: msg.invert ? { circuit_w: 150, solar_w: 600, gross_w: 750 } : { circuit_w: -150, solar_w: 600, gross_w: 450 },
        power: { circuit: "sensor.server_power", solar: "sensor.solar_power", signed: true, circuit_from: "draft", solar_from: "paired" },
        helpers: [
          { role: "power", name_default: "Server gross power" },
          { role: "energy", name_default: "Server gross" },
        ],
      });
    const { el } = await mount(mock);
    expect(content(el)).toContain("Now: circuit -150 W + solar 600 W = 450 W");
    expect(content(el)).toContain("Server power (from your draft)");
    expect(content(el)).toContain("Solar power (found on its device)");
    expect(content(el)).toContain("has no history");
    const invert = el.querySelector<HTMLInputElement>("input.solar-invert")!;
    expect(invert.checked).toBe(false);
    invert.click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ invert: true });
    expect(content(el)).toContain("Now: circuit 150 W + solar 600 W = 750 W");
    expect(el.querySelector<HTMLInputElement>("input.solar-invert")!.checked).toBe(true);
    // Only From power has the switch.
    method(el, "em").click();
    await settle(el);
  });

  it("invert switch shown for EM when power is in helpers, hidden when not", async () => {
    const mock = mockHass("de");
    let signed = true;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { invert?: boolean }) =>
      signed
        ? preview({ invert: msg.invert ?? false })
        : preview({
            power_reason: "gross_power_needs_signed",
            helpers: [
              { role: "solar_power", name_default: "x" },
              { role: "solar_energy", name_default: "x" },
              { role: "energy", name_default: "x" },
            ],
          });
    const { el } = await mount(mock);
    // EM with a gross power: the same live check and switch as From power.
    expect(content(el)).toContain("Jetzt: Kreis -150 W + Solar 600 W = 450 W");
    el.querySelector<HTMLInputElement>("input.solar-invert")!.click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ invert: true });
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).not.toHaveProperty("method");
    expect(content(el)).not.toContain("keine Vorgeschichte");
    // Without a signed circuit power there is no gross power, and it says why.
    signed = false;
    method(el, "plug").click();
    await settle(el);
    expect(el.querySelector("input.solar-invert")).toBeNull();
    expect(content(el)).not.toContain("Jetzt: Kreis");
    expect(content(el)).toContain(
      "Ohne Live-Leistung: die Leistung des Kreises war in den letzten Tagen nie negativ, darum ist ihr Vorzeichen unklar",
    );
  });

  it("offset line shown when offset > 0", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string }) =>
      msg.method === "net" ? preview({ method: "net", offset: 0 }) : preview({ offset: 300 });
    const { el } = await mount(mock);
    expect(content(el)).toContain("Server energy − Server returned + Solar power energy + 300 kWh");
    expect(content(el)).toContain("The 300 kWh are added so the gross meter starts above 0");
    expect(content(el)).toContain("held for up to 10 minutes");
    method(el, "net").click();
    await settle(el);
    expect(content(el)).not.toContain("kWh are added");
    expect(content(el)).not.toContain("+ 0 kWh");
    expect(content(el)).toContain("Server energy + Solar power energy");
  });

  it("names per helper role, kept across previews and sent on create", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string }) =>
      msg.method === "power"
        ? preview({
            method: "power",
            helpers: [
              { role: "power", name_default: "x" },
              { role: "energy", name_default: "x" },
            ],
          })
        : preview({ solar_term: { kind: "integral", reuse: null } });
    mock.responses["energy_flow_mapper/create_solar_setup"] = { entity_id: "sensor.server_gross", stat_rate: "sensor.gp" };
    const { el, events } = await mount(mock);
    const names = () => [...el.querySelectorAll<HTMLInputElement>("input.solar-name")];
    expect(names().map((i) => [i.dataset.role, i.value])).toEqual([
      ["solar_power", "Solar power (0 when offline)"],
      ["solar_energy", "Solar power energy"],
      ["power", "Server & co gross power"],
      ["energy", "Server & co gross"],
    ]);
    const energy = names().find((i) => i.dataset.role === "energy")!;
    energy.value = "Circuit F11 gross";
    energy.dispatchEvent(new Event("input"));
    await settle(el);
    method(el, "power").click();
    await settle(el);
    expect(names().map((i) => i.value)).toEqual(["Server & co gross power", "Circuit F11 gross"]);
    setUp(el).click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/create_solar_setup")).toEqual({
      type: "energy_flow_mapper/create_solar_setup",
      stat: "sensor.server",
      solar: "sensor.solar",
      method: "power",
      drawn: "sensor.server",
      returned: "sensor.server_returned",
      invert: false,
      offset: 0,
      names: { power: "Server & co gross power", energy: "Circuit F11 gross" },
    });
    expect(events.created).toEqual([
      { stat: "sensor.server", entity_id: "sensor.server_gross", stat_rate: "sensor.gp", old: "Server & co", name: "Circuit F11 gross" },
    ]);
  });

  it("a reused solar term is named and not created", async () => {
    const mock = mockHass();
    mock.hass.states["sensor.solar_energy"] = state("sensor.solar_energy", "Solar energy", "kWh");
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      solar_term: { kind: "integral", reuse: "sensor.solar_energy" },
      helpers: [
        { role: "power", name_default: "x" },
        { role: "energy", name_default: "x" },
      ],
    });
    const { el } = await mount(mock);
    expect(content(el)).toContain("Uses the existing solar energy helper Solar energy.");
    expect(content(el)).toContain("Server energy − Server returned + Solar energy");
  });
});

describe("solar setup without dead ends", () => {
  it("retry after failed preview keeps choices", async () => {
    const mock = mockHass();
    let fail = false;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string; invert?: boolean }) =>
      fail ? new Error("offline") : preview({ method: (msg.method as SolarPreview["method"]) ?? "em", invert: msg.invert ?? false });
    const { el } = await mount(mock);
    method(el, "power").click();
    await settle(el);
    fail = true;
    el.querySelector<HTMLInputElement>("input.solar-invert")!.click();
    await settle(el);
    expect(content(el)).toContain("Error: offline");
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("The check failed; try again.");
    fail = false;
    button(el, "Try again")!.click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ method: "power", invert: true });
    expect(method(el, "power").checked).toBe(true);
    expect(setUp(el).disabled).toBe(false);
    expect(content(el)).not.toContain("Error: offline");
  });

  it("disabled set up says why", async () => {
    const mock = mockHass();
    let resolve: (value: unknown) => void = () => {};
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () => new Promise((r) => (resolve = r));
    const { el } = await mount(mock);
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("Still checking …");
    resolve(preview({ blocked: "solar_already_in_meter", blocked_entity: "sensor.server" }));
    await settle(el);
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("Server & co already adds up the solar");
    expect(content(el)).toContain("Solve the problem above first.");
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    method(el, "plug").click();
    await settle(el);
    expect(setUp(el).disabled).toBe(false);
    const name = el.querySelector<HTMLInputElement>('input.solar-name[data-role="energy"]')!;
    name.value = " ";
    name.dispatchEvent(new Event("input"));
    await settle(el);
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("Give every helper a name.");
    // No method at all: nothing to set up, and it says so.
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({ method: null, suggested: null, blocked: "no_safe_method", blocked_entity: "sensor.server" });
    method(el, "net").click();
    await settle(el);
    expect(content(el)).toContain("No method fits Server & co");
  });

  it("several solars: none picked yet says why", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    const { el } = await mount(mock, { solars: ["sensor.solar", "sensor.balcony"] });
    expect(previews(mock)).toHaveLength(0);
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("Choose a solar.");
  });

  it("create values_changed reruns preview", async () => {
    const mock = mockHass();
    let offset = 100;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () => preview({ offset });
    mock.responses["energy_flow_mapper/create_solar_setup"] = (msg: { offset: number }) =>
      msg.offset < 200
        ? { translation_key: "values_changed", translation_placeholders: { entity_id: "sensor.server" } }
        : { entity_id: "sensor.server_gross", stat_rate: null };
    const { el, events } = await mount(mock);
    expect(content(el)).toContain("+ 100 kWh");
    offset = 200;
    setUp(el).click();
    await settle(el);
    expect(previews(mock)).toHaveLength(2);
    expect(content(el)).toContain("The values of Server & co changed meanwhile");
    expect(content(el)).toContain("+ 200 kWh");
    expect(events.failed).toEqual([]);
    expect(events.created).toEqual([]);
    setUp(el).click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/create_solar_setup")).toMatchObject({ offset: 200 });
    expect(events.created).toHaveLength(1);
  });

  it("create not_offered reruns preview", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    mock.responses["energy_flow_mapper/create_solar_setup"] = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.server_returned" },
    };
    const { el, events } = await mount(mock);
    setUp(el).click();
    await settle(el);
    expect(previews(mock)).toHaveLength(2);
    expect(content(el)).toContain("Server returned is not offered here");
    expect(events.failed).toEqual([]);
  });

  it("a stale pick in the preview is dropped and checked again", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { returned?: string }) =>
      msg.returned === "sensor.gone"
        ? { translation_key: "not_offered", translation_placeholders: { entity_id: "sensor.gone" } }
        : preview({
            returned_candidates: [
              { entity: "sensor.server_returned", disabled: false },
              { entity: "sensor.gone", disabled: false },
            ],
          });
    const { el } = await mount(mock);
    const returned = el.querySelector<HTMLSelectElement>("select.solar-returned")!;
    returned.value = "sensor.gone";
    returned.dispatchEvent(new Event("change"));
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).not.toHaveProperty("returned");
    expect(setUp(el).disabled).toBe(false);
    expect(content(el)).toContain("sensor.gone is not offered here");
  });

  it("conflict reloads the draft and checks again", async () => {
    const mock = mockHass();
    let hash = "hash-1";
    const changes: Change[] = [{ type: "set_rate", stat: "sensor.server", stat_rate: "sensor.server_power" }];
    const reload = vi.fn(async () => {
      hash = "hash-2";
    });
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { base_hash: string }) =>
      msg.base_hash === "hash-1" ? { translation_key: "conflict" } : preview();
    mock.responses["energy_flow_mapper/create_solar_setup"] = (msg: { base_hash: string }) =>
      msg.base_hash === "hash-2" ? { translation_key: "conflict" } : { entity_id: "sensor.server_gross", stat_rate: null };
    const { el, events } = await mount(mock, { draft: () => ({ base_hash: hash, changes }), reload });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(previews(mock).map((c) => c.base_hash)).toEqual(["hash-1", "hash-2"]);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ changes });
    expect(setUp(el).disabled).toBe(false);
    reload.mockImplementation(async () => {
      hash = "hash-3";
    });
    setUp(el).click();
    await settle(el);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).toMatchObject({ base_hash: "hash-3" });
    expect(content(el)).toContain("changed meanwhile");
    expect(events.failed).toEqual([]);
    setUp(el).click();
    await settle(el);
    expect(events.created).toHaveLength(1);
  });

  it("blocked keys get a way forward", async () => {
    const mock = mockHass();
    let blocked: Partial<SolarPreview> = { blocked: "solar_needs_power", blocked_entity: "sensor.solar" };
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () =>
      preview({
        ...blocked,
        power: { circuit: "sensor.server_power", solar: null, signed: true, circuit_from: "saved", solar_from: null },
        solar_term: { kind: null, reuse: null },
      });
    const { el, events } = await mount(mock);
    expect(content(el)).toContain("This solar needs a power sensor");
    el.querySelector<HTMLButtonElement>(".solar-blocked-action")!.click();
    expect(events["set-solar-power"]).toMatchObject([{ solar: "sensor.solar" }]);

    blocked = { blocked: "solar_needs_data", blocked_entity: "sensor.solar" };
    method(el, "plug").click();
    await settle(el);
    expect(content(el)).toContain("or wait a day or two");
    expect(el.querySelector(".solar-blocked-action")!.textContent).toContain("Set power sensor of the solar");

    blocked = { blocked: "daily_check_failed", blocked_entity: "sensor.server" };
    method(el, "net").click();
    await settle(el);
    const calls = previews(mock).length;
    button(el, "Check again")!.click();
    await settle(el);
    expect(previews(mock)).toHaveLength(calls + 1);

    blocked = { blocked: "input_disabled", blocked_entity: "sensor.server_consumed" };
    method(el, "em").click();
    await settle(el);
    expect(content(el)).toContain("Server consumed is disabled in Home Assistant");
    el.querySelector<HTMLButtonElement>(".solar-blocked-action")!.click();
    expect(events["open-settings"]).toEqual([{ entity_id: "sensor.server_consumed" }]);
  });

  it("every blocked and error key of the setup has a text", () => {
    const hass = mockHass().hass;
    for (const key of [
      "solar_already_in_meter",
      "daily_check_failed",
      "unsupported_input",
      "solar_needs_power",
      "solar_needs_data",
      "no_safe_method",
      "daily_without_power",
      "not_offered",
      "choose_returned",
      "returned_disabled",
      "input_disabled",
      "input_not_ready",
      "values_changed",
      "conflict",
      "unknown_device",
      "unknown_source",
    ]) {
      expect(hasKey(`error_${key}`), key).toBe(true);
    }
    expect(hasKey("error_no_returned_sensor")).toBe(false);
    expect(localize(hass, "error_solar_needs_power", { entity_id: "X" })).toContain("X");
  });
});

describe("solar setup context and lifecycle", () => {
  it("sends the draft, preselects the sum's solar and works for a draft-only device", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    const changes: Change[] = [{ type: "add", stat: "sensor.server", parent: null }];
    const { el } = await mount(mock, {
      solars: ["sensor.solar", "sensor.balcony"],
      solar: "sensor.balcony",
      draft: () => ({ base_hash: "hash-1", changes }),
    });
    expect(previews(mock)).toEqual([
      {
        type: "energy_flow_mapper/solar_setup_preview",
        stat: "sensor.server",
        solar: "sensor.balcony",
        base_hash: "hash-1",
        changes,
      },
    ]);
    expect(el.querySelector<HTMLInputElement>('input[name="solar-source"][value="sensor.balcony"]')!.checked).toBe(true);
    expect(content(el)).not.toContain("Save your draft first");
  });

  it("asks for the preview once hass arrives", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    const el = document.createElement("efm-solar-setup") as EfmSolarSetup;
    el.localize = (key, placeholders) => localize(mock.hass, key, placeholders);
    el.context = context(mock);
    document.body.append(el);
    await settle(el);
    expect(previews(mock)).toHaveLength(0);
    el.hass = mock.hass;
    await settle(el);
    expect(previews(mock)).toHaveLength(1);
    expect(method(el, "em").checked).toBe(true);
  });

  it("renders its buttons on connect, so a dialog can focus them", () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () => new Promise(() => {});
    const dialog = document.createElement("dialog");
    document.body.append(dialog);
    const el = document.createElement("efm-solar-setup") as EfmSolarSetup;
    el.localize = (key, placeholders) => localize(mock.hass, key, placeholders);
    el.hass = mock.hass;
    el.context = context(mock);
    dialog.append(el);
    // No await: showModal runs right after the panel appended the content.
    expect(dialog.querySelector("button")).not.toBeNull();
  });

  it("cancel during create still ends in created", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    let resolve: (value: unknown) => void = () => {};
    mock.responses["energy_flow_mapper/create_solar_setup"] = () => new Promise((r) => (resolve = r));
    const { el, events } = await mount(mock);
    setUp(el).click();
    await settle(el);
    expect(setUp(el).textContent).toContain("Creating");
    button(el, "Cancel")!.click();
    expect(events.close).toHaveLength(1);
    // The panel closes the dialog: the element leaves the page.
    el.remove();
    resolve({ entity_id: "sensor.server_gross", stat_rate: null });
    await settle(el);
    // The helpers exist: the panel must still put the meter into the draft.
    expect(events.created).toHaveLength(1);
  });

  it("any failed create checks again, so a block shows in the dialog", async () => {
    const mock = mockHass();
    let blocked: Partial<SolarPreview> = {};
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () => preview(blocked);
    mock.responses["energy_flow_mapper/create_solar_setup"] = () => {
      blocked = { blocked: "input_not_ready", blocked_entity: "sensor.server_returned" };
      return { translation_key: "input_not_ready", translation_placeholders: { entity_id: "sensor.server_returned" } };
    };
    const { el, events } = await mount(mock);
    setUp(el).click();
    await settle(el);
    expect(events.failed).toHaveLength(1);
    expect(previews(mock)).toHaveLength(2);
    expect(content(el)).toContain("Server returned has no value right now");
    expect(button(el, "Check again")).toBeDefined();
  });

  it("a chosen method no longer offered is dropped, with a note", async () => {
    const mock = mockHass();
    let plugGone = false;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string }) => {
      const methods = preview().methods.map((m) =>
        m.method === "plug" && plugGone ? { ...m, offered: false, verified: false, reason: "daily_input" } : m,
      );
      return preview({
        methods,
        method: (msg.method as SolarPreview["method"]) ?? "em",
        ...(msg.method === "plug" && plugGone ? { blocked: "not_offered", blocked_entity: "sensor.server" } : {}),
      });
    };
    mock.responses["energy_flow_mapper/create_solar_setup"] = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.server" },
    };
    const { el, events } = await mount(mock);
    method(el, "plug").click();
    await settle(el);
    plugGone = true;
    input(el, "sensor.server").querySelector<HTMLInputElement>("input.solar-daily")!.click();
    await settle(el);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).not.toHaveProperty("method");
    expect(method(el, "em").checked).toBe(true);
    expect(content(el)).toContain("The chosen way is no longer possible – choose another one above.");
    // The same when create finds it gone.
    plugGone = false;
    input(el, "sensor.server").querySelector<HTMLInputElement>("input.solar-daily")!.click();
    await settle(el);
    method(el, "plug").click();
    await settle(el);
    setUp(el).click();
    await settle(el);
    expect(events.failed).toEqual([]);
    expect(last(mock, "energy_flow_mapper/solar_setup_preview")).not.toHaveProperty("method");
    expect(content(el)).toContain("The chosen way is no longer possible");
  });

  it("a refused draft power says why and leads to its power dialog", async () => {
    const mock = mockHass();
    let refused = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.server_energy_x", power: "solar", why: "not_power" },
    };
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () => refused;
    const { el, events } = await mount(mock);
    expect(content(el)).toContain(
      "sensor.server_energy_x, the power sensor of Roof solar in your draft, is not a power sensor",
    );
    expect(button(el, "Try again")).toBeUndefined();
    expect(setUp(el).disabled).toBe(true);
    expect(content(el)).toContain("Choose another power sensor first.");
    button(el, "Set power sensor of the solar")!.click();
    expect(events["set-solar-power"]).toHaveLength(1);
    expect(events["set-solar-power"][0]).toMatchObject({ solar: "sensor.solar" });

    refused = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.solar_power", power: "circuit", why: "used" },
    };
    void el._loadPreview();
    await settle(el);
    expect(content(el)).toContain("Solar power, the power sensor of Server & co in your draft, is already used");
    el.querySelector<HTMLButtonElement>(".solar-refused-action")!.click();
    expect(events["set-circuit-power"]).toHaveLength(1);
    expect(events["set-circuit-power"][0]).toMatchObject({ stat: "sensor.server" });
    refused = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.gp", power: "circuit", why: "ours" },
    };
    void el._loadPreview();
    await settle(el);
    expect(content(el)).toContain("is a gross power this setup made");
  });

  it("names which power is missing for a daily meter, with a way to set it", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      method: null,
      suggested: null,
      power: { circuit: null, solar: null, signed: false, circuit_from: null, solar_from: null },
      blocked: "daily_without_power",
      blocked_entity: "sensor.server",
    });
    const { el, events } = await mount(mock);
    expect(content(el)).toContain("Server & co has no power sensor.");
    expect(content(el)).toContain("Roof solar has no power sensor.");
    const actions = [...el.querySelectorAll<HTMLButtonElement>(".solar-blocked-action")];
    expect(actions.map((b) => b.textContent!.trim())).toEqual([
      "Set power sensor of Server & co",
      "Set power sensor of the solar",
    ]);
    actions[0].click();
    actions[1].click();
    expect(events["set-circuit-power"]).toHaveLength(1);
    expect(events["set-solar-power"]).toHaveLength(1);
  });

  it("no_safe_method names the missing power too", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      method: null,
      suggested: null,
      power: { circuit: "sensor.server_power", solar: null, signed: false, circuit_from: "saved", solar_from: null },
      solar_term: { kind: "counter", reuse: null },
      blocked: "no_safe_method",
      blocked_entity: "sensor.server",
    });
    const { el } = await mount(mock);
    expect(content(el)).toContain("Roof solar has no power sensor.");
    expect(content(el)).not.toContain("Server & co has no power sensor.");
    expect(el.querySelectorAll(".solar-blocked-action")).toHaveLength(1);
  });

  it("the daily check failed: inputs are not checked and have no switch", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      evidence: {},
      blocked: "daily_check_failed",
      blocked_entity: "sensor.server",
    });
    const { el } = await mount(mock);
    const drawn = input(el, "sensor.server");
    expect(drawn.textContent).toContain("not checked – the statistics could not be read");
    expect(drawn.textContent).not.toContain("no statistics");
    expect(drawn.querySelector("input")).toBeNull();
  });

  it("the solar counter without statistics has no radios", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      power: { circuit: "sensor.server_power", solar: null, signed: true, circuit_from: "saved", solar_from: null },
      solar_term: { kind: null, reuse: null },
      evidence: {
        "sensor.server": evidence(),
        "sensor.server_returned": evidence(),
        "sensor.solar": evidence({ periodic: null, reason: "no_data", series: [] }),
      },
      blocked: "solar_needs_data",
      blocked_entity: "sensor.solar",
    });
    const { el } = await mount(mock);
    expect(input(el, "sensor.solar").querySelector("input")).toBeNull();
    expect(input(el, "sensor.solar").textContent).toContain("no statistics in the last days");
  });

  it("resumes its choices and names, and hands them out with the power buttons", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = (msg: { method?: string }) =>
      preview({
        method: (msg.method as SolarPreview["method"]) ?? "em",
        power: { circuit: "sensor.server_power", solar: null, signed: true, circuit_from: "saved", solar_from: null },
      });
    const state = {
      solar: "sensor.solar",
      choices: { method: "net" as const, drawn: null, returned: null, invert: null, periodic: { "sensor.server": false } },
      names: { energy: "Kept gross" },
    };
    const { el, events } = await mount(mock, { resume: state });
    expect(previews(mock)[0]).toMatchObject({ method: "net", periodic: { "sensor.server": false } });
    expect(el.querySelector<HTMLInputElement>('input.solar-name[data-role="energy"]')!.value).toBe("Kept gross");
    button(el, "Set power sensor of the solar")!.click();
    expect(events["set-solar-power"]).toEqual([{ solar: "sensor.solar", state }]);
  });

  it("names its groups and points Set up to its reason", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      blocked: "solar_already_in_meter",
      blocked_entity: "sensor.server",
      evidence: {
        "sensor.server": evidence({ periodic: null, reason: "no_data", series: [] }),
        "sensor.server_returned": evidence(),
      },
    });
    const { el } = await mount(mock, { solars: ["sensor.solar", "sensor.balcony"], solar: "sensor.solar" });
    const legends = [...el.querySelectorAll("fieldset > legend")].map((l) => l.textContent!.trim());
    expect(legends).toContain("Solar");
    expect(legends).toContain("How should the gross meter be built?");
    const group = input(el, "sensor.server").querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe("Server & co: does it start again at 0 every day?");
    for (const radio of group.querySelectorAll("input")) {
      expect(radio.getAttribute("aria-label")).toMatch(/^Server & co: /);
    }
    expect(input(el, "sensor.server_returned").querySelector("input.solar-daily")!.getAttribute("aria-label")).toBe(
      "Server returned: Starts again at 0 every day (periodic)",
    );
    const why = el.querySelector(".solar-why")!;
    expect(why.id).not.toBe("");
    expect(setUp(el).getAttribute("aria-describedby")).toBe(why.id);
    expect(el.querySelector(".solar-status")!.getAttribute("aria-live")).toBe("polite");
  });

  it("texts say what the hold keeps and what the rule trusts", () => {
    const hass = mockHass().hass;
    expect(localize(hass, "solar_setup_hold")).toContain("unknown");
    expect(localize(hass, "reason_unverified_against_rule")).toContain("returned sensor");
    expect(localize(mockHass("de").hass, "solar_setup_disabled_sensor", { entity: "X" })).toContain("deaktiviert");
    expect(Object.values(LANGUAGES.de).join(" ")).not.toContain("ausgeschaltet");
  });

  it("without a signed power it says the old power is not kept and cannot be added later", async () => {
    const mock = mockHass("de");
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      power_reason: "gross_power_needs_signed",
      helpers: [{ role: "energy", name_default: "x" }],
    });
    const { el } = await mount(mock);
    expect(content(el)).toContain(
      "Die bisherige Leistung von Server & co wird nicht übernommen, weil sie netto ist. Eine Live-Leistung lässt sich später nicht nachrüsten; willst du eine, richte das erst ein, wenn der Kreis einmal eingespeist hat.",
    );
    for (const language of ["en", "fr", "it"]) {
      expect(localize(mockHass(language).hass, "solar_setup_power_not_kept", { device: "X" })).toContain("X");
    }
  });

  it("a daily meter with an unusable circuit power names that power and its way on", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview({
      method: null,
      suggested: null,
      methods: preview().methods.map((m) =>
        m.method === "power" ? { ...m, offered: false, verified: false, reason: "unusable_power" } : m,
      ),
      power: { circuit: "sensor.server_power", solar: "sensor.solar_power", signed: false, circuit_from: "saved", solar_from: "saved" },
      blocked: "daily_without_power",
      blocked_entity: "sensor.server",
    });
    const { el, events } = await mount(mock);
    expect(content(el)).toContain("Server power, the power sensor of Server & co, is disabled or has no power unit that can be read.");
    const actions = [...el.querySelectorAll<HTMLButtonElement>(".solar-blocked-action")];
    expect(actions.map((b) => b.textContent!.trim())).toEqual(["Set power sensor of Server & co", "Open its settings"]);
    actions[0].click();
    actions[1].click();
    expect(events["set-circuit-power"]).toHaveLength(1);
    expect(events["open-settings"]).toEqual([{ entity_id: "sensor.server_power" }]);
  });

  it("create finds the suggested method gone: the way note, not the old one", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    mock.responses["energy_flow_mapper/create_solar_setup"] = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.server" },
    };
    const { el, events } = await mount(mock);
    setUp(el).click();
    await settle(el);
    expect(events.failed).toEqual([]);
    expect(previews(mock)).toHaveLength(2);
    expect(content(el)).toContain("The chosen way is no longer possible – choose another one above.");
    expect(content(el)).not.toContain("is not offered here");
  });

  it("a power refused as no power sensor can be checked again", async () => {
    const mock = mockHass();
    let refused = true;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = () =>
      refused
        ? {
            translation_key: "not_offered",
            translation_placeholders: { entity_id: "sensor.solar_power", power: "solar", why: "not_power" },
          }
        : preview();
    const { el } = await mount(mock);
    expect(button(el, "Try again")).toBeUndefined();
    // Offline at night it may have no unit yet: checking again can help.
    refused = false;
    button(el, "Check again")!.click();
    await settle(el);
    expect(previews(mock)).toHaveLength(2);
    expect(setUp(el).disabled).toBe(false);
    // Used elsewhere cannot change by itself: no «Check again».
    refused = true;
    mock.responses["energy_flow_mapper/solar_setup_preview"] = {
      translation_key: "not_offered",
      translation_placeholders: { entity_id: "sensor.solar_power", power: "solar", why: "used" },
    };
    void el._loadPreview();
    await settle(el);
    expect(button(el, "Check again")).toBeUndefined();
  });

  it("a failed create keeps the dialog and says so", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/solar_setup_preview"] = preview();
    mock.responses["energy_flow_mapper/create_solar_setup"] = new Error("boom");
    const { el, events } = await mount(mock);
    setUp(el).click();
    await settle(el);
    expect(events.failed).toHaveLength(1);
    expect(events.close).toHaveLength(0);
    expect(setUp(el).disabled).toBe(false);
  });
});
