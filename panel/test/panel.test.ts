import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnergyFlowMapperPanel, errorText, PANEL_TAG, TOAST_MS } from "../src/energy-flow-mapper-panel";
import type {
  BackupEntry,
  Change,
  HassEntity,
  HomeAssistant,
  Snapshot,
  StatInfo,
  ValidateResult,
} from "../src/types";

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
      energy_sources: [
        { type: "grid", stat_energy_from: "sensor.import", stat_energy_to: "sensor.export" },
      ],
      device_consumption: [
        { stat_consumption: "sensor.server", stat_rate: "sensor.server_power" },
        {
          stat_consumption: "sensor.sonos",
          stat_rate: "sensor.sonos_power",
          included_in_stat: "sensor.server",
        },
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
    candidates: [
      {
        ...info("sensor.printer", "3D printer", { area_name: "Office", device_name: "Plug" }),
        power: "sensor.printer_power",
      },
      { ...info("sensor.attic", "Attic"), power: null },
    ],
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

function mockHass(language = "en"): Mock {
  const mock: Mock = {
    calls: [],
    responses: {
      "energy_flow_mapper/get": snapshot(),
      // One diff entry per change is close enough for the panel.
      "energy_flow_mapper/validate": (msg: { changes: Change[] }) => ({
        valid: true,
        issues: [],
        diff: msg.changes.map((c) => ({ type: "moved", stat: c.stat })),
      }),
      "energy_flow_mapper/save": { hash: "hash-2", backup_id: "b2" },
      "energy_flow_mapper/backups": { backups: [] },
      "energy_flow_mapper/restore": { hash: "hash-3", backup_id: "b3" },
    },
    hass: undefined as unknown as HomeAssistant,
  };
  mock.hass = {
    locale: { language },
    states: {
      "sensor.server_power": entity("sensor.server_power", "50"),
      "sensor.sonos_power": entity("sensor.sonos_power", "10"),
    },
    callWS: vi.fn(async (msg: { type: string }) => {
      mock.calls.push(msg);
      const entry = mock.responses[msg.type];
      const response = typeof entry === "function" ? entry(msg) : entry;
      if (response instanceof Error || (response as { translation_key?: string })?.translation_key) {
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

async function mount(mock: Mock, narrow = false): Promise<EnergyFlowMapperPanel> {
  const el = document.createElement(PANEL_TAG);
  el.narrow = narrow;
  el.hass = mock.hass;
  document.body.append(el);
  await settle(el);
  return el;
}

function root(el: EnergyFlowMapperPanel): ShadowRoot {
  return el.shadowRoot!;
}

function text(el: EnergyFlowMapperPanel): string {
  return root(el).textContent!.replace(/\s+/g, " ");
}

function node(el: EnergyFlowMapperPanel, stat: string): HTMLElement {
  return root(el).querySelector<HTMLElement>(`.node[data-stat="${stat}"]`)!;
}

function buttonWith(el: EnergyFlowMapperPanel, label: string): HTMLButtonElement {
  const button = [...root(el).querySelectorAll("button")].find((b) =>
    b.textContent!.includes(label),
  );
  if (!button) {
    throw new Error(`No button "${label}"`);
  }
  return button;
}

function lastCall(mock: Mock, type: string) {
  return [...mock.calls].reverse().find((call) => call.type === type);
}

function drag(source: HTMLElement, target: HTMLElement): void {
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
  source.dispatchEvent(Object.assign(new Event("dragstart", { bubbles: true }), { dataTransfer }));
  target.dispatchEvent(Object.assign(new Event("dragover", { bubbles: true, cancelable: true }), { dataTransfer }));
  target.dispatchEvent(Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer }));
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("loading", () => {
  it("shows sources, the tree with power and untracked, and free sensors", async () => {
    const mock = await mount(mockHass()).then((el) => ({ el }));
    const el = mock.el;
    expect(text(el)).toContain("Grid import");
    expect(text(el)).toContain("Grid export");
    const server = node(el, "sensor.server");
    expect(server.textContent).toContain("Server & co");
    expect(server.textContent).toContain("50 W");
    // The own name wins over the entity name.
    expect(node(el, "sensor.tv").textContent).toContain("TV");
    expect(node(el, "sensor.tv").textContent).not.toContain("backlight");
    // Sonos is nested under the server; 40 W are not tracked individually.
    const nested = server.parentElement!.querySelector('ul .node[data-stat="sensor.sonos"]');
    expect(nested).not.toBeNull();
    expect(root(el).querySelector(".untracked")!.textContent).toContain("40 W");
    expect(text(el)).toContain("3D printer");
    expect(text(el)).toContain("Attic");
  });

  it("shows a translated error when loading fails", async () => {
    const mock = mockHass("de");
    mock.responses["energy_flow_mapper/get"] = { translation_key: "unsupported_energy_api" };
    const el = await mount(mock);
    expect(text(el)).toContain("konnten nicht geladen werden");
    expect(text(el)).toContain("ist der Editor deaktiviert");
  });

  it("filters free sensors by search", async () => {
    const el = await mount(mockHass());
    const input = root(el).querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = "office";
    input.dispatchEvent(new Event("input"));
    await settle(el);
    expect(text(el)).toContain("3D printer");
    expect(text(el)).not.toContain("Attic");
  });
});

describe("editing", () => {
  it("moves a device with the menu and validates the draft", async () => {
    const mock = mockHass();
    const el = await mount(mock);
    node(el, "sensor.tv").querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!.click();
    await settle(el);
    buttonWith(el, "Move to").click();
    await settle(el);
    const targets = [...root(el).querySelectorAll<HTMLButtonElement>("button.target")];
    // TV is at the top level already: only devices are offered.
    expect(targets.map((b) => b.dataset.target)).toEqual(["sensor.server", "sensor.sonos"]);
    targets[1].click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "move", stat: "sensor.tv", parent: "sensor.sonos" }]);
    expect(lastCall(mock, "energy_flow_mapper/validate")).toMatchObject({
      base_hash: "hash-1",
      changes: el._changes,
    });
    expect(root(el).querySelector(".footer")!.textContent).toContain("1 change");
  });

  it("drags a device onto another one, but not into its own children", async () => {
    const el = await mount(mockHass());
    drag(node(el, "sensor.server"), node(el, "sensor.sonos"));
    expect(el._changes).toEqual([]);
    drag(node(el, "sensor.tv"), node(el, "sensor.server"));
    await settle(el);
    expect(el._changes).toEqual([{ type: "move", stat: "sensor.tv", parent: "sensor.server" }]);
    drag(node(el, "sensor.tv"), root(el).querySelector<HTMLElement>(".home")!);
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "move", stat: "sensor.tv", parent: null });
  });

  it("adds a free sensor by dragging, with its power sensor", async () => {
    const el = await mount(mockHass());
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.printer"]')!;
    drag(candidate, node(el, "sensor.server"));
    await settle(el);
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.printer", parent: "sensor.server", stat_rate: "sensor.printer_power" },
    ]);
    expect(node(el, "sensor.printer")).not.toBeNull();
    // Added sensors are no longer free.
    expect(root(el).querySelector('.candidate[data-stat="sensor.printer"]')).toBeNull();
  });

  it("adds a free sensor with the add dialog", async () => {
    const el = await mount(mockHass());
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.attic"]')!;
    candidate.querySelector("button")!.click();
    await settle(el);
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="__home__"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "add", stat: "sensor.attic", parent: null, stat_rate: null }]);
  });

  it("renames and removes", async () => {
    const el = await mount(mockHass());
    node(el, "sensor.sonos").querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!.click();
    await settle(el);
    buttonWith(el, "Rename").click();
    await settle(el);
    const input = root(el).querySelector<HTMLInputElement>('dialog input[type="text"]')!;
    input.value = " Amp ";
    input.dispatchEvent(new Event("input"));
    buttonWith(el, "OK").click();
    await settle(el);
    node(el, "sensor.server").querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!.click();
    await settle(el);
    buttonWith(el, "Remove").click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "rename", stat: "sensor.sonos", name: "Amp" },
      { type: "remove", stat: "sensor.server" },
    ] satisfies Change[]);
    // Sonos moved up to the top level.
    expect(node(el, "sensor.sonos").textContent).toContain("Amp");
    expect(root(el).querySelector(".untracked")).toBeNull();
  });

  it("discards the draft", async () => {
    const el = await mount(mockHass());
    el._change({ type: "remove", stat: "sensor.tv" });
    await settle(el);
    buttonWith(el, "Discard").click();
    await settle(el);
    expect(el._changes).toEqual([]);
    expect(root(el).querySelector(".footer")).toBeNull();
  });

  it("shows details of the selected device", async () => {
    const el = await mount(mockHass());
    node(el, "sensor.server").click();
    await settle(el);
    const details = text(el);
    expect(details).toContain("sensor.server_power");
    expect(details).toContain("Office");
    expect(details).toContain("Not tracked by its devices 40 W");
  });
});

