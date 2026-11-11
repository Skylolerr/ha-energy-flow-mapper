import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EnergyFlowMapperPanel,
  errorText,
  fileStamp,
  MAX_ZOOM,
  MIN_ZOOM,
  PANEL_TAG,
  TOAST_MS,
  assignRole,
  TOUCH_DRAG_LIFT,
  TOUCH_DRAG_SCALE,
} from "../src/energy-flow-mapper-panel";
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
      { ...info("portal:import", "Portal import", { entity_id: null }), power: null, external: true },
    ],
    water_candidates: [
      {
        ...info("sensor.tap", "Garden tap", { unit: "L", device_class: "water" }),
        power: "sensor.tap_flow",
      },
    ],
    power_candidates: [info("sensor.ups_power", "UPS power", { unit: "W", device_class: "power" })],
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
        diff: msg.changes.map((c) => ({ type: "moved", stat: (c as { stat?: string }).stat ?? "" })),
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
      return response instanceof Promise ? response : structuredClone(response);
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
  // A kept draft of one test must not reach the next.
  localStorage.clear();
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
    // Arrows: Home to the top-level devices, the server to the Sonos amp.
    const edges = [...root(el).querySelectorAll<SVGGElement>(".edge")].map(
      (e) => `${e.dataset.from}>${e.dataset.to}`,
    );
    expect(edges).toEqual(
      expect.arrayContaining([
        "source:0>home",
        "home>source:1",
        "home>sensor.server",
        "sensor.server>sensor.sonos",
        "sensor.server>untracked:sensor.server",
        "home>sensor.tv",
      ]),
    );
    // 40 W of the server are not tracked individually.
    expect(root(el).querySelector(".untracked")!.textContent).toContain("40 W");
    // Missing sources are placeholders; Home sums the top-level devices.
    const placeholders = [...root(el).querySelectorAll(".placeholder")].map((b) =>
      b.textContent!.trim(),
    );
    expect(placeholders).toEqual(["+ Solar production", "+ Battery"]);
    expect(root(el).querySelector(".block.home")!.textContent).toContain("50 W measured");
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
    expect(details).toContain("Untracked by its child devices 40 W");
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
    root(el).querySelector<HTMLButtonElement>(".footer button.primary")!.click();
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

  it("shows what Home Assistant rejects", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/validate"] = {
      valid: false,
      issues: [],
      rejected: "Entity or number price is not supported for external statistics",
      diff: [],
    };
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await el._openConfirm();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("Home Assistant does not accept these settings");
    expect(dialog.querySelector(".rejected")!.textContent).toContain("external statistics");
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

describe("kept draft", () => {
  const DRAFT_KEY = "energy_flow_mapper.draft";
  const move: Change = { type: "move", stat: "sensor.tv", parent: "sensor.server" };

  it("keeps unsaved changes when the panel is left and opened again", async () => {
    const first = await mount(mockHass());
    first._change(move);
    await settle(first);
    first.remove();
    const again = await mount(mockHass());
    expect(again._changes).toEqual([move]);
    expect(text(again)).toContain("Your unsaved changes were restored");
    expect(root(again).querySelector(".footer")).not.toBeNull();
  });

  it("forgets the draft after saving, discarding and undoing everything", async () => {
    const el = await mount(mockHass());
    el._change(move);
    await settle(el);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual({ hash: "hash-1", changes: [move] });
    el._undoChange();
    await settle(el);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    el._change(move);
    el._discard();
    await settle(el);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    el._change(move);
    await el._save();
    await settle(el);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("keeps the draft for the new settings after a conflict", async () => {
    const mock = mockHass();
    const el = await mount(mock);
    el._change(move);
    await settle(el);
    mock.responses["energy_flow_mapper/save"] = { translation_key: "conflict" };
    mock.responses["energy_flow_mapper/get"] = { ...snapshot(), hash: "hash-9" };
    await el._save();
    await settle(el);
    expect(el._changes).toEqual([move]);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toMatchObject({ hash: "hash-9", changes: [move] });
    el.remove();
    const again = await mount(mock);
    expect(again._changes).toEqual([move]);
    expect(text(again)).toContain("Your unsaved changes were restored");
  });

  it("drops a draft for settings that changed meanwhile", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ hash: "hash-0", changes: [move] }));
    const el = await mount(mockHass());
    expect(el._changes).toEqual([]);
    expect(text(el)).toContain("could not be restored");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("ignores a broken draft", async () => {
    localStorage.setItem(DRAFT_KEY, "{not json");
    const el = await mount(mockHass());
    expect(el._changes).toEqual([]);
    expect(root(el).querySelector(".toast")).toBeNull();
  });

  it("works when the browser cannot store it", async () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    try {
      const el = await mount(mockHass());
      el._change(move);
      await settle(el);
      expect(el._changes).toEqual([move]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("blocked saving", () => {
  function blocking(mock: Mock): void {
    mock.responses["energy_flow_mapper/get"] = {
      ...snapshot(),
      issues: [{ code: "missing_parent", severity: "error", stat: "sensor.sonos", details: {} }],
    };
    mock.responses["energy_flow_mapper/validate"] = {
      valid: false,
      issues: [
        { code: "missing_parent", severity: "error", stat: "sensor.sonos", details: {} },
        { code: "cycle", severity: "error", stat: "sensor.tv", details: {}, kind: "electricity" },
      ],
      diff: [{ type: "moved", stat: "sensor.tv", from: null, to: "sensor.server" }],
    };
  }

  it("says in the footer that problems block saving", async () => {
    const mock = mockHass();
    blocking(mock);
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await settle(el);
    expect(root(el).querySelector(".footer .blocked")!.textContent).toContain("2 problems prevent saving");
  });

  it("marks problems of the saved settings and shows the block of a problem", async () => {
    const mock = mockHass();
    blocking(mock);
    const el = await mount(mock);
    el.setTab("water");
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await el._openConfirm();
    await settle(el);
    const items = [...root(el).querySelectorAll("dialog ul.issues li")];
    expect(items[0].textContent).toContain("already in the saved settings");
    expect(items[1].textContent).not.toContain("already in the saved settings");
    items[1].querySelector<HTMLButtonElement>("button")!.click();
    await settle(el);
    expect(el._dialog).toBeNull();
    expect(el._tab).toBe("electricity");
    expect(el._selected).toBe("sensor.tv");
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
    expect(text(el)).toContain("This backup no longer exists.");
  });
});

describe("export and import", () => {
  const backup: BackupEntry = {
    id: "b1",
    created: "2026-10-23T10:00:00+00:00",
    user_id: "u",
    user_name: "Admin",
    summary: { moved: 2 },
  };
  const exportDocument = {
    format: "energy_flow_mapper",
    version: 1,
    exported: "2026-10-24T08:30:00+00:00",
    source: "current",
    data: { device_consumption: [] },
  };

  function captureDownloads() {
    const downloads: { name: string; href: string }[] = [];
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });
    return { downloads, created };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the current settings and a backup as files", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/backups"] = { backups: [backup] };
    mock.responses["energy_flow_mapper/export"] = exportDocument;
    const { downloads, created } = captureDownloads();
    const el = await mount(mock);
    await el._openBackups(false);
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("every Home Assistant backup includes them");

    buttonWith(el, "Export current settings").click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/export")).toEqual({ type: "energy_flow_mapper/export" });
    expect(downloads).toEqual([
      { name: `energy-flow-mapper-settings-${fileStamp(exportDocument.exported)}.json`, href: "blob:export" },
    ]);
    const blob = created.mock.calls[0][0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(exportDocument);

    root(el).querySelector<HTMLButtonElement>(".backup-actions button")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/export")).toMatchObject({ backup_id: "b1" });
    expect(downloads[1].name).toBe(`energy-flow-mapper-backup-${fileStamp(backup.created)}.json`);
  });

  it("names files with the local date and time", () => {
    const iso = "2026-10-24T08:30:05+00:00";
    const date = new Date(iso);
    expect(fileStamp(iso)).toBe(
      `2026-10-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-30-05`,
    );
  });

  it("keeps a dialog that was opened before the close event of the last one arrived", async () => {
    const el = await mount(mockHass());
    el._dialog = { kind: "menu" };
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    // A late close event while the new dialog is open changes nothing.
    dialog.dispatchEvent(new Event("close"));
    await settle(el);
    expect(el._dialog).toEqual({ kind: "menu" });
    // Closed for real (Escape, form method=dialog): the dialog state goes too.
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
    await settle(el);
    expect(el._dialog).toBeNull();
  });

  it("reports a failed export", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/export"] = { translation_key: "backup_not_found" };
    const el = await mount(mock);
    await el._export(backup);
    await settle(el);
    expect(text(el)).toContain("This backup no longer exists.");
  });

  it("checks an imported file, shows the changes and imports it", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/import_check"] = {
      valid: true,
      changed: true,
      issues: [{ code: "statistic_missing", severity: "warning", stat: "sensor.tv", details: {} }],
      rejected: null,
      diff: [{ type: "moved", stat: "sensor.tv", from: null, to: "sensor.server" }],
    };
    mock.responses["energy_flow_mapper/import"] = { hash: "hash-4", backup_id: "b4" };
    const el = await mount(mock);
    el._change({ type: "rename", stat: "sensor.sonos", name: "Amp" });
    await el._readImport(new File([JSON.stringify(exportDocument)], "settings.json"));
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("Import settings.json");
    expect(dialog.textContent).toContain("TV moved under Server & co");
    expect(dialog.textContent).toContain("Statistic not found");
    expect(dialog.textContent).toContain("unsaved changes will be discarded");
    expect(lastCall(mock, "energy_flow_mapper/import_check")).toMatchObject({
      base_hash: "hash-1",
      document: exportDocument,
    });

    dialog.querySelector<HTMLButtonElement>("button.primary")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/import")).toMatchObject({
      base_hash: "hash-1",
      document: exportDocument,
    });
    expect(el._changes).toEqual([]);
    expect(text(el)).toContain("Imported. The previous settings were backed up.");
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/get")).toHaveLength(2);
  });

  it("says when a file holds the current settings", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/import_check"] = {
      valid: true,
      changed: false,
      issues: [],
      rejected: null,
      diff: [],
    };
    const el = await mount(mock);
    await el._readImport(new File([JSON.stringify(exportDocument)], "same.json"));
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("There is nothing to import");
    expect(dialog.querySelector<HTMLButtonElement>("button.primary")!.disabled).toBe(true);
  });

  it("does not import what Home Assistant rejects", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/import_check"] = {
      valid: false,
      changed: true,
      issues: [],
      rejected: "required key not provided",
      diff: [],
    };
    const el = await mount(mock);
    await el._readImport(new File([JSON.stringify(exportDocument)], "broken.json"));
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.querySelector(".rejected")!.textContent).toContain("required key not provided");
    expect(dialog.querySelector<HTMLButtonElement>("button.primary")!.disabled).toBe(true);
  });

  it("reports files that are not exports", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/import_check"] = { translation_key: "invalid_import" };
    const el = await mount(mock);
    await el._readImport(new File(["not json"], "notes.txt"));
    await settle(el);
    expect(text(el)).toContain("This file could not be read.");
    expect(lastCall(mock, "energy_flow_mapper/import_check")).toBeUndefined();

    await el._readImport(new File(['{"format": "other"}'], "other.json"));
    await settle(el);
    expect(text(el)).toContain("This file is not an Energy Flow Mapper export.");
    expect(root(el).querySelector("dialog")!.open).toBe(false);
  });

  it("reports a failed import and an import without effect", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/import"] = { translation_key: "conflict" };
    const el = await mount(mock);
    await el._import(exportDocument);
    await settle(el);
    expect(text(el)).toContain("changed elsewhere");

    mock.responses["energy_flow_mapper/import"] = { hash: "hash-1", backup_id: null };
    await el._import(exportDocument);
    await settle(el);
    expect(text(el)).toContain("Nothing changed");
  });

  it("opens a file picker for JSON files", async () => {
    const el = await mount(mockHass());
    const read = vi.spyOn(el, "_readImport").mockResolvedValue();
    let picker: HTMLInputElement | undefined;
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      picker = this;
    });
    el._pickImportFile();
    expect(picker!.type).toBe("file");
    expect(picker!.accept).toBe(".json,application/json");
    const file = new File(["{}"], "pick.json");
    Object.defineProperty(picker!, "files", { value: [file], configurable: true });
    picker!.dispatchEvent(new Event("change"));
    expect(read).toHaveBeenCalledWith(file);
    // Cancelling the picker leaves nothing to read.
    Object.defineProperty(picker!, "files", { value: [], configurable: true });
    picker!.dispatchEvent(new Event("change"));
    expect(read).toHaveBeenCalledTimes(1);
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
    expect(
      errorText(hass, {
        translation_key: "rejected_by_home_assistant",
        translation_placeholders: { error: "kaputt" },
      }),
    ).toBe("Home Assistant hat die Einstellungen abgelehnt: kaputt");
    expect(errorText(hass, { translation_key: "unknown_device" })).toContain("Verwirf den Entwurf");
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
    el._change({ type: "rename", stat: "sensor.sonos", name: "Living room amp" });
    expect(
      el._diffText({ type: "renamed", stat: "sensor.sonos", from: null, to: "Living room amp" }),
    ).toBe("Sonos amp renamed to “Living room amp”");
    expect(el._diffText({ type: "rate", stat: "sensor.tv" })).toBe("Power sensor of TV changed");
    expect(
      el._issueText({ code: "not_energy_unit", severity: "warning", stat: "x", details: { unit: "W" } }),
    ).toBe("Unit W is not an energy unit");
  });
});

