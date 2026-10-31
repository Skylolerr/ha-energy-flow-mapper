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

  it("offers assigning on solar and battery blocks and nothing on gas", async () => {
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
    root(el).querySelector<HTMLButtonElement>('.block.source[data-role="gas"]')!.click();
    await settle(el);
    const dialog = root(el).querySelector("dialog")!.textContent!;
    expect(dialog).toContain("Gas");
    expect(dialog).not.toContain("Assign sensor");
    expect(dialog).not.toContain("Remove as source");
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
      "Its devices use more than this device",
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