describe("saving", () => {
  it("confirms with the backend diff, saves and reloads", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mock = mockHass();
    const validation: ValidateResult = {
      valid: true,
      issues: [{ code: "statistic_missing", severity: "warning", stat: "sensor.tv", details: {} }],
      diff: [{ type: "moved", stat: "sensor.tv", from: null, to: "sensor.server" }],
    };
    mock.responses["energy_flow_mapper/validate"] = validation;
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await settle(el);
    buttonWith(el, "Save").click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("TV moved under Server & co");
    expect(dialog.textContent).toContain("Statistic not found");
    dialog.querySelector<HTMLButtonElement>("button.primary")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/save")).toMatchObject({
      base_hash: "hash-1",
      changes: [{ type: "move", stat: "sensor.tv", parent: "sensor.server" }],
    });
    expect(el._changes).toEqual([]);
    expect(text(el)).toContain("A backup of the previous settings was created");
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/get")).toHaveLength(2);
    vi.advanceTimersByTime(TOAST_MS);
    await settle(el);
    expect(root(el).querySelector(".toast")).toBeNull();
  });

  it("does not save while errors exist", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/validate"] = {
      valid: false,
      issues: [{ code: "cycle", severity: "error", stat: "sensor.tv", details: {} }],
      diff: [],
    };
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await settle(el);
    expect(node(el, "sensor.tv").classList.contains("has-error")).toBe(true);
    await el._openConfirm();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("Fix these problems first");
    expect(dialog.querySelector<HTMLButtonElement>("button.primary")!.disabled).toBe(true);
  });

  it("reloads after a conflict and keeps the draft", async () => {
    const mock = mockHass();
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await settle(el);
    mock.responses["energy_flow_mapper/save"] = { translation_key: "conflict" };
    await el._save();
    await settle(el);
    expect(text(el)).toContain("changed elsewhere");
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/get")).toHaveLength(2);
    expect(el._changes).toHaveLength(1);
  });

  it("reports a save without effect", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/save"] = { hash: "hash-1", backup_id: null };
    const el = await mount(mock);
    el._change({ type: "rename", stat: "sensor.tv", name: "TV" });
    await el._save();
    await settle(el);
    expect(text(el)).toContain("Nothing changed");
  });
});