describe("diagram", () => {
  function sized(el: EnergyFlowMapperPanel, width: number, height: number): HTMLElement {
    const viewport = root(el).querySelector<HTMLElement>(".viewport")!;
    Object.defineProperty(viewport, "clientWidth", { value: width, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: height, configurable: true });
    viewport.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
    return viewport;
  }

  function pointer(type: string, id: number, x: number, y: number): PointerEvent {
    return Object.assign(new Event(type, { bubbles: true }), {
      pointerId: id,
      clientX: x,
      clientY: y,
    }) as unknown as PointerEvent;
  }

  it("fits the diagram into the viewport and zooms with the buttons", async () => {
    const el = await mount(mockHass());
    sized(el, 400, 300);
    expect(el.fit()).toBe(true);
    const { width, height } = el.diagramLayout();
    const k = Math.min(400 / width, 300 / height);
    expect(el._zoom.k).toBeCloseTo(k);
    expect(el._zoom.x).toBeCloseTo((400 - width * k) / 2);
    buttonWith(el, "+").click();
    expect(el._zoom.k).toBeCloseTo(k * 1.25);
    buttonWith(el, "−").click();
    expect(el._zoom.k).toBeCloseTo(k);
    el._zoom = { x: 5, y: 5, k: 2 };
    buttonWith(el, "Fit").click();
    expect(el._zoom.k).toBeCloseTo(k);
  });

  it("stays fitted while the viewport resizes, until the user zooms", async () => {
    const el = await mount(mockHass());
    sized(el, 400, 300);
    el._onViewportResize();
    const small = el._zoom.k;
    sized(el, 800, 600);
    el._onViewportResize();
    expect(el._zoom.k).toBeGreaterThan(small);

    buttonWith(el, "+").click();
    const zoomed = el._zoom;
    sized(el, 400, 300);
    el._onViewportResize();
    expect(el._zoom).toEqual(zoomed);

    buttonWith(el, "Fit").click();
    expect(el._autoFit).toBe(true);
    expect(el._zoom.k).toBeCloseTo(small);
  });

  it("switches between horizontal and vertical, fits again and remembers it", async () => {
    localStorage.clear();
    const el = await mount(mockHass());
    sized(el, 800, 600);
    const buttons = () => [...root(el).querySelectorAll<HTMLButtonElement>(".orientation button")];
    expect(buttons().map((b) => [b.textContent!.trim(), b.getAttribute("aria-pressed")])).toEqual([
      ["Horizontal", "true"],
      ["Vertical", "false"],
    ]);
    const wide = el.diagramLayout();
    el._autoFit = false;
    buttons()[1].click();
    await el.updateComplete;
    const tall = el.diagramLayout();
    expect(tall.width).not.toBe(wide.width);
    expect(buttons()[1].getAttribute("aria-pressed")).toBe("true");
    expect(el._autoFit).toBe(true);
    expect(el._zoom.k).toBeCloseTo(Math.min(800 / tall.width, 600 / tall.height, 1.4));
    // The arrows run sideways: from the right side of Home.
    const home = tall.blocks.find((b) => b.id === "home")!;
    const path = root(el).querySelector('.edge-device[data-from="home"] path')!;
    expect(path.getAttribute("d")).toContain(`M ${home.x + home.w} `);
    // A new panel in this browser opens the same way.
    const again = await mount(mockHass());
    expect(again.diagramLayout().width).toBe(tall.width);
    again.setOrientation("horizontal");
    expect(localStorage.getItem("energy_flow_mapper.orientation")).toBe("horizontal");
    localStorage.clear();
  });

  it("still switches when the browser cannot store it", async () => {
    const el = await mount(mockHass());
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    try {
      el.setOrientation("vertical");
      expect(el._orientation).toBe("vertical");
      expect((await mount(mockHass()))._orientation).toBe("horizontal");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not fit before the viewport has a size", async () => {
    const el = await mount(mockHass());
    expect(el.fit()).toBe(false);
  });

  it("zooms around a point within the limits", async () => {
    const el = await mount(mockHass());
    el._zoom = { x: 0, y: 0, k: 1 };
    el.zoomAt(100, 50, 2);
    expect(el._zoom).toEqual({ x: -100, y: -50, k: 2 });
    el.zoomAt(0, 0, 100);
    expect(el._zoom.k).toBe(MAX_ZOOM);
    el.zoomAt(0, 0, 0.0001);
    expect(el._zoom.k).toBe(MIN_ZOOM);
  });

  it("zooms with the wheel and pans and pinches with pointers", async () => {
    const el = await mount(mockHass());
    const viewport = sized(el, 400, 300);
    el._zoom = { x: 0, y: 0, k: 1 };
    const wheel = Object.assign(new Event("wheel", { cancelable: true }), {
      deltaY: -100,
      clientX: 0,
      clientY: 0,
    });
    viewport.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(el._zoom.k).toBeGreaterThan(1);

    el._zoom = { x: 0, y: 0, k: 1 };
    viewport.dispatchEvent(pointer("pointerdown", 1, 10, 10));
    viewport.dispatchEvent(pointer("pointermove", 1, 30, 25));
    expect(el._zoom).toEqual({ x: 20, y: 15, k: 1 });

    // A second finger: spreading them doubles the zoom.
    viewport.dispatchEvent(pointer("pointerdown", 2, 50, 25));
    viewport.dispatchEvent(pointer("pointermove", 2, 70, 25));
    expect(el._zoom.k).toBeCloseTo(2);
    viewport.dispatchEvent(pointer("pointerup", 1, 30, 25));
    viewport.dispatchEvent(pointer("pointercancel", 2, 70, 25));
    const before = { ...el._zoom };
    viewport.dispatchEvent(pointer("pointermove", 1, 90, 90));
    expect(el._zoom).toEqual(before);
  });

  it("does not pan when a block is pressed", async () => {
    const el = await mount(mockHass());
    sized(el, 400, 300);
    el._zoom = { x: 0, y: 0, k: 1 };
    node(el, "sensor.server").dispatchEvent(pointer("pointerdown", 1, 10, 10));
    root(el).querySelector(".viewport")!.dispatchEvent(pointer("pointermove", 1, 50, 50));
    expect(el._zoom).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("collapses a device with children", async () => {
    const el = await mount(mockHass());
    node(el, "sensor.server").querySelector<HTMLButtonElement>("button.toggle")!.click();
    await settle(el);
    expect(root(el).querySelector('.node[data-stat="sensor.sonos"]')).toBeNull();
    expect(root(el).querySelector(".untracked")).toBeNull();
    node(el, "sensor.server").querySelector<HTMLButtonElement>("button.toggle")!.click();
    await settle(el);
    expect(node(el, "sensor.sonos")).not.toBeNull();
  });

  it("opens the energy settings from a source block", async () => {
    const el = await mount(mockHass());
    const navigated = vi.fn();
    window.addEventListener("location-changed", navigated);
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="import"]')!.click();
    await settle(el);
    buttonWith(el, "Energy settings").click();
    expect(location.pathname).toBe("/config/energy");
    expect(navigated).toHaveBeenCalled();
    window.removeEventListener("location-changed", navigated);
  });

  it("draws power-scaled, dashed and coloured edges", async () => {
    const el = await mount(mockHass());
    const path = (from: string, to: string) =>
      root(el).querySelector(`.edge[data-from="${from}"][data-to="${to}"] path`)!;
    // The server has the largest power: the widest stroke.
    expect(path("home", "sensor.server").getAttribute("stroke-width")).toBe("8");
    // The TV has no power sensor: thin and dashed.
    expect(path("home", "sensor.tv").getAttribute("stroke-dasharray")).toBe("4 4");
    expect(path("source:0", "home").getAttribute("stroke")).toContain("grid-consumption");
    expect(path("home", "source:1").getAttribute("stroke")).toContain("grid-return");
  });
});

describe("hidden list view", () => {
  it("still renders the indented tree", async () => {
    const el = await mount(mockHass());
    el._view = "list";
    await settle(el);
    expect(root(el).querySelector(".viewport")).toBeNull();
    const server = node(el, "sensor.server");
    const nested = server.parentElement!.querySelector('ul .node[data-stat="sensor.sonos"]');
    expect(nested).not.toBeNull();
    expect(root(el).querySelector("li.untracked")!.textContent).toContain("40 W");
    expect(text(el)).toContain("Grid import");
    server.querySelector<HTMLButtonElement>("button.toggle")!.click();
    await settle(el);
    expect(root(el).querySelector('.node[data-stat="sensor.sonos"]')).toBeNull();
  });
});

describe("dragging in the diagram", () => {
  it("uses a drag image scaled like the diagram", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const el = await mount(mockHass());
    el._zoom = { x: 0, y: 0, k: 0.5 };
    await settle(el);
    const block = node(el, "sensor.tv");
    Object.defineProperty(block, "offsetWidth", { value: 220, configurable: true });
    Object.defineProperty(block, "offsetHeight", { value: 72, configurable: true });
    block.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
    block.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer,
        clientX: 120,
        clientY: 60,
      }),
    );
    expect(dataTransfer.setDragImage).toHaveBeenCalledTimes(1);
    const [ghost, x, y] = dataTransfer.setDragImage.mock.calls[0];
    expect(ghost.style.width).toBe("110px");
    expect(ghost.style.height).toBe("36px");
    expect((ghost.firstElementChild as HTMLElement).style.transform).toBe("scale(0.5)");
    expect([x, y]).toEqual([20, 10]);
    expect(root(el).querySelector(".drag-ghost")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(root(el).querySelector(".drag-ghost")).toBeNull();
  });

  it("keeps the default drag image for free sensors and without support", async () => {
    const el = await mount(mockHass());
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.printer"]')!;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
    candidate.dispatchEvent(Object.assign(new Event("dragstart", { bubbles: true }), { dataTransfer }));
    expect(dataTransfer.setDragImage).not.toHaveBeenCalled();
    const plain = { setData: vi.fn(), effectAllowed: "" };
    node(el, "sensor.tv").dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), { dataTransfer: plain }),
    );
    expect(el._dragged).toEqual({ kind: "device", stat: "sensor.tv" });
  });
});

describe("drag feedback", () => {
  function startDrag(el: EnergyFlowMapperPanel, stat: string, extra: Record<string, unknown> = {}) {
    const block = node(el, stat);
    Object.defineProperty(block, "offsetWidth", { value: 220, configurable: true });
    Object.defineProperty(block, "offsetHeight", { value: 72, configurable: true });
    block.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
    block.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), { dataTransfer, ...extra }),
    );
    return dataTransfer;
  }

  it("lifts a larger drag image above the finger on touch", async () => {
    const el = await mount(mockHass());
    el._zoom = { x: 0, y: 0, k: 0.3 };
    await settle(el);
    const press = Object.assign(new Event("pointerdown", { bubbles: true }), {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 0,
    });
    node(el, "sensor.tv").dispatchEvent(press);
    expect(el._pointerType).toBe("touch");
    const transfer = startDrag(el, "sensor.tv");
    const [ghost, x, y] = transfer.setDragImage.mock.calls[0];
    expect(ghost.style.width).toBe(`${220 * TOUCH_DRAG_SCALE}px`);
    expect(x).toBeCloseTo((220 * TOUCH_DRAG_SCALE) / 2);
    expect(y).toBeCloseTo(72 * TOUCH_DRAG_SCALE + TOUCH_DRAG_LIFT);
  });

  it("marks the dragged block, valid targets and the target under the pointer", async () => {
    const el = await mount(mockHass());
    startDrag(el, "sensor.server");
    await settle(el);
    expect(root(el).querySelector(".viewport")!.classList.contains("dragging")).toBe(true);
    expect(node(el, "sensor.server").classList.contains("dragged")).toBe(true);
    // The server cannot go below its own child or stay where it is.
    expect(node(el, "sensor.sonos").classList.contains("can-drop")).toBe(false);
    expect(root(el).querySelector(".block.home")!.classList.contains("can-drop")).toBe(false);
    expect(node(el, "sensor.tv").classList.contains("can-drop")).toBe(true);
    node(el, "sensor.tv").dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    await settle(el);
    expect(node(el, "sensor.tv").classList.contains("drop")).toBe(true);
    node(el, "sensor.server").dispatchEvent(new Event("dragend", { bubbles: true }));
    await settle(el);
    expect(root(el).querySelector(".viewport")!.classList.contains("dragging")).toBe(false);
    expect(root(el).querySelector(".can-drop, .dragged, .drop")).toBeNull();
  });
});

describe("sources", () => {
  it("assigns a free sensor by dropping it on a placeholder", async () => {
    const mock = mockHass();
    const el = await mount(mock);
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.attic"]')!;
    const solar = root(el).querySelector<HTMLElement>('.block.placeholder[data-role="production"]')!;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    candidate.dispatchEvent(Object.assign(new Event("dragstart", { bubbles: true }), { dataTransfer }));
    await settle(el);
    expect(solar.classList.contains("can-drop")).toBe(true);
    solar.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    solar.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    await settle(el);
    expect(el._changes).toEqual([{ type: "assign_source", role: "production", stat: "sensor.attic" }]);
    // The draft shows it as a source and it is no longer free.
    expect(root(el).querySelector('.block.source[data-role="production"]:not(.placeholder)')).not.toBeNull();
    expect(root(el).querySelector('.candidate[data-stat="sensor.attic"]')).toBeNull();
  });

  it("does not accept devices on sources", async () => {
    const el = await mount(mockHass());
    const solar = root(el).querySelector<HTMLElement>('.block.placeholder[data-role="production"]')!;
    drag(node(el, "sensor.tv"), solar);
    expect(el._changes).toEqual([]);
  });

  it("assigns with the dialog from a placeholder", async () => {
    const el = await mount(mockHass());
    root(el).querySelector<HTMLButtonElement>('.block.placeholder[data-role="production"]')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Assign Solar production");
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="sensor.printer"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "assign_source", role: "production", stat: "sensor.printer" }]);
  });

  it("asks for the charging meter of a battery", async () => {
    const el = await mount(mockHass());
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.attic"]')!;
    drag(candidate, root(el).querySelector<HTMLElement>('.block.placeholder[data-role="battery"]')!);
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("Attic measures discharging");
    // The discharging meter itself is not offered again.
    expect(dialog.querySelector('button.target[data-target="sensor.attic"]')).toBeNull();
    dialog.querySelector<HTMLButtonElement>('button.target[data-target="sensor.printer"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "assign_source", role: "battery", stat: "sensor.attic", stat_to: "sensor.printer" },
    ]);
  });

  it("replaces and removes a grid meter from the source dialog", async () => {
    const el = await mount(mockHass());
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="export"]')!.click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    expect(dialog.textContent).toContain("Grid export");
    buttonWith(el, "Replace sensor").click();
    await settle(el);
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="portal:import"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "assign_source", role: "export", stat: "portal:import", replace: "sensor.export" },
    ]);

    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="import"]')!.click();
    await settle(el);
    expect(text(el)).not.toContain("last meter");
    buttonWith(el, "Remove as source").click();
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "unassign_source", stat: "sensor.import" });
    expect(root(el).querySelector('.block.placeholder[data-role="import"]')).not.toBeNull();

    // The export meter is now the last one: removing it removes the connection.
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="export"]')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("last meter of this grid connection");
  });

  it("replaces the meter of the grid connection it was dropped on", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.energy_sources = [
      { type: "grid", stat_energy_from: "sensor.import", stat_energy_to: null },
      { type: "grid", stat_energy_from: "sensor.import2", stat_energy_to: null },
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    const imports = root(el).querySelectorAll<HTMLElement>('.block.source[data-role="import"]');
    const candidate = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.attic"]')!;
    drag(candidate, imports[1]);
    await settle(el);
    expect(el._changes).toEqual([
      { type: "assign_source", role: "import", stat: "sensor.attic", replace: "sensor.import2" },
    ]);
    expect(el.draftSources.map((s) => s.stat_energy_from)).toEqual(["sensor.import", "sensor.attic"]);
  });

  it("lists all free sensors in the source dialog, whatever the search", async () => {
    const el = await mount(mockHass());
    el._search = "nothing matches this";
    root(el).querySelector<HTMLButtonElement>('.block.placeholder[data-role="production"]')!.click();
    await settle(el);
    expect(root(el).querySelector('dialog button.target[data-target="sensor.printer"]')).not.toBeNull();
  });

  it("offers assigning on solar blocks; gas has its own tab", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.energy_sources = [
      { type: "solar", stat_energy_from: "sensor.pv" },
      { type: "gas", stat_energy_from: "sensor.gas" },
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="production"]:not(.placeholder)')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Assign sensor");
    expect(root(el).querySelector('.block.source[data-role="gas"]')).toBeNull();
  });

  it("describes source changes", async () => {
    const el = await mount(mockHass());
    expect(el._diffText({ type: "source_added", stat: "sensor.attic", role: "production" })).toBe(
      "Attic assigned as Solar production",
    );
    expect(el._diffText({ type: "source_removed", stat: "sensor.import", role: "import" })).toBe(
      "Grid import removed as Grid import",
    );
    expect(el._roleLabel("weird")).toBe("weird");
    expect(el._roleLabel(undefined)).toBe("");
    expect(el._summaryText({ source_added: 2 })).toBe("2 assigned as source");
    expect(assignRole("charge")).toBe("battery");
    expect(assignRole("consumption")).toBeNull();
  });
});

describe("power-only sensors and external statistics", () => {
  it("lists power-only sensors and creates a meter", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/create_integral"] = {
      entity_id: "sensor.ups_power_energy",
      stat_rate: "sensor.ups_power",
    };
    const el = await mount(mock);
    const row = root(el).querySelector<HTMLElement>('.power-only li[data-stat="sensor.ups_power"]')!;
    expect(row.textContent).toContain("UPS power");
    row.querySelector("button")!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("UPS power Energy");
    root(el).querySelector<HTMLButtonElement>("dialog button.primary")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/create_integral")).toMatchObject({
      power_entity_id: "sensor.ups_power",
      name: "UPS power Energy",
    });
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.ups_power_energy", parent: null, stat_rate: "sensor.ups_power" },
    ]);
    expect(text(el)).toContain("created and added to the draft");
    // The power sensor is now used as stat_rate in the draft.
    expect(root(el).querySelector(".power-only")).toBeNull();
  });

  it("reports a failed meter", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/create_integral"] = { translation_key: "integral_failed" };
    const el = await mount(mock);
    await el._createMeter("sensor.ups_power");
    await settle(el);
    expect(text(el)).toContain("could not be created");
    expect(el._changes).toEqual([]);
  });

  it("labels external statistics and created helpers", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.stats["sensor.server"].created_helper = true;
    snap.candidates[0].created_helper = true;
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    const external = root(el).querySelector('.candidate[data-stat="portal:import"]')!;
    expect(external.textContent).toContain("External statistic");
    const printer = root(el).querySelector('.candidate[data-stat="sensor.printer"]')!;
    expect(printer.textContent).toContain("Created by Energy Flow Mapper");
    node(el, "sensor.server").click();
    await settle(el);
    expect(text(el)).toContain("Helper Created by Energy Flow Mapper");
  });
});

describe("energy in a period", () => {
  function energyResponse(msg: { period: string }) {
    return {
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: { "sensor.server": 12.5, "sensor.sonos": 14, "sensor.tv": 0.42 },
      untracked: { "sensor.server": -1.5 },
      issues: [
        {
          code: "children_exceed_parent",
          severity: "warning",
          stat: "sensor.server",
          details: { parent: 12.5, children: 14, excess: 1.5 },
        },
      ],
    };
  }

  it("switches to kWh, shows untracked energy and the warning", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/energy"] = energyResponse;
    const el = await mount(mock);
    expect(root(el).querySelector('.periods button[data-period="now"]')!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    root(el).querySelector<HTMLButtonElement>('.periods button[data-period="week"]')!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/energy")).toEqual({
      type: "energy_flow_mapper/energy",
      period: "week",
    });
    expect(node(el, "sensor.server").textContent).toContain("12.5 kWh");
    expect(node(el, "sensor.tv").textContent).toContain("420 Wh");
    expect(root(el).querySelector(".untracked")!.textContent).toContain("-1.5 kWh");
    expect(root(el).querySelector(".block.home")!.textContent).toContain("12.9 kWh measured");
    // The warning marks the server; the details show the energy.
    expect(node(el, "sensor.server").querySelector(".badge")!.getAttribute("title")).toBe(
      "Its child devices use more than this device",
    );
    node(el, "sensor.server").click();
    await settle(el);
    expect(text(el)).toContain("Energy in period 12.5 kWh");
    expect(text(el)).toContain("Power now 50 W");
    // Arrow width follows the energy: the Sonos amp has the most.
    const path = root(el).querySelector('.edge[data-from="sensor.server"][data-to="sensor.sonos"] path')!;
    expect(path.getAttribute("stroke-width")).toBe("8");

    root(el).querySelector<HTMLButtonElement>('.periods button[data-period="now"]')!.click();
    await settle(el);
    expect(node(el, "sensor.server").textContent).toContain("50 W");
    expect(node(el, "sensor.server").querySelector(".badge")).toBeNull();
  });

  it("asks for the draft's energy and shows a loading hint", async () => {
    const mock = mockHass();
    let resolve: (value: unknown) => void = () => undefined;
    mock.responses["energy_flow_mapper/energy"] = () => new Promise((r) => (resolve = r));
    const el = await mount(mock);
    el._change({ type: "remove", stat: "sensor.tv" });
    el.setPeriod("today");
    await settle(el);
    expect(text(el)).toContain("Loading consumption");
    expect(lastCall(mock, "energy_flow_mapper/energy")).toMatchObject({
      period: "today",
      base_hash: "hash-1",
      changes: [{ type: "remove", stat: "sensor.tv" }],
    });
    resolve(energyResponse({ period: "today" }));
    await settle(el);
    expect(text(el)).not.toContain("Loading consumption");
  });

  it("ignores outdated answers", async () => {
    const mock = mockHass();
    const pending: ((value: unknown) => void)[] = [];
    mock.responses["energy_flow_mapper/energy"] = () => new Promise((r) => pending.push(r));
    const el = await mount(mock);
    el.setPeriod("week");
    el.setPeriod("month");
    await settle(el);
    pending[1](energyResponse({ period: "month" }));
    pending[0](energyResponse({ period: "week" }));
    await settle(el);
    expect(el._energy?.period).toBe("month");
  });

  it("reports errors of the current request only", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/energy"] = { translation_key: "not_loaded" };
    const el = await mount(mock);
    el.setPeriod("today");
    await settle(el);
    expect(text(el)).toContain("not loaded");
    expect(el._energy).toBeNull();
  });

  it("refreshes after saving and discarding", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/energy"] = energyResponse;
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const before = mock.calls.filter((c) => c.type === "energy_flow_mapper/energy").length;
    el._change({ type: "remove", stat: "sensor.tv" });
    el._discard();
    await settle(el);
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/energy").length).toBe(before + 2);
  });
});

describe("water", () => {
  function waterMock(): Mock {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.energy_sources.push({
      type: "water",
      stat_energy_from: "sensor.water_main",
      stat_cost: null,
      number_energy_price: 2,
    });
    snap.prefs.device_consumption_water = [
      { stat_consumption: "sensor.house_water", stat_rate: "sensor.house_flow" },
      {
        stat_consumption: "sensor.shower",
        stat_rate: "sensor.shower_flow",
        included_in_stat: "sensor.house_water",
      },
    ];
    const water = { unit: "m³", device_class: "water" };
    snap.stats["sensor.water_main"] = info("sensor.water_main", "Water main", water);
    snap.stats["sensor.house_water"] = info("sensor.house_water", "House water", water);
    snap.stats["sensor.shower"] = info("sensor.shower", "Shower", water);
    mock.responses["energy_flow_mapper/get"] = snap;
    // 0.5 m³/h are 8.33 L/min.
    mock.hass.states["sensor.house_flow"] = entity("sensor.house_flow", "0.5", "m³/h");
    mock.hass.states["sensor.shower_flow"] = entity("sensor.shower_flow", "6", "L/min");
    return mock;
  }

  async function waterTab(mock: Mock): Promise<EnergyFlowMapperPanel> {
    const el = await mount(mock);
    root(el).querySelector<HTMLButtonElement>('.tabs button[data-tab="water"]')!.click();
    await settle(el);
    return el;
  }

  it("shows water devices, meters and free water meters in their own tab", async () => {
    const mock = waterMock();
    const el = await mount(mock);
    expect(root(el).querySelector('.block.source[data-role="water"]')).toBeNull();
    const tab = root(el).querySelector<HTMLButtonElement>('.tabs button[data-tab="water"]')!;
    expect(tab.getAttribute("aria-selected")).toBe("false");
    el._selected = "sensor.server";
    tab.click();
    await settle(el);
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(el._selected).toBeNull();
    expect(root(el).querySelector(".diagram-card h2")!.textContent).toBe("Water flow");
    expect(node(el, "sensor.house_water").textContent).toContain("8.33 L/min");
    expect(node(el, "sensor.shower").textContent).toContain("6 L/min");
    expect(root(el).querySelector(".untracked")!.textContent).toContain("2.33 L/min");
    expect(root(el).querySelector('.node[data-stat="sensor.server"]')).toBeNull();
    // The water meter flows into Home; with a meter there is no placeholder.
    expect(root(el).querySelector('.block.source[data-role="water"]')!.textContent).toContain("Water main");
    expect(root(el).querySelectorAll(".placeholder").length).toBe(0);
    expect(text(el)).toContain("Water meters that are not in the energy dashboard yet.");
    expect(text(el)).toContain("Garden tap");
    expect(text(el)).not.toContain("3D printer");
    expect(text(el)).not.toContain("Power only");
    node(el, "sensor.house_water").click();
    await settle(el);
    expect(text(el)).toContain("Flow sensor sensor.house_flow");
    expect(text(el)).toContain("Flow now 8.33 L/min");
    // Switching to the same tab changes nothing.
    el.setTab("water");
    expect(el._selected).toBe("sensor.house_water");
  });

  it("adds and moves water devices in the water list", async () => {
    const el = await waterTab(waterMock());
    const tap = root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.tap"]')!;
    drag(tap, node(el, "sensor.shower"));
    await settle(el);
    drag(node(el, "sensor.shower"), root(el).querySelector<HTMLElement>(".block.home")!);
    await settle(el);
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.tap", parent: "sensor.shower", stat_rate: "sensor.tap_flow", kind: "water" },
      { type: "move", stat: "sensor.shower", parent: null, kind: "water" },
    ]);
    expect(node(el, "sensor.tap")).not.toBeNull();
    // The add dialog names the flow sensor.
    el._changes = [];
    await settle(el);
    root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.tap"] button')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Flow sensor: sensor.tap_flow");
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="__home__"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.tap", parent: null, stat_rate: "sensor.tap_flow", kind: "water" },
    ]);
    // Electricity is not touched by water changes.
    el.setTab("electricity");
    await settle(el);
    expect(root(el).querySelector('.node[data-stat="sensor.tap"]')).toBeNull();
    expect(node(el, "sensor.server")).not.toBeNull();
  });

  it("renames and removes water devices with the menu", async () => {
    const el = await waterTab(waterMock());
    const actions = () =>
      node(el, "sensor.shower").querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!;
    actions().click();
    await settle(el);
    buttonWith(el, "Move to").click();
    await settle(el);
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="__home__"]')!.click();
    await settle(el);
    actions().click();
    await settle(el);
    buttonWith(el, "Rename").click();
    await settle(el);
    el._renameValue = "Bath";
    buttonWith(el, "OK").click();
    await settle(el);
    actions().click();
    await settle(el);
    buttonWith(el, "Remove from the energy dashboard").click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "move", stat: "sensor.shower", parent: null, kind: "water" },
      { type: "rename", stat: "sensor.shower", name: "Bath", kind: "water" },
      { type: "remove", stat: "sensor.shower", kind: "water" },
    ]);
  });

  it("replaces, removes and assigns water meters", async () => {
    const el = await waterTab(waterMock());
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="water"]')!.click();
    await settle(el);
    buttonWith(el, "Replace sensor").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Pick a free water meter.");
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="sensor.tap"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "assign_source", role: "water", stat: "sensor.tap", replace: "sensor.water_main" },
    ]);
    // The draft already shows the new meter; remove it again.
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="water"]')!.click();
    await settle(el);
    buttonWith(el, "Remove as source").click();
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "unassign_source", stat: "sensor.tap" });
    // Without a water meter the placeholder offers one; dropping adds it.
    const placeholder = root(el).querySelector<HTMLElement>('.block.placeholder[data-role="water"]')!;
    expect(placeholder.textContent!.trim()).toBe("+ Water");
    drag(root(el).querySelector<HTMLElement>('.candidate[data-stat="sensor.tap"]')!, placeholder);
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "assign_source", role: "water", stat: "sensor.tap" });
  });

  it("shows water in litres and m³ for a period, or in gallons", async () => {
    const mock = waterMock();
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: { "sensor.house_water": 1500, "sensor.shower": 400 },
      water_unit: "L",
      untracked: { "sensor.house_water": 1100 },
      issues: [
        {
          code: "children_exceed_parent",
          severity: "warning",
          stat: "sensor.server",
          details: {},
          kind: "electricity",
        },
      ],
    });
    const el = await waterTab(mock);
    el.setPeriod("week");
    await settle(el);
    expect(node(el, "sensor.house_water").textContent).toContain("1.5 m³");
    expect(node(el, "sensor.shower").textContent).toContain("400 L");
    expect(root(el).querySelector(".untracked")!.textContent).toContain("1.1 m³");
    node(el, "sensor.shower").click();
    await settle(el);
    expect(text(el)).toContain("Water in period 400 L");
    // An electricity warning does not mark a water device.
    expect(root(el).querySelector(".badge")).toBeNull();

    const us = waterMock();
    us.hass.config = { unit_system: { volume: "gal" } };
    const el2 = await waterTab(us);
    expect(node(el2, "sensor.shower").textContent).toContain("1.59 gal/min");
  });

  it("marks issues and diff lines of water devices", async () => {
    const mock = waterMock();
    const snap = mock.responses["energy_flow_mapper/get"] as Snapshot;
    snap.issues = [
      { code: "not_water_unit", severity: "warning", stat: "sensor.shower", details: { unit: "kWh" }, kind: "water" },
    ];
    const el = await waterTab(mock);
    expect(node(el, "sensor.shower").querySelector(".badge")!.getAttribute("title")).toBe(
      "Unit kWh is not a water unit",
    );
    expect(el._diffText({ type: "added", stat: "sensor.tap", parent: null, kind: "water" })).toBe(
      "Water: Garden tap added",
    );
    expect(el._diffText({ type: "rate", stat: "sensor.shower", kind: "water" })).toBe(
      "Water: Flow sensor of Shower changed",
    );
    expect(el._diffText({ type: "removed", stat: "sensor.house_water", kind: "water" })).toBe(
      "Water: House water removed",
    );
    expect(el._diffText({ type: "source_added", stat: "sensor.tap", role: "water" })).toBe(
      "Garden tap assigned as Water",
    );
    // Electricity entries read as before.
    expect(el._diffText({ type: "rate", stat: "sensor.tv", kind: "electricity" })).toBe(
      "Power sensor of TV changed",
    );
  });
});