describe("backups", () => {
  const backup: BackupEntry = {
    id: "b1",
    created: "2026-10-23T10:00:00+00:00",
    user_id: "u",
    user_name: "Admin",
    summary: { moved: 2, restored: 1, other: 3 },
  };

  it("lists backups and restores one", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/backups"] = { backups: [backup] };
    const el = await mount(mock);
    buttonWith(el, "Backups").click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("2 moved, Restored a backup, other: 3");
    expect(dialog.textContent).toContain("by Admin");
    buttonWith(el, "Restore").click();
    await settle(el);
    el._change({ type: "remove", stat: "sensor.tv" });
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("unsaved changes will be discarded");
    root(el).querySelector<HTMLButtonElement>("dialog button.primary")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/restore")).toMatchObject({
      backup_id: "b1",
      base_hash: "hash-1",
    });
    expect(el._changes).toEqual([]);
    expect(text(el)).toContain("Backup restored");
  });

  it("undo restores the newest backup", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/backups"] = { backups: [backup] };
    const el = await mount(mock);
    buttonWith(el, "Undo").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("before the last save");
  });

  it("shows an empty list", async () => {
    const el = await mount(mockHass());
    await el._openBackups(true);
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("No backups yet");
  });

  it("reports a failed restore", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/restore"] = { translation_key: "backup_not_found" };
    const el = await mount(mock);
    await el._restore(backup);
    await settle(el);
    expect(text(el)).toContain("Error:");
  });
});

describe("narrow screens", () => {
  it("toggles the sidebar and opens free sensors and details as dialogs", async () => {
    const el = await mount(mockHass(), true);
    const toggled = vi.fn();
    el.addEventListener("hass-toggle-menu", toggled);
    root(el).querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!.click();
    expect(toggled).toHaveBeenCalled();
    expect(root(el).querySelector("aside")).toBeNull();

    expect(root(el).querySelector(".header-actions")).toBeNull();
    root(el).querySelector<HTMLButtonElement>('button[aria-label="More"]')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Backups");
    buttonWith(el, "Free sensors").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("3D printer");

    node(el, "sensor.sonos").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("sensor.sonos_power");
  });
});

describe("texts", () => {
  it("translates errors", () => {
    const hass = mockHass("de").hass;
    expect(errorText(hass, { translation_key: "conflict" })).toContain("an anderer Stelle");
    expect(errorText(hass, { translation_key: "nope", message: "Boom" })).toBe("Fehler: Boom");
    expect(errorText(hass, new Error("x"))).toBe("Fehler: x");
  });

  it("describes diff entries", async () => {
    const el = await mount(mockHass());
    expect(el._diffText({ type: "added", stat: "sensor.tv", parent: null })).toBe("TV added");
    expect(el._diffText({ type: "added", stat: "sensor.tv", parent: "sensor.server" })).toBe(
      "TV added under Server & co",
    );
    expect(el._diffText({ type: "removed", stat: "sensor.sonos" })).toBe("Sonos amp removed");
    expect(el._diffText({ type: "moved", stat: "sensor.sonos", to: null })).toBe(
      "Sonos amp moved to the top level",
    );
    expect(el._diffText({ type: "renamed", stat: "sensor.tv", from: "TV", to: "Telly" })).toBe(
      "TV renamed to “Telly”",
    );
    expect(el._diffText({ type: "renamed", stat: "sensor.tv", from: "TV", to: null })).toBe(
      "TV uses the entity name again",
    );
    expect(el._diffText({ type: "rate", stat: "sensor.tv" })).toBe("Power sensor of TV changed");
    expect(
      el._issueText({ code: "not_energy_unit", severity: "warning", stat: "x", details: { unit: "W" } }),
    ).toBe("Unit W is not an energy unit");
  });
});