describe("gas", () => {
  function gasMock(): Mock {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.energy_sources.push({
      type: "gas",
      stat_energy_from: "sensor.gas",
      stat_rate: "sensor.gas_flow",
      number_energy_price: 1.2,
    });
    snap.stats["sensor.gas"] = info("sensor.gas", "Gas meter", { unit: "m³", device_class: "gas" });
    snap.gas_candidates = [
      { ...info("sensor.boiler_gas", "Boiler gas", { unit: "m³", device_class: "gas" }), power: null },
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.gas_flow"] = entity("sensor.gas_flow", "0.42", "m³/h");
    return mock;
  }

  it("has its own tab with the gas meters and free gas sensors", async () => {
    const el = await mount(gasMock());
    expect(el.diagramLayout().blocks.some((b) => b.role === "gas")).toBe(false);
    root(el).querySelector<HTMLButtonElement>('.tabs button[data-tab="gas"]')!.click();
    await settle(el);
    expect(el._tab).toBe("gas");
    const blocks = el.diagramLayout().blocks;
    expect(blocks.filter((b) => b.kind === "source").map((b) => b.stat)).toEqual(["sensor.gas"]);
    expect(blocks.some((b) => b.kind === "device" || b.kind === "placeholder")).toBe(false);
    const candidates = [...root(el).querySelectorAll(".candidate")].map((c) => c.getAttribute("data-stat"));
    expect(candidates).toEqual(["sensor.boiler_gas"]);
    // The gas flow now, read from the meter's flow sensor.
    expect(root(el).querySelector('.block.source[data-role="gas"]')!.textContent).toContain("0.42 m³/h");
  });

  it("offers a gas placeholder without a gas meter", async () => {
    const mock = mockHass();
    mock.responses["energy_flow_mapper/get"] = {
      ...snapshot(),
      gas_candidates: [{ ...info("sensor.boiler_gas", "Boiler gas", { unit: "m³" }), power: null }],
    };
    const el = await mount(mock);
    el.setTab("gas");
    await settle(el);
    const placeholder = root(el).querySelector<HTMLButtonElement>('.block.placeholder[data-role="gas"]')!;
    expect(placeholder.textContent).toContain("+ Gas");
    placeholder.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Pick a free gas meter");
    root(el).querySelector<HTMLButtonElement>('dialog [data-target="sensor.boiler_gas"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "assign_source", role: "gas", stat: "sensor.boiler_gas" }]);
  });

  it("adds, replaces and removes gas meters", async () => {
    const el = await mount(gasMock());
    el.setTab("gas");
    await settle(el);
    root(el).querySelector<HTMLButtonElement>('.candidate[data-stat="sensor.boiler_gas"] button')!.click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "assign_source", role: "gas", stat: "sensor.boiler_gas" }]);
    const gas = () => el.draftSources.filter((s) => s.type === "gas");
    expect(gas().map((s) => s.stat_energy_from)).toEqual(["sensor.gas", "sensor.boiler_gas"]);
    el._undoChange();
    await settle(el);

    // A free gas meter goes onto a gas meter (replacing it), never below Home.
    el._dragged = { kind: "candidate", stat: "sensor.boiler_gas" };
    expect(el._canDrop("__home__")).toBe(false);
    const block = el.diagramLayout().blocks.find((b) => b.stat === "sensor.gas")!;
    el._drop(`src:gas:${block.id}`);
    await settle(el);
    expect(el._changes).toEqual([
      { type: "assign_source", role: "gas", stat: "sensor.boiler_gas", replace: "sensor.gas" },
    ]);
    expect(gas()).toEqual([
      expect.objectContaining({ stat_energy_from: "sensor.boiler_gas", number_energy_price: 1.2 }),
    ]);

    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="gas"]')!.click();
    await settle(el);
    buttonWith(el, "Remove as source").click();
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "unassign_source", stat: "sensor.boiler_gas" });
    expect(gas()).toEqual([]);
  });

  it("shows the gas used in a period, by volume or by energy", async () => {
    const mock = gasMock();
    const snap = mock.responses["energy_flow_mapper/get"] as Snapshot;
    snap.prefs.energy_sources.push({ type: "gas", stat_energy_from: "sensor.gas_kwh" });
    snap.stats["sensor.gas_kwh"] = info("sensor.gas_kwh", "Gas kWh");
    mock.responses["energy_flow_mapper/energy"] = {
      period: "week",
      start: "",
      end: "",
      energy: { "sensor.gas": 3.5, "sensor.gas_kwh": 41 },
      water_unit: "L",
      gas_unit: "m³",
      untracked: {},
      issues: [],
    };
    const el = await mount(mock);
    el.setTab("gas");
    el.setPeriod("week");
    await settle(el);
    const blocks = [...root(el).querySelectorAll('.block.source[data-role="gas"]')].map((b) => b.textContent);
    expect(blocks[0]).toContain("3.5 m³");
    expect(blocks[1]).toContain("41 kWh");
  });

  it("puts Home Assistant's gas messages in the gas tab", async () => {
    const mock = gasMock();
    (mock.responses["energy_flow_mapper/get"] as Snapshot).ha_issues = [
      { stat: "sensor.gas", kind: "gas", type: "entity_unavailable", placeholders: null, entities: [] },
    ];
    const el = await mount(mock);
    el.setTab("gas");
    await settle(el);
    expect(root(el).querySelector('.block.source[data-role="gas"] .badge')).not.toBeNull();
  });
});

describe("meters for flow sensors", () => {
  function flowMock(): Mock {
    const mock = mockHass();
    const snap = snapshot();
    snap.flow_candidates = [
      info("sensor.tap_flow", "Tap flow", { unit: "L/min", device_class: "volume_flow_rate", area_name: "Garden" }),
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.responses["energy_flow_mapper/create_integral"] = {
      entity_id: "sensor.tap_flow_water",
      stat_rate: "sensor.tap_flow",
      kind: "water",
    };
    return mock;
  }

  it("creates a water meter in the water tab and adds it there", async () => {
    const mock = flowMock();
    const el = await mount(mock);
    expect(text(el)).not.toContain("Tap flow");
    el.setTab("water");
    await settle(el);
    expect(text(el)).toContain("Flow only");
    expect(text(el)).toContain("These flow sensors have no water meter.");
    root(el).querySelector<HTMLButtonElement>('.power-only li[data-stat="sensor.tap_flow"] button')!.click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!.textContent!;
    expect(dialog).toContain("Create a water meter for Tap flow?");
    expect(dialog).toContain("“Tap flow Water”");
    root(el).querySelector<HTMLButtonElement>("dialog button.primary")!.click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/create_integral")).toMatchObject({
      power_entity_id: "sensor.tap_flow",
      name: "Tap flow Water",
    });
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.tap_flow_water", parent: null, stat_rate: "sensor.tap_flow", kind: "water" },
    ]);
    expect(el._selected).toBe("sensor.tap_flow_water");
  });
});

describe("undo in the draft", () => {
  it("takes back the last change with the button and Ctrl+Z", async () => {
    const mock = mockHass();
    const el = await mount(mock);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    el._change({ type: "rename", stat: "sensor.tv", name: "Telly" });
    await settle(el);
    const validations = mock.calls.filter((c) => c.type === "energy_flow_mapper/validate").length;
    buttonWith(el, "Undo change").click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "move", stat: "sensor.tv", parent: "sensor.server" }]);
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/validate").length).toBe(validations + 1);
    expect(root(el).querySelector(".toast")!.textContent).toContain("Last change taken back.");
    // Ctrl+Z in a text field is the field's own undo.
    const input = root(el).querySelector<HTMLInputElement>('input[type="search"]')!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, composed: true }));
    expect(el._changes.length).toBe(1);
    // Not while a dialog is open, then outside: the draft is empty again.
    el._dialog = { kind: "menu" };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    expect(el._changes.length).toBe(1);
    el._dialog = null;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Z", metaKey: true }));
    await settle(el);
    expect(el._changes).toEqual([]);
    expect(root(el).querySelector(".footer")).toBeNull();
    // Nothing left: Ctrl+Z and the method do nothing.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    el._undoChange();
    expect(el._changes).toEqual([]);
    // After removal the shortcut is gone.
    el.remove();
    el._change({ type: "remove", stat: "sensor.tv" });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    expect(el._changes.length).toBe(1);
  });
});

describe("find in the diagram", () => {
  function sizeViewport(el: EnergyFlowMapperPanel): void {
    const viewport = root(el).querySelector<HTMLElement>(".viewport")!;
    Object.defineProperty(viewport, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 600, configurable: true });
  }

  it("highlights matches, cycles through them and centres the current one", async () => {
    const el = await mount(mockHass());
    sizeViewport(el);
    const input = root(el).querySelector<HTMLInputElement>(".find input")!;
    input.value = "o";
    input.dispatchEvent(new Event("input"));
    await settle(el);
    // "Server & co" (Office) and "Sonos amp" match; "sensor." does not count.
    expect(el.findMatches()).toEqual(["sensor.server", "sensor.sonos"]);
    expect(root(el).querySelector(".find-count")!.textContent).toContain("1 of 2");
    expect(node(el, "sensor.server").classList.contains("current")).toBe(true);
    expect(node(el, "sensor.tv").classList.contains("dim")).toBe(true);
    expect(el._selected).toBe("sensor.server");
    expect(el._autoFit).toBe(false);
    expect(el._zoom.k).toBeGreaterThanOrEqual(0.9);
    const block = el.diagramLayout().blocks.find((b) => b.stat === "sensor.server")!;
    expect(el._zoom.x + (block.x + block.w / 2) * el._zoom.k).toBeCloseTo(400);
    expect(el._zoom.y + (block.y + block.h / 2) * el._zoom.k).toBeCloseTo(300);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await settle(el);
    expect(root(el).querySelector(".find-count")!.textContent).toContain("2 of 2");
    expect(el._selected).toBe("sensor.sonos");
    buttonWith(el, "Next").click();
    await settle(el);
    expect(root(el).querySelector(".find-count")!.textContent).toContain("1 of 2");
    // Other keys do nothing.
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(el._findIndex).toBe(0);
  });

  it("opens collapsed devices, reports no match and clears", async () => {
    const el = await mount(mockHass());
    el._collapsed = new Set(["sensor.server"]);
    await settle(el);
    expect(root(el).querySelector('.node[data-stat="sensor.sonos"]')).toBeNull();
    el.setFind("amp");
    await settle(el);
    expect(el._collapsed.has("sensor.server")).toBe(false);
    expect(node(el, "sensor.sonos").classList.contains("match")).toBe(true);
    // Without a sized viewport nothing moves.
    expect(el._autoFit).toBe(true);
    el.setFind("zzz");
    await settle(el);
    expect(root(el).querySelector(".find-count")!.textContent).toContain("No match");
    el.nextMatch();
    expect(el._findIndex).toBe(0);
    el.setFind("");
    await settle(el);
    expect(root(el).querySelector(".find-count")).toBeNull();
    expect(root(el).querySelector(".block.dim")).toBeNull();
    // The area counts too, and switching tabs clears the search.
    el.setFind("office");
    expect(el.findMatches()).toEqual(["sensor.server"]);
    el.setTab("water");
    expect(el._find).toBe("");
  });
});

describe("home meter", () => {
  function homeMock(supported = true, sources?: unknown[]): Mock {
    const mock = mockHass();
    const snap = snapshot();
    snap.home_supported = supported;
    if (sources) {
      snap.prefs.energy_sources = sources as Snapshot["prefs"]["energy_sources"];
    }
    snap.stats["sensor.main"] = info("sensor.main", "Main meter");
    mock.responses["energy_flow_mapper/get"] = snap;
    return mock;
  }

  const WITH_HOME = [
    { type: "grid", stat_energy_from: "sensor.import", stat_energy_to: "sensor.export" },
    { type: "home", stat_energy_to: "sensor.main", stat_rate: "sensor.main_power" },
  ];

  function energy(home: Record<string, unknown>) {
    return (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: { "sensor.server": 12.5, "sensor.sonos": 2, "sensor.tv": 0.5, "sensor.main": 20 },
      untracked: { "sensor.server": 10.5, ...(home.untracked == null ? {} : { home: home.untracked }) },
      issues:
        typeof home.value === "number" && home.value < 13
          ? [{ code: "devices_exceed_home", severity: "warning", stat: "home", details: {} }]
          : [],
      home,
    });
  }

  it("offers a placeholder only where Home Assistant knows the home meter", async () => {
    const off = await mount(homeMock(false));
    expect(root(off).querySelector('.block.placeholder[data-role="home"]')).toBeNull();
    const el = await mount(homeMock(true));
    expect(root(el).querySelector('.block.placeholder[data-role="home"]')).not.toBeNull();
    el._tab = "water";
    await settle(el);
    expect(root(el).querySelector('.block.placeholder[data-role="home"]')).toBeNull();
  });

  it("assigns a free sensor as home meter from the placeholder", async () => {
    const el = await mount(homeMock());
    root(el).querySelector<HTMLButtonElement>('.block.placeholder[data-role="home"]')!.click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Assign Home meter");
    root(el).querySelector<HTMLButtonElement>('button.target[data-target="sensor.attic"]')!.click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "assign_source", role: "home", stat: "sensor.attic" }]);
    expect(root(el).querySelector('.block.source[data-role="home"]:not(.placeholder)')).not.toBeNull();
    const edge = root(el).querySelector('.edge[data-to="home"] path[stroke-dasharray]:not([stroke-dasharray="none"])');
    expect(edge).not.toBeNull();
  });

  it("uses a device as home meter by dropping it or from its menu, as one change", async () => {
    const el = await mount(homeMock());
    drag(node(el, "sensor.server"), root(el).querySelector<HTMLElement>('.block.placeholder[data-role="home"]')!);
    await settle(el);
    expect(el._changes).toEqual([{ type: "use_as_home_meter", stat: "sensor.server" }]);
    expect(el.draft.map((d) => d.stat_consumption)).toEqual(["sensor.sonos", "sensor.tv"]);
    expect(el.draftSources.at(-1)).toEqual({
      type: "home",
      stat_energy_to: "sensor.server",
      stat_rate: "sensor.server_power",
    });
    el._undoChange();
    await settle(el);
    expect(el._changes).toEqual([]);
    el._dialog = { kind: "actions", stat: "sensor.tv" };
    await settle(el);
    buttonWith(el, "Use as home meter").click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "use_as_home_meter", stat: "sensor.tv" }]);
    // With a home meter, neither is offered any more.
    el._dialog = { kind: "actions", stat: "sensor.server" };
    await settle(el);
    expect(text(el)).not.toContain("Use as home meter");
    expect(root(el).querySelector('.block.placeholder[data-role="home"]')).toBeNull();
  });

  it("does not offer the menu entry without support", async () => {
    const el = await mount(homeMock(false));
    el._dialog = { kind: "actions", stat: "sensor.tv" };
    await settle(el);
    expect(text(el)).not.toContain("Use as home meter");
  });

  it("shows the measured, calculated or late home consumption and what no device covers", async () => {
    const mock = homeMock(true, WITH_HOME);
    mock.responses["energy_flow_mapper/energy"] = energy({
      value: 20,
      basis: "measured",
      stale: null,
      untracked: 5,
    });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const home = () => root(el).querySelector(".block.home")!.textContent!.replace(/\s+/g, " ");
    expect(home()).toContain("20 kWh measured");
    const block = root(el).querySelector('.block.untracked[data-parent="home"]')!;
    expect(block.textContent).toContain("5 kWh");
    mock.responses["energy_flow_mapper/energy"] = energy({ value: 12, basis: "calculated", stale: null, untracked: -3 });
    el.setPeriod("month");
    await settle(el);
    expect(home()).toContain("12 kWh calculated");
    expect(root(el).querySelector(".block.home .badge")).not.toBeNull();
    mock.responses["energy_flow_mapper/energy"] = energy({ value: null, basis: null, stale: "sensor.main", untracked: null });
    el.setPeriod("today");
    await settle(el);
    expect(home()).toContain("Main meter: data not recent enough");
    expect(root(el).querySelector('.block.untracked[data-parent="home"]')).toBeNull();
  });

  it("shows how much of the home the devices cover, switchable", async () => {
    localStorage.clear();
    const mock = homeMock(true, WITH_HOME);
    mock.responses["energy_flow_mapper/energy"] = energy({ value: 20, basis: "measured", stale: null, untracked: 7 });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const home = () => root(el).querySelector(".block.home")!.textContent!.replace(/\s+/g, " ");
    // Server 12.5 kWh and TV 0.5 kWh of 20 kWh.
    expect(home()).toContain("65% covered by devices");
    const toggle = buttonWith(el, "Coverage");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    toggle.click();
    await settle(el);
    expect(home()).not.toContain("covered by devices");
    expect(localStorage.getItem("energy_flow_mapper.coverage")).toBe("off");
    document.body.innerHTML = "";
    const again = await mount(mock);
    again.setPeriod("week");
    await settle(again);
    expect(buttonWith(again, "Coverage").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows over 100 % when the devices use more than the home", async () => {
    localStorage.clear();
    const mock = homeMock(true, WITH_HOME);
    mock.responses["energy_flow_mapper/energy"] = energy({ value: 12, basis: "calculated", stale: null, untracked: -1 });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    expect(root(el).querySelector(".block.home")!.textContent).toContain("over 100% covered by devices");
  });

  it("offers the coverage switch only when there is a coverage to show", async () => {
    localStorage.clear();
    const mock = homeMock(true, WITH_HOME);
    mock.responses["energy_flow_mapper/energy"] = energy({ value: null, basis: null, stale: null, untracked: null });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const hasToggle = () => [...root(el).querySelectorAll("button")].some((b) => b.textContent!.includes("Coverage"));
    expect(hasToggle()).toBe(false);
    mock.responses["energy_flow_mapper/energy"] = energy({ value: 20, basis: "measured", stale: null, untracked: 7 });
    el.setPeriod("month");
    await settle(el);
    expect(hasToggle()).toBe(true);
  });

  it("shows no coverage in the water tab", async () => {
    localStorage.clear();
    const el = await mount(homeMock(true, WITH_HOME));
    el._tab = "water";
    await settle(el);
    expect(text(el)).not.toContain("covered by devices");
    expect([...root(el).querySelectorAll("button")].some((b) => b.textContent!.includes("Coverage"))).toBe(false);
  });

  it("measures Home now with the home meter's power sensor", async () => {
    const mock = homeMock(true, WITH_HOME);
    mock.hass.states["sensor.main_power"] = entity("sensor.main_power", "200");
    const el = await mount(mock);
    expect(root(el).querySelector(".block.home")!.textContent).toContain("200 W measured");
    // Server 50 W (with Sonos below it) and TV without power: unknown.
    expect(root(el).querySelector('.block.untracked[data-parent="home"]')).not.toBeNull();
    expect(root(el).querySelector('.block.untracked[data-parent="home"]')!.textContent).toContain("–");
  });
});

describe("home meter without a value", () => {
  it("does not show the sum of the devices as measured", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.home_supported = true;
    snap.prefs.energy_sources = [
      ...snap.prefs.energy_sources,
      { type: "home", stat_energy_to: "sensor.main" },
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: { "sensor.server": 12.5, "sensor.sonos": 2, "sensor.tv": 0.5 },
      untracked: {},
      issues: [],
      home: { value: null, basis: null, stale: null, untracked: null },
    });
    const el = await mount(mock);
    // Now: the home meter has no power sensor.
    expect(root(el).querySelector(".block.home")!.textContent).not.toContain("measured");
    el.setPeriod("week");
    await settle(el);
    expect(root(el).querySelector(".block.home")!.textContent).not.toContain("measured");
    expect(root(el).querySelector('.block.untracked[data-parent="home"]')).toBeNull();
  });
});

describe("home meter from a nested device", () => {
  it("is offered for top-level devices only", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.home_supported = true;
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    el._dialog = { kind: "actions", stat: "sensor.sonos" };
    await settle(el);
    expect(text(el)).not.toContain("Use as home meter");
    drag(node(el, "sensor.sonos"), root(el).querySelector<HTMLElement>('.block.placeholder[data-role="home"]')!);
    await settle(el);
    expect(el._changes).toEqual([]);
    el._dialog = { kind: "actions", stat: "sensor.tv" };
    await settle(el);
    expect(text(el)).toContain("Use as home meter");
  });
});

describe("Home Assistant's checks", () => {
  function withHa(mock: Mock, issues: Snapshot["ha_issues"]): Mock {
    mock.responses["energy_flow_mapper/get"] = { ...snapshot(), ha_issues: issues };
    mock.hass.localize = vi.fn((key: string) =>
      key === "component.energy.issues.entity_unavailable.title" ? "Entity unavailable" : "",
    );
    mock.hass.loadBackendTranslation = vi.fn(async () => undefined);
    return mock;
  }
  const unavailable = (stat: string, entity = stat) => ({
    stat,
    kind: "electricity" as const,
    type: "entity_unavailable",
    placeholders: null,
    entities: [[entity, "unavailable"]] as [string, unknown][],
  });

  it("marks the device and loads HA's texts", async () => {
    const mock = withHa(mockHass(), [unavailable("sensor.tv")]);
    const el = await mount(mock);
    expect(mock.hass.loadBackendTranslation).toHaveBeenCalledWith("issues", "energy");
    const badge = node(el, "sensor.tv").querySelector(".badge")!;
    expect(badge.getAttribute("title")).toBe("Entity unavailable");
    expect(node(el, "sensor.tv").classList.contains("has-warning")).toBe(true);
  });

  it("lists HA's messages in their own group in the details", async () => {
    const el = await mount(withHa(mockHass(), [unavailable("sensor.tv")]));
    node(el, "sensor.tv").click();
    await settle(el);
    expect(text(el)).toContain("Home Assistant reports");
    expect(text(el)).toContain("Entity unavailable");
  });

  it("names an affected sensor that is not the block's own", async () => {
    const el = await mount(withHa(mockHass(), [unavailable("sensor.server", "sensor.server_power")]));
    expect(node(el, "sensor.server").querySelector(".badge")!.getAttribute("title")).toBe(
      "Entity unavailable: sensor.server_power (unavailable)",
    );
  });

  it("falls back to the type without a translation", async () => {
    const el = await mount(withHa(mockHass(), [{ ...unavailable("sensor.tv"), type: "something_new" }]));
    expect(node(el, "sensor.tv").querySelector(".badge")!.getAttribute("title")).toBe("something_new");
  });

  it("marks a source block", async () => {
    const el = await mount(withHa(mockHass(), [unavailable("sensor.import")]));
    const source = root(el).querySelector('.block.source[data-role="import"]')!;
    expect(source.querySelector(".badge")!.getAttribute("title")).toBe("Entity unavailable");
  });

  it("shows nothing for a device the draft removed", async () => {
    const el = await mount(withHa(mockHass(), [unavailable("sensor.tv")]));
    el._change({ type: "remove", stat: "sensor.tv" });
    await settle(el);
    expect([...root(el).querySelectorAll(".badge")].map((b) => b.getAttribute("title"))).not.toContain(
      "Entity unavailable",
    );
  });

  it("shows the messages of a grid connection with only a power sensor at grid import", async () => {
    const mock = withHa(mockHass(), [unavailable("sensor.grid_power")]);
    const snap = mock.responses["energy_flow_mapper/get"] as Snapshot;
    snap.prefs.energy_sources = [
      { type: "grid", stat_energy_from: null, stat_energy_to: null, power_config: { stat_rate: "sensor.grid_power" } },
    ] as Snapshot["prefs"]["energy_sources"];
    const el = await mount(mock);
    const placeholder = root(el).querySelector('.block.placeholder[data-role="import"]') as HTMLElement;
    expect(placeholder.querySelector(".badge")!.getAttribute("title")).toBe("Entity unavailable");
    placeholder.click();
    await settle(el);
    expect(text(el)).toContain("Home Assistant reports");
  });

  it("ignores messages of the other tab", async () => {
    const el = await mount(withHa(mockHass(), [{ ...unavailable("sensor.tv"), kind: "water" }]));
    expect(node(el, "sensor.tv").querySelector(".badge")).toBeNull();
  });
});

describe("suggestions from child devices", () => {
  const pair = (stat: string, parent: string) => ({ kind: "electricity" as const, stat, parent });

  function withPairs(pairs: ReturnType<typeof pair>[], ignored: ReturnType<typeof pair>[] = []): Mock {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.device_consumption.push({ stat_consumption: "sensor.lamp" });
    snap.stats["sensor.lamp"] = info("sensor.lamp", "Lamp");
    snap.child_pairs = pairs;
    snap.ignored_suggestions = ignored;
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.responses["energy_flow_mapper/ignore_suggestion"] = (msg: { kind: string; stat: string; parent: string }) => ({
      ignored: [...ignored, { kind: msg.kind, stat: msg.stat, parent: msg.parent }],
    });
    mock.responses["energy_flow_mapper/clear_suggestions"] = { ignored: [] };
    return mock;
  }

  const hasButton = (el: EnergyFlowMapperPanel, label: string) =>
    [...root(el).querySelectorAll("button")].some((b) => b.textContent!.includes(label));

  it("shows nothing without child devices", async () => {
    const el = await mount(withPairs([]));
    expect(root(el).querySelector(".suggested")).toBeNull();
    expect(hasButton(el, "Apply all suggestions")).toBe(false);
    expect(hasButton(el, "Show ignored suggestions again")).toBe(false);
  });

  it("marks the device and explains the suggestion in the details", async () => {
    const el = await mount(withPairs([pair("sensor.tv", "sensor.server")]));
    expect(node(el, "sensor.tv").classList.contains("suggested")).toBe(true);
    expect(node(el, "sensor.server").classList.contains("suggested")).toBe(false);
    node(el, "sensor.tv").click();
    await settle(el);
    expect(text(el)).toContain("Suggestion: included in Server & co");
  });

  it("applies a suggestion as a normal change of the draft", async () => {
    const el = await mount(withPairs([pair("sensor.tv", "sensor.server")]));
    node(el, "sensor.tv").click();
    await settle(el);
    buttonWith(el, "Apply").click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "move", stat: "sensor.tv", parent: "sensor.server" }]);
    expect(root(el).querySelector(".suggested")).toBeNull();
  });

  it("ignores a suggestion in Home Assistant and shows it again on request", async () => {
    const mock = withPairs([pair("sensor.tv", "sensor.server")]);
    const el = await mount(mock);
    node(el, "sensor.tv").click();
    await settle(el);
    buttonWith(el, "Ignore").click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/ignore_suggestion")).toEqual({
      type: "energy_flow_mapper/ignore_suggestion",
      kind: "electricity",
      stat: "sensor.tv",
      parent: "sensor.server",
    });
    expect(root(el).querySelector(".suggested")).toBeNull();
    expect(el._changes).toEqual([]);
    buttonWith(el, "Show ignored suggestions again").click();
    await settle(el);
    // Only the ignores of this tab come back.
    expect(lastCall(mock, "energy_flow_mapper/clear_suggestions")).toEqual({
      type: "energy_flow_mapper/clear_suggestions",
      kind: "electricity",
    });
    expect(node(el, "sensor.tv").classList.contains("suggested")).toBe(true);
  });

  it("offers applying all only from two suggestions", async () => {
    const one = await mount(withPairs([pair("sensor.tv", "sensor.server")]));
    expect(hasButton(one, "Apply all suggestions")).toBe(false);
    document.body.innerHTML = "";
    const el = await mount(withPairs([pair("sensor.tv", "sensor.server"), pair("sensor.lamp", "sensor.server")]));
    buttonWith(el, "Apply all suggestions").click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "move", stat: "sensor.tv", parent: "sensor.server" },
      { type: "move", stat: "sensor.lamp", parent: "sensor.server" },
    ]);
  });

  it("does not suggest what the tree already shows", async () => {
    const el = await mount(withPairs([pair("sensor.sonos", "sensor.server")]));
    expect(root(el).querySelector(".suggested")).toBeNull();
  });

  it("suggests a meter the draft adds as a device", async () => {
    const el = await mount(withPairs([pair("sensor.attic", "sensor.server")]));
    expect(el._suggestions()).toEqual([]);
    el._change({ type: "add", stat: "sensor.attic" });
    await settle(el);
    expect(node(el, "sensor.attic").classList.contains("suggested")).toBe(true);
  });

  it("checks the draft once when applying all suggestions", async () => {
    const mock = withPairs([pair("sensor.tv", "sensor.server"), pair("sensor.lamp", "sensor.server")]);
    const el = await mount(mock);
    buttonWith(el, "Apply all suggestions").click();
    await settle(el);
    expect(el._changes).toHaveLength(2);
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/validate")).toHaveLength(1);
  });
});

describe("save as image", () => {
  function capture(el: EnergyFlowMapperPanel) {
    const downloads: { name: string; href: string }[] = [];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });
    const toPng = vi.fn(async (_svg: string, _w: number, _h: number) => new Blob(["png"], { type: "image/png" }));
    el._toPng = toPng;
    return { downloads, toPng };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function save(el: EnergyFlowMapperPanel, hideNames = false): Promise<void> {
    buttonWith(el, "Save as image").click();
    await settle(el);
    if (hideNames) {
      root(el).querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();
      await settle(el);
    }
    root(el).querySelector<HTMLButtonElement>("dialog button.primary")!.click();
    await settle(el);
  }

  it("opens a dialog with the option to hide names", async () => {
    const el = await mount(mockHass());
    buttonWith(el, "Save as image").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Hide names");
  });

  it("saves the whole diagram as a PNG named after the tab and the day", async () => {
    const el = await mount(mockHass());
    const { downloads, toPng } = capture(el);
    await save(el);
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toMatch(/^energy-flow-mapper-electricity-[0-9]{4}-[0-9]{2}-[0-9]{2}[.]png$/);
    const svg = toPng.mock.calls[0][0];
    expect(svg).toContain("Server &amp; co");
    expect(svg).toContain("Office");
    expect(svg).toContain("Energy Flow Mapper · Electricity · Now");
    expect(svg).not.toContain("Draft, not saved");
    expect(root(el).querySelector("dialog[open]")).toBeNull();
  });

  it("hides names, areas and sensor names on request", async () => {
    const el = await mount(mockHass());
    const { toPng } = capture(el);
    await save(el, true);
    const svg = toPng.mock.calls[0][0];
    for (const secret of ["Server", "Sonos", "TV", "Office", "sensor."]) {
      expect(svg).not.toContain(secret);
    }
    expect(svg).toContain("Device 1");
    expect(svg).toContain("Grid import");
  });

  it("hides the meter name of a late home meter", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.home_supported = true;
    snap.prefs.energy_sources.push({ type: "home", stat_energy_to: "sensor.main" });
    snap.stats["sensor.main"] = info("sensor.main", "Main meter");
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-10-17T00:00:00+02:00",
      end: "2026-10-23T15:00:00+02:00",
      energy: {},
      untracked: {},
      issues: [],
      home: { value: null, basis: null, stale: "sensor.main", untracked: null },
    });
    const el = await mount(mock);
    el.setPeriod("week");
    await settle(el);
    const { toPng } = capture(el);
    await save(el, true);
    expect(toPng.mock.calls[0][0]).not.toContain("Main meter");
  });

  it("marks a draft that is not saved", async () => {
    const el = await mount(mockHass());
    const { toPng } = capture(el);
    el._change({ type: "move", stat: "sensor.tv", parent: "sensor.server" });
    await settle(el);
    await save(el);
    expect(toPng.mock.calls[0][0]).toContain("Draft, not saved");
  });
});

describe("groups", () => {
  // The server gets a second child; the Sonos amp sits in the group "Media".
  function groupSnapshot(): Snapshot {
    const snap = snapshot();
    snap.prefs.device_consumption.push({
      stat_consumption: "sensor.nas",
      stat_rate: "sensor.nas_power",
      included_in_stat: "sensor.server",
    });
    snap.stats["sensor.nas"] = info("sensor.nas", "NAS");
    snap.groups = {
      electricity: [{ id: "g1", name: "Media", parent: "sensor.server", group: null, members: ["sensor.sonos"] }],
    };
    return snap;
  }

  function groupMock(language = "en"): Mock {
    const mock = mockHass(language);
    mock.responses["energy_flow_mapper/get"] = groupSnapshot();
    mock.hass.states["sensor.nas_power"] = entity("sensor.nas_power", "20");
    return mock;
  }

  function group(el: EnergyFlowMapperPanel, id: string): HTMLElement {
    return root(el).querySelector<HTMLElement>(`.block.group[data-group="${id}"]`)!;
  }

  function frame(el: EnergyFlowMapperPanel, id: string): HTMLElement | null {
    return root(el).querySelector<HTMLElement>(`.frame[data-group="${id}"]`);
  }

  function ctrlClick(target: HTMLElement): void {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
  }

  function edgeList(el: EnergyFlowMapperPanel): string[] {
    return [...root(el).querySelectorAll<SVGGElement>(".edge")].map((e) => `${e.dataset.from}>${e.dataset.to}`);
  }

  async function expand(el: EnergyFlowMapperPanel, id: string): Promise<void> {
    group(el, id).querySelector<HTMLButtonElement>("button.toggle")!.click();
    await settle(el);
  }

  it("shows a saved group collapsed with its device count and value", async () => {
    const mock = groupMock();
    mock.responses["energy_flow_mapper/energy"] = (msg: { period: string }) => ({
      period: msg.period,
      start: "2026-11-04T00:00:00+01:00",
      end: "2026-11-11T12:00:00+01:00",
      energy: { "sensor.server": 9, "sensor.sonos": 1.5, "sensor.nas": 2, "sensor.tv": 1 },
      water_unit: "L",
      untracked: {},
      issues: [],
    });
    const el = await mount(mock);
    expect(el._collapsed.has("group:g1")).toBe(true);
    const block = group(el, "g1");
    expect(block.classList.contains("node")).toBe(false);
    expect(block.textContent).toContain("Media");
    expect(block.textContent).toContain("1 device");
    expect(block.textContent).toContain("10 W");
    expect(block.querySelector("button.toggle")!.textContent).toContain("▸");
    // The amp is hidden in the group; the group hangs from the server.
    expect(root(el).querySelector('.node[data-stat="sensor.sonos"]')).toBeNull();
    expect(edgeList(el)).toContain("sensor.server>group:g1");
    expect(edgeList(el)).toContain("sensor.server>sensor.nas");
    // A period shows the energy of the members.
    el.setPeriod("week");
    await settle(el);
    expect(group(el, "g1").textContent).toContain("1.5 kWh");
    // Tapping the block opens the actions of the group.
    group(el, "g1").click();
    await settle(el);
    expect(root(el).querySelector("dialog")!.textContent).toContain("Media");
  });

  it("expands a group into a frame and collapses it again", async () => {
    const el = await mount(groupMock());
    expect(frame(el, "g1")).toBeNull();
    await expand(el, "g1");
    expect(el._collapsed.has("group:g1")).toBe(false);
    expect(frame(el, "g1")).not.toBeNull();
    expect(node(el, "sensor.sonos")).not.toBeNull();
    const header = group(el, "g1");
    expect(header.textContent).toContain("▾");
    expect(header.textContent).toContain("Media · 10 W");
    expect(edgeList(el)).toContain("group:g1>sensor.sonos");
    // The header toggles.
    header.click();
    await settle(el);
    expect(el._collapsed.has("group:g1")).toBe(true);
    expect(frame(el, "g1")).toBeNull();
    expect(root(el).querySelector("dialog[open]")).toBeNull();
  });

  it("keeps an expanded group open across reloads and period switches", async () => {
    const mock = groupMock();
    const el = await mount(mock);
    await expand(el, "g1");
    el.setPeriod("week");
    await settle(el);
    el._change({ type: "rename", stat: "sensor.tv", name: "TV" });
    await el._save();
    await settle(el);
    expect(el._collapsed.has("group:g1")).toBe(false);
    // A group new to this panel (saved elsewhere) still starts collapsed.
    const snap = groupSnapshot();
    snap.groups!.electricity!.push({ id: "g9", name: "Rack", parent: null, group: null, members: ["sensor.tv"] });
    mock.responses["energy_flow_mapper/get"] = snap;
    await el._load();
    await settle(el);
    expect(el._collapsed.has("group:g1")).toBe(false);
    expect(el._collapsed.has("group:g9")).toBe(true);
  });

  it("keeps a group created in this panel expanded after saving", async () => {
    const mock = groupMock();
    const el = await mount(mock);
    el._change({ type: "create_group", id: "g2", name: "Living", parent: null, members: ["sensor.tv"], groups: [] });
    await settle(el);
    const snap = groupSnapshot();
    snap.groups!.electricity!.push({ id: "g2", name: "Living", parent: null, group: null, members: ["sensor.tv"] });
    mock.responses["energy_flow_mapper/get"] = snap;
    await el._save();
    await settle(el);
    expect(el._collapsed.has("group:g2")).toBe(false);
    expect(el._collapsed.has("group:g1")).toBe(true);
  });

  it("opens a collapsed group when search finds a device inside", async () => {
    const el = await mount(groupMock());
    el._collapsed = new Set([...el._collapsed, "sensor.server"]);
    await settle(el);
    el.setFind("amp");
    await settle(el);
    expect(el._collapsed.has("group:g1")).toBe(false);
    expect(el._collapsed.has("sensor.server")).toBe(false);
    expect(node(el, "sensor.sonos").classList.contains("match")).toBe(true);
  });

  it("selects several devices with Ctrl+click and groups them", async () => {
    const mock = groupMock();
    const el = await mount(mock);
    ctrlClick(node(el, "sensor.nas"));
    ctrlClick(group(el, "g1"));
    ctrlClick(node(el, "sensor.tv"));
    ctrlClick(node(el, "sensor.tv"));
    await settle(el);
    expect([...el._multi]).toEqual(["sensor.nas", "group:g1"]);
    expect(node(el, "sensor.nas").classList.contains("multi")).toBe(true);
    // Ctrl+click neither selects for the details nor opens the group's dialog.
    expect(el._selected).toBeNull();
    expect(root(el).querySelector("dialog[open]")).toBeNull();
    const footer = root(el).querySelector(".footer")!;
    expect(footer.textContent).toContain("2 selected");
    const groupButton = buttonWith(el, "Group");
    expect(groupButton.disabled).toBe(false);
    groupButton.click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!;
    const ok = () => [...dialog.querySelectorAll("button")].find((b) => b.textContent!.includes("OK"))!;
    // A name is needed, and one the server's groups do not use yet.
    expect(ok().disabled).toBe(true);
    const input = dialog.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = "Media";
    input.dispatchEvent(new Event("input"));
    await settle(el);
    expect(ok().disabled).toBe(true);
    expect(dialog.textContent).toContain("There is already a group called Media here");
    input.value = " Rack ";
    input.dispatchEvent(new Event("input"));
    await settle(el);
    ok().click();
    await settle(el);
    expect(el._changes).toEqual([
      {
        type: "create_group",
        id: expect.stringMatching(/^[0-9a-f]{32}$/),
        name: "Rack",
        parent: "sensor.server",
        group: null,
        members: ["sensor.nas"],
        groups: ["g1"],
      },
    ]);
    expect(el._multi.size).toBe(0);
    // A group created now starts expanded, around the NAS and the group Media.
    const id = (el._changes[0] as { id: string }).id;
    expect(el._collapsed.has(`group:${id}`)).toBe(false);
    expect(group(el, id).textContent).toContain("Rack");
    expect(frame(el, id)).not.toBeNull();
    expect(lastCall(mock, "energy_flow_mapper/validate")).toMatchObject({ changes: el._changes });
  });

  it("selects with the touch mode", async () => {
    const el = await mount(groupMock());
    const select = buttonWith(el, "Select");
    expect(select.getAttribute("aria-pressed")).toBe("false");
    select.click();
    await settle(el);
    expect(buttonWith(el, "Select").getAttribute("aria-pressed")).toBe("true");
    node(el, "sensor.nas").click();
    group(el, "g1").click();
    await settle(el);
    expect([...el._multi]).toEqual(["sensor.nas", "group:g1"]);
    expect(el._selected).toBeNull();
    expect(root(el).querySelector("dialog[open]")).toBeNull();
    expect(root(el).querySelector(".footer")!.textContent).toContain("2 selected");
    buttonWith(el, "Clear selection").click();
    await settle(el);
    expect(el._multi.size).toBe(0);
    expect(root(el).querySelector(".footer")).toBeNull();
    // Leaving the mode drops the selection, and taps select for the details again.
    node(el, "sensor.nas").click();
    buttonWith(el, "Select").click();
    await settle(el);
    expect(el._multi.size).toBe(0);
    node(el, "sensor.nas").click();
    await settle(el);
    expect(el._selected).toBe("sensor.nas");
  });

  it("does not group devices of different parents", async () => {
    const el = await mount(groupMock());
    ctrlClick(node(el, "sensor.nas"));
    ctrlClick(node(el, "sensor.tv"));
    await settle(el);
    const groupButton = buttonWith(el, "Group");
    expect(groupButton.disabled).toBe(true);
    expect(groupButton.title).toBe("Only devices with the same parent");
    // A device the draft removes leaves the selection.
    el._change({ type: "remove", stat: "sensor.tv" });
    await settle(el);
    expect([...el._multi]).toEqual(["sensor.nas"]);
    expect(buttonWith(el, "Group").disabled).toBe(false);
    // Switching tabs drops the selection.
    el.setTab("water");
    await settle(el);
    expect(el._multi.size).toBe(0);
  });

  it("drags a device into a group and out again", async () => {
    const el = await mount(groupMock());
    drag(node(el, "sensor.nas"), group(el, "g1"));
    await settle(el);
    expect(el._changes).toEqual([{ type: "set_group", stat: "sensor.nas", group: "g1" }]);
    expect(group(el, "g1").textContent).toContain("2 devices");
    await expand(el, "g1");
    // Onto its real parent: it leaves the group.
    drag(node(el, "sensor.nas"), node(el, "sensor.server"));
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "set_group", stat: "sensor.nas", group: null });
    // Onto the frame: it joins the group again.
    drag(node(el, "sensor.nas"), frame(el, "g1")!);
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "set_group", stat: "sensor.nas", group: "g1" });
    // Not into the group it is in already.
    drag(node(el, "sensor.nas"), frame(el, "g1")!);
    await settle(el);
    expect(el._changes).toHaveLength(3);
  });

  it("drags a device of another parent into a group: move and set_group", async () => {
    const mock = groupMock();
    const el = await mount(mock);
    const before = mock.calls.filter((c) => c.type === "energy_flow_mapper/validate").length;
    drag(node(el, "sensor.tv"), group(el, "g1"));
    await settle(el);
    expect(el._changes).toEqual([
      { type: "move", stat: "sensor.tv", parent: "sensor.server" },
      { type: "set_group", stat: "sensor.tv", group: "g1" },
    ]);
    expect(group(el, "g1").textContent).toContain("2 devices");
    // Checked once for both.
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/validate")).toHaveLength(before + 1);
    // The server cannot go into a group below itself.
    drag(node(el, "sensor.server"), group(el, "g1"));
    await settle(el);
    expect(el._changes).toHaveLength(2);
  });

  it("drags a group onto a device: move_group", async () => {
    const el = await mount(groupMock());
    // Not onto its own parent, where it is already.
    drag(group(el, "g1"), node(el, "sensor.server"));
    await settle(el);
    expect(el._changes).toEqual([]);
    drag(group(el, "g1"), node(el, "sensor.tv"));
    await settle(el);
    expect(el._changes).toEqual([{ type: "move_group", id: "g1", parent: "sensor.tv" }]);
    expect(el.draft.find((d) => d.stat_consumption === "sensor.sonos")?.included_in_stat).toBe("sensor.tv");
    expect(edgeList(el)).toContain("sensor.tv>group:g1");
    el._undoChange();
    // Onto a group of another parent: it moves there and into that group.
    el._change({ type: "create_group", id: "g2", name: "Living", parent: null, members: ["sensor.tv"], groups: [] });
    await settle(el);
    drag(group(el, "g1"), frame(el, "g2")!);
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "move_group", id: "g1", parent: null, group: "g2" });
    // Out of the frame onto Home, its real parent now: it leaves the group.
    drag(group(el, "g1"), root(el).querySelector<HTMLElement>(".block.home")!);
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "set_group", group_id: "g1", group: null });
  });

  it("lists group changes in the confirm dialog", async () => {
    const mock = groupMock("de");
    mock.responses["energy_flow_mapper/validate"] = {
      valid: true,
      issues: [],
      diff: [
        { type: "group_created", stat: "group:g2", id: "g2", name: "Küche", count: 4, kind: "electricity" },
        { type: "group_renamed", stat: "group:g1", id: "g1", from: "Media", to: "TV & Audio", kind: "electricity" },
        { type: "group_changed", stat: "group:g1", id: "g1", name: "Media", count: 1, kind: "electricity" },
        { type: "group_dissolved", stat: "group:g3", id: "g3", name: "Bad", kind: "water" },
      ],
    } satisfies ValidateResult;
    const el = await mount(mock);
    el._change({ type: "rename_group", id: "g1", name: "TV & Audio" });
    await el._openConfirm();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!.textContent!;
    expect(dialog).toContain("Gruppe «Küche» erstellt (4 Geräte)");
    expect(dialog).toContain("Gruppe «Media» umbenannt in «TV & Audio»");
    expect(dialog).toContain("Gruppe «Media» geändert (1 Gerät)");
    expect(dialog).toContain("Wasser: Gruppe «Bad» aufgelöst");
    // Backups count them too.
    expect(el._summaryText({ group_created: 2 })).toBe("2 Gruppe(n) erstellt");
  });

  it("keeps group changes in the kept draft", async () => {
    const changes: Change[] = [
      { type: "create_group", id: "g2", name: "Rack", parent: "sensor.server", members: ["sensor.nas"], groups: [] },
      { type: "set_group", group_id: "g1", group: "g2" },
    ];
    const first = await mount(groupMock());
    for (const change of changes) {
      first._change(change);
    }
    await settle(first);
    first.remove();
    const again = await mount(groupMock());
    expect(again._changes).toEqual(changes);
    expect(text(again)).toContain("Your unsaved changes were restored");
    expect(group(again, "g2").textContent).toContain("Rack");
    // Media sits in Rack and is still collapsed.
    expect(group(again, "g1")).not.toBeNull();
    expect(again._collapsed.has("group:g1")).toBe(true);
  });

  it("draws groups as shown in the saved image", async () => {
    const el = await mount(groupMock());
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const toPng = vi.fn(async (_svg: string, _w: number, _h: number) => new Blob(["png"]));
    el._toPng = toPng;
    try {
      await el._saveImage(false);
      expect(toPng.mock.calls[0][0]).toContain("Media");
      expect(toPng.mock.calls[0][0]).toContain("1 device");
      await expand(el, "g1");
      await el._saveImage(true);
      const hidden = toPng.mock.calls[1][0];
      expect(hidden).not.toContain("Media");
      expect(hidden).toContain("Group 1");
      expect(hidden).toContain('class="frame"');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("takes back a drag that moves a device into a group of another parent as one step", async () => {
    const el = await mount(groupMock());
    el._change({ type: "rename", stat: "sensor.nas", name: "Disk" });
    drag(node(el, "sensor.tv"), group(el, "g1"));
    await settle(el);
    expect(el._changes).toHaveLength(3);
    el._undoChange();
    await settle(el);
    expect(el._changes).toEqual([{ type: "rename", stat: "sensor.nas", name: "Disk" }]);
    el._undoChange();
    expect(el._changes).toEqual([]);
  });

  it("drops a group onto a group of the same parent: set_group", async () => {
    const el = await mount(groupMock());
    el._change({ type: "create_group", id: "g2", name: "Rack", parent: "sensor.server", members: ["sensor.nas"], groups: [] });
    await settle(el);
    drag(group(el, "g1"), group(el, "g2"));
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "set_group", group_id: "g1", group: "g2" });
    expect(el._groups.find((g) => g.id === "g1")?.group).toBe("g2");
  });

  it("refuses a group dropped into its own nested group", async () => {
    const el = await mount(groupMock());
    el._change({ type: "create_group", id: "g2", name: "Rack", parent: "sensor.server", members: ["sensor.nas"], groups: ["g1"] });
    await settle(el);
    drag(group(el, "g2"), group(el, "g1"));
    await settle(el);
    expect(el._changes).toHaveLength(1);
  });

  it("refuses a move_group when a group of that name exists at the target", async () => {
    const el = await mount(groupMock());
    el._change({ type: "create_group", id: "g2", name: "Media", parent: null, members: ["sensor.tv"], groups: [] });
    await settle(el);
    drag(group(el, "g1"), root(el).querySelector<HTMLElement>(".block.home")!);
    await settle(el);
    expect(el._changes).toHaveLength(1);
    // Onto a device without such a group it moves.
    drag(group(el, "g1"), node(el, "sensor.tv"));
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "move_group", id: "g1", parent: "sensor.tv" });
  });

  // --- group actions, area suggestions, sum meter -----------------------------

  /** An energy meter as Home Assistant reports it. */
  function meter(entity_id: string, stateClass = "total_increasing", deviceClass = "energy"): HassEntity {
    return {
      entity_id,
      state: "12.5",
      attributes: { unit_of_measurement: "kWh", device_class: deviceClass, state_class: stateClass },
    };
  }

  function dialogEl(el: EnergyFlowMapperPanel): HTMLDialogElement {
    return root(el).querySelector("dialog")!;
  }

  function dialogButton(el: EnergyFlowMapperPanel, label: string): HTMLButtonElement {
    const button = [...dialogEl(el).querySelectorAll("button")].find((b) => b.textContent!.includes(label));
    if (!button) {
      throw new Error(`No dialog button "${label}"`);
    }
    return button;
  }

  async function typeName(el: EnergyFlowMapperPanel, value: string): Promise<void> {
    const input = dialogEl(el).querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await settle(el);
  }

  function members(el: EnergyFlowMapperPanel): string[] {
    return [...dialogEl(el).querySelectorAll<HTMLElement>(".sum-member")].map((m) => m.dataset.stat!);
  }

  it("renames and dissolves a group", async () => {
    const el = await mount(groupMock());
    group(el, "g1").click();
    await settle(el);
    expect(dialogEl(el).querySelector("h2")!.textContent).toContain("Media");
    expect(dialogEl(el).textContent).toContain("Dissolve group");
    expect(dialogEl(el).textContent).toContain("Create sum meter");
    dialogButton(el, "Rename").click();
    await settle(el);
    expect(dialogEl(el).querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("Media");
    await typeName(el, " ");
    expect(dialogButton(el, "OK").disabled).toBe(true);
    await typeName(el, " Audio ");
    dialogButton(el, "OK").click();
    await settle(el);
    expect(el._changes).toEqual([{ type: "rename_group", id: "g1", name: "Audio" }]);
    expect(group(el, "g1").textContent).toContain("Audio");
    // Dissolving: the amp shows again, the group is gone.
    group(el, "g1").click();
    await settle(el);
    dialogButton(el, "Dissolve group").click();
    await settle(el);
    expect(el._changes.at(-1)).toEqual({ type: "dissolve_group", id: "g1" });
    expect(group(el, "g1")).toBeNull();
    expect(node(el, "sensor.sonos")).not.toBeNull();
    expect(root(el).querySelector("dialog[open]")).toBeNull();
  });

  it("refuses a group name taken by another group of the parent", async () => {
    const el = await mount(groupMock());
    el._change({ type: "create_group", id: "g2", name: "Rack", parent: "sensor.server", members: ["sensor.nas"], groups: [] });
    el._dialog = { kind: "group", id: "g1" };
    await settle(el);
    dialogButton(el, "Rename").click();
    await settle(el);
    await typeName(el, "Rack");
    expect(dialogButton(el, "OK").disabled).toBe(true);
    expect(dialogEl(el).textContent).toContain("There is already a group called Rack here");
  });

  it("creates a sum meter from a group: add, move_group and moves, group gone", async () => {
    const mock = groupMock();
    const snap = groupSnapshot();
    // The NAS sits in the group "Shelf" inside "Media".
    snap.groups!.electricity!.push({ id: "g2", name: "Shelf", parent: "sensor.server", group: "g1", members: ["sensor.nas"] });
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.sonos"] = meter("sensor.sonos");
    mock.hass.states["sensor.nas"] = meter("sensor.nas");
    mock.responses["energy_flow_mapper/create_sum_meter"] = {
      entity_id: "sensor.media_energy",
      stat_rate: "sensor.media_power",
    };
    const el = await mount(mock);
    group(el, "g1").click();
    await settle(el);
    dialogButton(el, "Create sum meter").click();
    await settle(el);
    expect(dialogEl(el).querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("Media Energy");
    expect(members(el)).toEqual(["sensor.sonos", "sensor.nas"]);
    // The group's devices are fixed.
    expect(dialogEl(el).querySelector(".sum-member button.remove")).toBeNull();
    expect(dialogEl(el).textContent).toContain("stays");
    dialogButton(el, "Create").click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/create_sum_meter")).toEqual({
      type: "energy_flow_mapper/create_sum_meter",
      kind: "electricity",
      name: "Media Energy",
      entity_ids: ["sensor.sonos", "sensor.nas"],
      rate_entity_ids: ["sensor.sonos_power", "sensor.nas_power"],
      rate_name: "Media Power",
    });
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.media_energy", parent: "sensor.server", stat_rate: "sensor.media_power" },
      { type: "move_group", id: "g2", parent: "sensor.media_energy" },
      { type: "move", stat: "sensor.sonos", parent: "sensor.media_energy" },
    ]);
    // Media is gone; Shelf now hangs from the new meter, with the NAS.
    expect(el._groups.map((g) => [g.id, g.parent, g.group])).toEqual([["g2", "sensor.media_energy", null]]);
    const parents = Object.fromEntries(el.draft.map((d) => [d.stat_consumption, d.included_in_stat ?? null]));
    expect(parents).toMatchObject({
      "sensor.media_energy": "sensor.server",
      "sensor.sonos": "sensor.media_energy",
      "sensor.nas": "sensor.media_energy",
    });
    expect(el._selected).toBe("sensor.media_energy");
    expect(text(el)).toContain("Sum meter “Media Energy” created");
    // One undo takes back the whole draft sequence; the helper stays.
    el._undoChange();
    await settle(el);
    expect(el._changes).toEqual([]);
  });

  it("creates a free sum meter from a device with a solar source added", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.energy_sources.push({ type: "solar", stat_energy_from: "sensor.solar" });
    snap.stats["sensor.solar"] = info("sensor.solar", "Roof solar");
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.tv"] = meter("sensor.tv");
    mock.hass.states["sensor.solar"] = meter("sensor.solar");
    mock.responses["energy_flow_mapper/create_sum_meter"] = { entity_id: "sensor.tv_sum", stat_rate: null };
    const el = await mount(mock);
    el._dialog = { kind: "actions", stat: "sensor.tv" };
    await settle(el);
    dialogButton(el, "Create sum meter").click();
    await settle(el);
    expect(dialogEl(el).querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("TV Energy");
    expect(members(el)).toEqual(["sensor.tv"]);
    dialogButton(el, "Add sensor").click();
    await settle(el);
    // Devices and sources of the tab; not the TV itself.
    const offered = [...dialogEl(el).querySelectorAll<HTMLElement>("button.target")].map((b) => b.dataset.target);
    expect(offered).toContain("sensor.solar");
    expect(offered).toContain("sensor.server");
    expect(offered).not.toContain("sensor.tv");
    dialogEl(el).querySelector<HTMLButtonElement>('button.target[data-target="sensor.solar"]')!.click();
    await settle(el);
    expect(members(el)).toEqual(["sensor.tv", "sensor.solar"]);
    // Freely chosen sensors can be removed again.
    expect(dialogEl(el).querySelectorAll(".sum-member button.remove")).toHaveLength(2);
    await typeName(el, "Sub panel");
    dialogButton(el, "Create").click();
    await settle(el);
    // The TV has no power sensor, so there is no rate sum.
    expect(lastCall(mock, "energy_flow_mapper/create_sum_meter")).toEqual({
      type: "energy_flow_mapper/create_sum_meter",
      kind: "electricity",
      name: "Sub panel",
      entity_ids: ["sensor.tv", "sensor.solar"],
    });
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.tv_sum", parent: null },
      { type: "move", stat: "sensor.tv", parent: "sensor.tv_sum" },
    ]);
    // The solar sensor stays a source.
    expect(el.draftSources.some((s) => s.type === "solar" && s.stat_energy_from === "sensor.solar")).toBe(true);
    expect(el.draft.some((d) => d.stat_consumption === "sensor.solar")).toBe(false);
  });

  it("puts a sum meter of a nested group in the group's place", async () => {
    const mock = groupMock();
    const snap = groupSnapshot();
    snap.groups!.electricity!.push({ id: "g2", name: "Shelf", parent: "sensor.server", group: "g1", members: ["sensor.nas"] });
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.nas"] = meter("sensor.nas");
    mock.responses["energy_flow_mapper/create_sum_meter"] = { entity_id: "sensor.shelf_energy", stat_rate: null };
    const el = await mount(mock);
    el._openSum({ group: "g2" });
    await settle(el);
    dialogButton(el, "Create").click();
    await settle(el);
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.shelf_energy", parent: "sensor.server" },
      { type: "set_group", stat: "sensor.shelf_energy", group: "g1" },
      { type: "move", stat: "sensor.nas", parent: "sensor.shelf_energy" },
    ]);
    expect(el._groups.map((g) => [g.id, g.members])).toEqual([["g1", ["sensor.sonos", "sensor.shelf_energy"]]]);
  });

  it("creates a water sum meter with a flow sum", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.device_consumption_water = [{ stat_consumption: "sensor.tap", stat_rate: "sensor.tap_flow" }];
    snap.stats["sensor.tap"] = info("sensor.tap", "Garden tap", { unit: "L", device_class: "water" });
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.tap"] = meter("sensor.tap", "total_increasing", "water");
    mock.responses["energy_flow_mapper/create_sum_meter"] = { entity_id: "sensor.garden", stat_rate: "sensor.garden_flow" };
    const el = await mount(mock);
    el.setTab("water");
    el._dialog = { kind: "actions", stat: "sensor.tap" };
    await settle(el);
    dialogButton(el, "Create sum meter").click();
    await settle(el);
    expect(dialogEl(el).textContent).toContain("“Garden tap Flow” adds up their flow");
    dialogButton(el, "Create").click();
    await settle(el);
    expect(lastCall(mock, "energy_flow_mapper/create_sum_meter")).toMatchObject({
      kind: "water",
      name: "Garden tap Water",
      entity_ids: ["sensor.tap"],
      rate_entity_ids: ["sensor.tap_flow"],
      rate_name: "Garden tap Flow",
    });
    expect(el._changes).toEqual([
      { type: "add", stat: "sensor.garden", parent: null, stat_rate: "sensor.garden_flow", kind: "water" },
      { type: "move", stat: "sensor.tap", parent: "sensor.garden", kind: "water" },
    ]);
    // An energy meter is not a water meter.
    el._dialog = { kind: "sum", group: null, origin: "sensor.tap", added: ["sensor.tap", "sensor.tv"], picking: false };
    mock.hass.states["sensor.tv"] = meter("sensor.tv");
    await settle(el);
    expect(dialogEl(el).querySelector('.sum-member[data-stat="sensor.tv"]')!.textContent).toContain(
      "Device class is not water",
    );
  });

  it("does not offer the meter's parent or devices above or below the sum", async () => {
    const el = await mount(mockHass());
    const offered = () => [...dialogEl(el).querySelectorAll<HTMLElement>("button.target")].map((b) => b.dataset.target);
    // From the amp: the server is the new meter's parent.
    el._dialog = { kind: "sum", group: null, origin: "sensor.sonos", added: ["sensor.sonos"], picking: true };
    await settle(el);
    expect(offered()).toEqual(["sensor.tv", "sensor.import", "sensor.export"]);
    // With the server in the sum, its amp is not offered.
    el._dialog = { kind: "sum", group: null, origin: "sensor.tv", added: ["sensor.tv", "sensor.server"], picking: true };
    await settle(el);
    expect(offered()).toEqual(["sensor.import", "sensor.export"]);
    // Nothing left to add.
    el._dialog = {
      kind: "sum",
      group: null,
      origin: "sensor.tv",
      added: ["sensor.tv", "sensor.server", "sensor.import", "sensor.export"],
      picking: true,
    };
    await settle(el);
    expect(dialogEl(el).textContent).toContain("No other sensor can be added.");
    // Removing every sensor leaves nothing to create.
    el._dialog = { kind: "sum", group: null, origin: "sensor.tv", added: [], picking: false };
    await settle(el);
    expect(dialogButton(el, "Create").disabled).toBe(true);
  });

  it("refuses a sum with an external statistic", async () => {
    const mock = mockHass();
    const snap = snapshot();
    snap.prefs.device_consumption.push({ stat_consumption: "portal:sub" });
    snap.stats["portal:sub"] = info("portal:sub", "Portal sub meter", { entity_id: null });
    snap.prefs.device_consumption.push({ stat_consumption: "sensor.boiler" });
    snap.stats["sensor.boiler"] = info("sensor.boiler", "Boiler");
    mock.responses["energy_flow_mapper/get"] = snap;
    mock.hass.states["sensor.tv"] = meter("sensor.tv");
    mock.hass.states["sensor.boiler"] = meter("sensor.boiler", "measurement");
    mock.responses["energy_flow_mapper/create_sum_meter"] = {
      translation_key: "sum_not_possible",
      translation_placeholders: { entity: "sensor.tv" },
    };
    const el = await mount(mock);
    el._dialog = { kind: "sum", group: null, origin: "sensor.tv", added: ["sensor.tv", "portal:sub"], picking: false };
    el._renameValue = "Sum";
    await settle(el);
    const external = dialogEl(el).querySelector('.sum-member[data-stat="portal:sub"]')!;
    expect(external.textContent).toContain("External statistic");
    expect(dialogButton(el, "Create").disabled).toBe(true);
    expect(dialogEl(el).textContent).toContain("cannot be summed");
    // Removed, it can be created; a sensor without a meter state class cannot.
    external.querySelector<HTMLButtonElement>("button.remove")!.click();
    await settle(el);
    expect(dialogButton(el, "Create").disabled).toBe(false);
    el._dialog = { kind: "sum", group: null, origin: "sensor.tv", added: ["sensor.tv", "sensor.boiler"], picking: false };
    await settle(el);
    expect(dialogEl(el).querySelector('.sum-member[data-stat="sensor.boiler"]')!.textContent).toContain(
      "State class is not total or total increasing",
    );
    expect(dialogButton(el, "Create").disabled).toBe(true);
    // Different meter state classes cannot be summed either.
    mock.hass.states["sensor.boiler"] = meter("sensor.boiler", "total");
    el.requestUpdate();
    await settle(el);
    expect(dialogEl(el).textContent).toContain("do not all have the same state class");
    expect(dialogButton(el, "Create").disabled).toBe(true);
    // The backend's refusal is shown as other errors are.
    el._dialog = { kind: "sum", group: null, origin: "sensor.tv", added: ["sensor.tv"], picking: false };
    await settle(el);
    dialogButton(el, "Create").click();
    await settle(el);
    expect(root(el).querySelector(".toast")!.textContent).toContain("sensor.tv cannot be summed");
    expect(el._changes).toEqual([]);
  });

  it("suggests groups from areas as one undo step", async () => {
    const mock = mockHass("de");
    const snap = snapshot();
    snap.prefs.device_consumption.push(
      { stat_consumption: "sensor.nas", included_in_stat: "sensor.server" },
      { stat_consumption: "sensor.lamp" },
    );
    snap.stats["sensor.nas"] = info("sensor.nas", "NAS", { area_name: "Rack" });
    snap.stats["sensor.sonos"] = info("sensor.sonos", "Sonos amp", { area_name: "Rack" });
    snap.stats["sensor.tv"] = info("sensor.tv", "TV backlight", { area_name: "Wohnzimmer" });
    snap.stats["sensor.lamp"] = info("sensor.lamp", "Lamp", { area_name: "Wohnzimmer" });
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    el._change({ type: "rename", stat: "sensor.tv", name: "Fernseher" });
    await settle(el);
    const before = mock.calls.filter((c) => c.type === "energy_flow_mapper/validate").length;
    buttonWith(el, "Gruppen aus Bereichen vorschlagen").click();
    await settle(el);
    expect(el._changes.slice(1)).toEqual([
      expect.objectContaining({ type: "create_group", name: "Wohnzimmer", parent: null, members: ["sensor.tv", "sensor.lamp"] }),
      expect.objectContaining({ type: "create_group", name: "Rack", parent: "sensor.server", members: ["sensor.sonos", "sensor.nas"] }),
    ]);
    expect(mock.calls.filter((c) => c.type === "energy_flow_mapper/validate")).toHaveLength(before + 1);
    expect(el._groups.map((g) => g.name).sort()).toEqual(["Rack", "Wohnzimmer"]);
    el._undoChange();
    await settle(el);
    expect(el._changes).toEqual([{ type: "rename", stat: "sensor.tv", name: "Fernseher" }]);
  });

  it("says when there is nothing to suggest", async () => {
    const el = await mount(mockHass());
    buttonWith(el, "Suggest groups from areas").click();
    await settle(el);
    expect(el._changes).toEqual([]);
    expect(root(el).querySelector(".toast")!.textContent).toContain("No groups to suggest");
    // Gas has no devices, so nothing to group there.
    el.setTab("gas");
    await settle(el);
    expect(() => buttonWith(el, "Suggest groups from areas")).toThrow();
  });

  it("takes back all applied suggestions as one step", async () => {
    const mock = groupMock();
    const snap = groupSnapshot();
    snap.child_pairs = [
      { kind: "electricity", stat: "sensor.tv", parent: "sensor.server" },
      { kind: "electricity", stat: "sensor.nas", parent: "sensor.tv" },
    ];
    mock.responses["energy_flow_mapper/get"] = snap;
    const el = await mount(mock);
    buttonWith(el, "Apply all suggestions").click();
    await settle(el);
    expect(el._changes).toHaveLength(2);
    el._undoChange();
    expect(el._changes).toEqual([]);
  });
});
