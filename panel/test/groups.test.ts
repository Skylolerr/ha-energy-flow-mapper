import { describe, expect, it, vi } from "vitest";

import { buildTree } from "../src/draft";
import {
  GROUP_PREFIX,
  applyAllChanges,
  applyGroupChanges,
  areaGroups,
  canGroup,
  cleanGroups,
  displayTree,
  groupBlockId,
  groupDevices,
  groupValue,
  newGroupId,
} from "../src/groups";
import type { Change, Device, Group, StatInfo } from "../src/types";

function dev(stat: string, parent: string | null = null): Device {
  return parent === null
    ? { stat_consumption: stat }
    : { stat_consumption: stat, included_in_stat: parent };
}

function grp(
  id: string,
  members: string[],
  parent: string | null = null,
  group: string | null = null,
): Group {
  return { id, name: id, parent, group, members };
}

// p under Home; a, b, c, d under p; e under Home.
function base(): Device[] {
  return [dev("p"), dev("a", "p"), dev("b", "p"), dev("c", "p"), dev("d", "p"), dev("e")];
}

function create(
  id: string,
  members: string[],
  parent: string | null = null,
  extra: Partial<Extract<Change, { type: "create_group" }>> = {},
): Change {
  return { type: "create_group", id, name: id, parent, members, groups: [], ...extra };
}

function named(id: string, name: string, members: string[], parent: string | null): Group {
  return { ...grp(id, members, parent), name };
}

function run(changes: Change[], stored: Group[] = []): Group[] {
  return applyGroupChanges(base(), stored, changes, "electricity");
}

function parentsOf(devices: Device[]): Record<string, string | null> {
  return Object.fromEntries(devices.map((d) => [d.stat_consumption, d.included_in_stat ?? null]));
}

describe("cleanGroups", () => {
  it("keeps a valid group and does not mutate its input", () => {
    const stored = [grp("g", ["b", "c"], "a")];
    const original = structuredClone(stored);
    const devices = [dev("a"), dev("b", "a"), dev("c", "a")];
    expect(cleanGroups(stored, devices)).toEqual(original);
    expect(stored).toEqual(original);
  });

  it("drops devices no longer in the list", () => {
    const cleaned = cleanGroups([grp("g", ["a", "b", "gone"])], [dev("a"), dev("b")]);
    expect(cleaned[0].members).toEqual(["a", "b"]);
  });

  it("adopts a new common parent", () => {
    const cleaned = cleanGroups([grp("g", ["b", "c"], "a")], [dev("p"), dev("b"), dev("c")]);
    expect(cleaned[0].parent).toBeNull();
    expect(cleaned[0].members).toEqual(["b", "c"]);
  });

  it("adopts the parent of nested devices too", () => {
    const cleaned = cleanGroups(
      [grp("outer", [], "a"), grp("inner", ["b"], "a", "outer")],
      [dev("b", "p"), dev("p")],
    );
    expect(cleaned.map((g) => g.parent)).toEqual(["p", "p"]);
    expect(cleaned[1].group).toBe("outer");
  });

  it("numbers a name taken at the adopted parent", () => {
    // The parent p was removed outside the mapper; a and b moved up to Home.
    const cleaned = cleanGroups(
      [named("home1", "Kitchen", ["e"], null), named("g1", "Kitchen", ["a", "b"], "p")],
      [dev("a"), dev("b"), dev("e")],
    );
    expect(cleaned.map((g) => [g.name, g.parent])).toEqual([
      ["Kitchen", null],
      ["Kitchen (2)", null],
    ]);
  });

  it("drops a member with another parent", () => {
    const devices = [dev("a"), dev("x"), dev("b", "a"), dev("c", "a"), dev("d", "x")];
    const cleaned = cleanGroups([grp("g", ["b", "c", "d"], "a")], devices);
    expect(cleaned[0].members).toEqual(["b", "c"]);
    expect(cleaned[0].parent).toBe("a");
  });

  it("moves a nested group with another parent to the top", () => {
    const devices = [dev("a"), dev("x"), dev("b", "a"), dev("c", "x")];
    const cleaned = cleanGroups(
      [grp("outer", ["b"], "a"), grp("inner", ["c"], "x", "outer")],
      devices,
    );
    expect(cleaned.map((g) => [g.id, g.group])).toEqual([
      ["outer", null],
      ["inner", null],
    ]);
  });

  it("keeps a nested group with the same parent", () => {
    const stored = [grp("outer", ["b"], "a"), grp("inner", ["c"], "a", "outer")];
    const devices = [dev("a"), dev("b", "a"), dev("c", "a")];
    expect(cleanGroups(stored, devices)).toEqual(stored);
  });

  it("removes groups without devices", () => {
    const stored = [
      grp("empty", ["gone"]),
      grp("outer", [], null),
      grp("inner", ["gone2"], null, "outer"),
      grp("ok", ["a"]),
    ];
    expect(cleanGroups(stored, [dev("a")]).map((g) => g.id)).toEqual(["ok"]);
  });

  it("keeps a device in its first group only", () => {
    const cleaned = cleanGroups([grp("one", ["a"]), grp("two", ["a", "b"])], [dev("a"), dev("b")]);
    expect(cleaned.map((g) => [g.id, g.members])).toEqual([
      ["one", ["a"]],
      ["two", ["b"]],
    ]);
  });

  it("makes an unknown enclosing group the top level", () => {
    const cleaned = cleanGroups([grp("g", ["a"], null, "missing")], [dev("a")]);
    expect(cleaned[0].group).toBeNull();
  });

  it("breaks looping enclosing groups", () => {
    const stored = [grp("a", ["x"], null, "b"), grp("b", ["y"], null, "a"), grp("c", ["z"], null, "c")];
    const cleaned = cleanGroups(stored, [dev("x"), dev("y"), dev("z")]);
    expect(cleaned.map((g) => g.group)).toEqual([null, "a", null]);
  });
});

describe("groupDevices", () => {
  it("includes the devices of nested groups", () => {
    const items = [
      grp("outer", ["a"]),
      grp("inner", ["b", "c"], null, "outer"),
      grp("deep", ["d"], null, "inner"),
      grp("other", ["e"]),
    ];
    expect(groupDevices(items, "outer")).toEqual(["a", "b", "c", "d"]);
    expect(groupDevices(items, "inner")).toEqual(["b", "c", "d"]);
    expect(groupDevices(items, "missing")).toEqual([]);
  });

  it("survives a loop", () => {
    const items = [grp("a", ["x"], null, "b"), grp("b", ["y"], null, "a")];
    expect(groupDevices(items, "a")).toEqual(["x", "y"]);
  });
});

describe("applyGroupChanges", () => {
  it("creates a group with a trimmed name", () => {
    expect(run([create("g", ["a", "b"], "p", { name: " Kitchen " })])).toEqual([
      { id: "g", name: "Kitchen", parent: "p", group: null, members: ["a", "b"] },
    ]);
  });

  it("takes members out of their previous group", () => {
    const result = run([create("g", ["a"], "p")], [grp("old", ["a", "b"], "p")]);
    const byId = Object.fromEntries(result.map((g) => [g.id, g]));
    expect(byId.old.members).toEqual(["b"]);
    expect(byId.g.members).toEqual(["a"]);
  });

  it("skips a group with members of other parents or unknown members", () => {
    expect(run([create("g", ["a", "e"], "p")])).toEqual([]);
    expect(run([create("g", ["zzz"], "p")])).toEqual([]);
  });

  it("nests groups into a new one", () => {
    const result = run([create("g", ["b"], "p", { groups: ["in"] })], [grp("in", ["a"], "p")]);
    const byId = Object.fromEntries(result.map((g) => [g.id, g]));
    expect(byId.in.group).toBe("g");
    expect(byId.g.group).toBeNull();
  });

  it("creates a group inside an enclosing group", () => {
    const result = run([create("g", ["b"], "p", { group: "out" })], [grp("out", ["a"], "p")]);
    expect(Object.fromEntries(result.map((g) => [g.id, g.group]))).toEqual({ out: null, g: "out" });
  });

  it("skips groups and an enclosing group of other parents", () => {
    const stored = [grp("top", ["e"], null)];
    expect(run([create("g", ["a"], "p", { groups: ["top"] })], stored)).toEqual(stored);
    expect(run([create("g", ["a"], "p", { group: "top" })], stored)).toEqual(stored);
  });

  it("skips a loop through the enclosing group", () => {
    const stored = [grp("in", ["a"], "p"), grp("deep", ["b"], "p", "in")];
    for (const enclosing of ["in", "deep"]) {
      expect(run([create("g", ["c"], "p", { groups: ["in"], group: enclosing })], stored)).toEqual(
        stored,
      );
    }
  });

  it("skips an id that exists", () => {
    const stored = [grp("g", ["a"], "p")];
    expect(run([create("g", ["b"], "p")], stored)).toEqual(stored);
  });

  it("checks names: not empty, unique below the parent, other parents are fine", () => {
    expect(run([create("g", ["a"], "p", { name: "  " })])).toEqual([]);
    const stored = [grp("one", ["a"], "p")];
    expect(run([create("g", ["b"], "p", { name: "one" })], stored)).toEqual(stored);
    expect(run([create("g", ["e"], null, { name: "one" })], stored)).toHaveLength(2);
    // The comparison is case-sensitive.
    expect(run([create("g", ["b"], "p", { name: "One" })], stored)).toHaveLength(2);
  });

  it("renames a group", () => {
    const stored = [grp("one", ["a"], "p"), grp("two", ["b"], "p")];
    expect(run([{ type: "rename_group", id: "one", name: " Neu " }], stored)[0].name).toBe("Neu");
    expect(run([{ type: "rename_group", id: "one", name: "" }], stored)[0].name).toBe("one");
    expect(run([{ type: "rename_group", id: "one", name: "two" }], stored)[0].name).toBe("one");
    // Keeping its own name is not a clash.
    expect(run([{ type: "rename_group", id: "one", name: "one" }], stored)[0].name).toBe("one");
  });

  it("puts a device in a group and out of it", () => {
    const stored = [grp("g", ["a"], "p"), grp("h", ["b"], "p")];
    const result = run(
      [
        { type: "set_group", stat: "c", group: "g" },
        { type: "set_group", stat: "a", group: null },
      ],
      stored,
    );
    const byId = Object.fromEntries(result.map((g) => [g.id, g]));
    expect(byId.g.members).toEqual(["c"]);
    expect(byId.h.members).toEqual(["b"]);
    // Moving between groups takes the device out of the old one; empty groups disappear.
    const moved = Object.fromEntries(
      run([{ type: "set_group", stat: "b", group: "g" }], stored).map((g) => [g.id, g]),
    );
    expect(moved.g.members).toEqual(["a", "b"]);
    expect(moved.h).toBeUndefined();
  });

  it("nests and unnests a group", () => {
    const stored = [grp("g", ["a"], "p"), grp("h", ["b"], "p")];
    const nested = run([{ type: "set_group", group_id: "h", group: "g" }], stored);
    expect(Object.fromEntries(nested.map((g) => [g.id, g.group]))).toEqual({ g: null, h: "g" });
    const out = run([{ type: "set_group", group_id: "h", group: null }], nested);
    expect(Object.fromEntries(out.map((g) => [g.id, g.group]))).toEqual({ g: null, h: null });
  });

  it("skips set_group across parents", () => {
    const stored = [grp("g", ["a"], "p"), grp("top", ["e"], null)];
    expect(run([{ type: "set_group", stat: "e", group: "g" }], stored)).toEqual(stored);
    expect(run([{ type: "set_group", group_id: "top", group: "g" }], stored)).toEqual(stored);
  });

  it("skips set_group that would make a loop", () => {
    const stored = [grp("g", ["a"], "p"), grp("h", ["b"], "p", "g")];
    for (const target of ["g", "h"]) {
      expect(run([{ type: "set_group", group_id: "g", group: target }], stored)).toEqual(stored);
    }
  });

  it("skips set_group without exactly one subject, or for an unknown device", () => {
    const stored = [grp("g", ["a"], "p")];
    expect(run([{ type: "set_group", group: "g" }], stored)).toEqual(stored);
    expect(run([{ type: "set_group", stat: "b", group_id: "g", group: "g" }], stored)).toEqual(
      stored,
    );
    expect(run([{ type: "set_group", stat: "zzz", group: null }], stored)).toEqual(stored);
  });

  it("dissolves a group and moves members up one level", () => {
    const stored = [
      grp("out", ["a"], "p"),
      grp("mid", ["b"], "p", "out"),
      grp("in", ["c"], "p", "mid"),
    ];
    const result = run([{ type: "dissolve_group", id: "mid" }], stored);
    const byId = Object.fromEntries(result.map((g) => [g.id, g]));
    expect(Object.keys(byId)).toEqual(["out", "in"]);
    expect(byId.out.members).toEqual(["a", "b"]);
    expect(byId.in.group).toBe("out");
    // A top-level group has no enclosing group: everything goes to the top.
    const top = applyGroupChanges(base(), result, [{ type: "dissolve_group", id: "out" }], "electricity");
    expect(top.map((g) => g.id)).toEqual(["in"]);
    expect(top[0].group).toBeNull();
  });

  it("dissolves a top-level group", () => {
    expect(run([{ type: "dissolve_group", id: "g" }], [grp("g", ["a"], "p")])).toEqual([]);
  });

  it("moves all devices and nested groups with move_group", () => {
    const stored = [grp("g", ["a"], "p"), grp("h", ["b"], "p", "g")];
    const { devices, groups } = applyAllChanges(
      base(),
      stored,
      [{ type: "move_group", id: "g", parent: "e" }],
      "electricity",
    );
    const parents = parentsOf(devices);
    expect(parents.a).toBe("e");
    expect(parents.b).toBe("e");
    expect(parents.c).toBe("p");
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.g.parent).toBe("e");
    expect(byId.h.parent).toBe("e");
    expect(byId.g.group).toBeNull();
    expect(byId.h.group).toBe("g");
  });

  it("moves a group to Home and into another group", () => {
    const stored = [grp("g", ["a"], "p"), grp("t", ["e"], null)];
    const { devices, groups } = applyAllChanges(
      base(),
      stored,
      [{ type: "move_group", id: "g", parent: null, group: "t" }],
      "electricity",
    );
    expect(parentsOf(devices).a).toBeNull();
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.g.parent).toBeNull();
    expect(byId.g.group).toBe("t");
  });

  it("moves a group to the top level of the new parent without a group", () => {
    const stored = [grp("o", ["b"], "p"), grp("g", ["a"], "p", "o")];
    const result = run([{ type: "move_group", id: "g", parent: "e" }], stored);
    expect(Object.fromEntries(result.map((g) => [g.id, g.group])).g).toBeNull();
  });

  it("skips move_group in the refused cases", () => {
    const stored = [grp("g", ["a"], "p"), grp("h", ["b"], "p", "g"), grp("x", ["c"], "p")];
    const cases: Extract<Change, { type: "move_group" }>[] = [
      { type: "move_group", id: "g", parent: "a" },
      { type: "move_group", id: "g", parent: "b" },
      { type: "move_group", id: "g", parent: "p", group: "g" },
      { type: "move_group", id: "g", parent: "p", group: "h" },
      { type: "move_group", id: "g", parent: "e", group: "x" },
      { type: "move_group", id: "g", parent: "zzz" },
    ];
    for (const change of cases) {
      const { devices, groups } = applyAllChanges(base(), stored, [change], "electricity");
      expect(groups).toEqual(stored);
      expect(devices).toEqual(base());
    }
  });

  it("skips move_group when the name is taken at the new parent", () => {
    const stored = [grp("g", ["a"], "p"), { ...grp("same", ["e"], null), name: "g" }];
    const { devices, groups } = applyAllChanges(
      base(),
      stored,
      [{ type: "move_group", id: "g", parent: null }],
      "electricity",
    );
    expect(groups).toEqual(stored);
    expect(devices).toEqual(base());
  });

  it("takes a device out of its group when it moves to another parent", () => {
    const stored = [grp("g", ["a", "b"], "p")];
    expect(run([{ type: "move", stat: "a", parent: "e" }], stored)[0].members).toEqual(["b"]);
    expect(run([{ type: "move", stat: "a", parent: "e" }], [grp("g", ["a"], "p")])).toEqual([]);
  });

  it("keeps a device in its group when it moves within the same parent", () => {
    const stored = [grp("g", ["a", "b"], "p")];
    expect(run([{ type: "move", stat: "a", parent: "p" }], stored)[0].members).toEqual(["a", "b"]);
  });

  it("keeps the groups below a removed parent", () => {
    const group = run([{ type: "remove", stat: "p" }], [grp("g", ["a", "b"], "p")])[0];
    expect(group.parent).toBeNull();
    expect(group.members).toEqual(["a", "b"]);
  });

  it("numbers names taken at the grandparent when a parent is removed", () => {
    const stored = [
      named("home1", "Kitchen", ["e"], null),
      named("home2", "Kitchen (2)", ["d"], "p"),
      named("g1", "Kitchen", ["a"], "p"),
      named("g2", "Kitchen (2)", ["b"], "p"),
      named("g3", "Office", ["c"], "p"),
    ];
    const result = run([{ type: "remove", stat: "p" }], stored);
    expect(result.map((g) => [g.name, g.parent])).toEqual([
      ["Kitchen", null],
      ["Kitchen (2)", null],
      ["Kitchen (3)", null],
      ["Kitchen (2) (2)", null],
      ["Office", null],
    ]);
  });

  it("trims names like groups.py", () => {
    // The same cases as test_group_names_are_trimmed_like_the_panel.
    const char = (code: number) => String.fromCharCode(code);
    const cases: [string, string][] = [
      [`${char(0xfeff)}Kitchen`, "Kitchen"],
      [`${char(0x3000)}Kitchen${char(0x2028)}`, "Kitchen"],
      [`${char(0x1c)}B`, `${char(0x1c)}B`],
      [char(0x1c), char(0x1c)],
      [`B${char(0x85)}`, `B${char(0x85)}`],
    ];
    for (const [name, expected] of cases) {
      expect(run([create("g", ["a"], "p", { name })])[0].name).toBe(expected);
    }
  });

  it("keeps the rest of a group when a member is removed", () => {
    expect(run([{ type: "remove", stat: "a" }], [grp("g", ["a", "b"], "p")])[0].members).toEqual([
      "b",
    ]);
  });

  it("does not touch electricity groups when another list loses a device", () => {
    const stored = [grp("g", ["a"], "p")];
    const result = applyGroupChanges(
      base(),
      stored,
      [{ type: "remove", stat: "p", kind: "water" }],
      "electricity",
    );
    expect(result).toEqual(stored);
  });

  it("keeps the groups below a device used as home meter", () => {
    const group = run([{ type: "use_as_home_meter", stat: "p" }], [grp("g", ["a", "b"], "p")])[0];
    expect(group.parent).toBeNull();
    expect(group.members).toEqual(["a", "b"]);
  });

  it("skips removing an unknown device", () => {
    const stored = [grp("g", ["a"], "p")];
    expect(run([{ type: "remove", stat: "zzz" }], stored)).toEqual(stored);
  });

  it("groups water devices", () => {
    const water = [dev("w1"), dev("w2")];
    const change = create("g", ["w1", "w2"], null, { kind: "water" });
    expect(applyGroupChanges(water, [], [change], "water")[0].members).toEqual(["w1", "w2"]);
    expect(applyGroupChanges(water, [], [change], "electricity")).toEqual([]);
  });

  it("skips unknown group ids", () => {
    const stored = [grp("g", ["a"], "p")];
    const changes: Change[] = [
      create("n", ["b"], "p", { groups: ["zzz"] }),
      create("n", ["b"], "p", { group: "zzz" }),
      { type: "rename_group", id: "zzz", name: "x" },
      { type: "set_group", group_id: "zzz", group: null },
      { type: "set_group", group_id: "g", group: "zzz" },
      { type: "set_group", stat: "b", group: "zzz" },
      { type: "dissolve_group", id: "zzz" },
      { type: "move_group", id: "zzz", parent: null },
    ];
    for (const change of changes) {
      expect(run([change], stored)).toEqual(stored);
    }
  });

  it("applies later changes after a skipped one", () => {
    const result = run([create("g", ["zzz"], "p"), create("h", ["a"], "p")]);
    expect(result.map((g) => g.id)).toEqual(["h"]);
  });

  it("leaves its inputs unchanged", () => {
    const stored = [grp("g", ["a", "b"], "p")];
    const devices = base();
    applyGroupChanges(
      devices,
      stored,
      [
        { type: "set_group", stat: "a", group: null },
        { type: "remove", stat: "p" },
      ],
      "electricity",
    );
    expect(devices).toEqual(base());
    expect(stored).toEqual([grp("g", ["a", "b"], "p")]);
  });

  it("passes other device changes through", () => {
    const stored = [grp("g", ["a"], "p")];
    const { devices, groups } = applyAllChanges(
      base(),
      stored,
      [{ type: "rename", stat: "a", name: "Lamp" }],
      "electricity",
    );
    expect(groups).toEqual(stored);
    expect(devices).toContainEqual({ stat_consumption: "a", included_in_stat: "p", name: "Lamp" });
  });

  it("ignores source changes", () => {
    const stored = [grp("g", ["a"], "p")];
    expect(run([{ type: "unassign_source", stat: "a" }], stored)).toEqual(stored);
  });
});

describe("displayTree", () => {
  it("builds the display tree with nested groups", () => {
    const devices = [
      dev("p"),
      dev("a", "p"),
      dev("b", "p"),
      dev("c", "p"),
      dev("d", "p"),
      dev("x", "a"),
      dev("e"),
    ];
    const groups = [grp("outer", ["b"], "p"), grp("inner", ["c", "d"], "p", "outer")];
    const tree = displayTree(buildTree(devices), groups);
    // Top level: p and e, no group at Home.
    expect(tree.map((n) => n.type)).toEqual(["device", "device"]);
    const p = tree[0];
    if (p.type !== "device") throw new Error("expected a device");
    // a first, then the group at the position of its first member (b).
    expect(p.children.map((n) => (n.type === "device" ? n.node.stat : `group:${n.group.id}`))).toEqual([
      "a",
      "group:outer",
    ]);
    const a = p.children[0];
    if (a.type !== "device") throw new Error("expected a device");
    expect(a.children.map((n) => (n.type === "device" ? n.node.stat : ""))).toEqual(["x"]);
    const outer = p.children[1];
    if (outer.type !== "group") throw new Error("expected a group");
    expect(
      outer.children.map((n) => (n.type === "device" ? n.node.stat : `group:${n.group.id}`)),
    ).toEqual(["b", "group:inner"]);
    const inner = outer.children[1];
    if (inner.type !== "group") throw new Error("expected a group");
    expect(inner.children.map((n) => (n.type === "device" ? n.node.stat : ""))).toEqual(["c", "d"]);
  });

  it("shows groups at Home and orders them by their first member", () => {
    const devices = [dev("a"), dev("b"), dev("c"), dev("d")];
    const tree = displayTree(buildTree(devices), [grp("late", ["c", "d"]), grp("early", ["a"])]);
    expect(tree.map((n) => (n.type === "device" ? n.node.stat : `group:${n.group.id}`))).toEqual([
      "group:early",
      "b",
      "group:late",
    ]);
  });

  it("shows every device once, also when the groups are damaged", () => {
    const devices = [dev("a"), dev("b")];
    const tree = displayTree(buildTree(devices), [
      grp("one", ["a", "missing"]),
      grp("two", ["a"]),
      grp("loose", ["b"], null, "gone"),
    ]);
    const stats: string[] = [];
    const collect = (nodes: typeof tree): void => {
      for (const n of nodes) {
        if (n.type === "device") stats.push(n.node.stat);
        collect(n.children);
      }
    };
    collect(tree);
    expect(stats.sort()).toEqual(["a", "b"]);
  });
});

describe("groupValue", () => {
  it("sums the direct children of a group, skipping unknown values", () => {
    const devices = [dev("a"), dev("b"), dev("c"), dev("d")];
    const groups = [grp("outer", ["a", "b"]), grp("inner", ["c", "d"], null, "outer")];
    const tree = displayTree(buildTree(devices), groups);
    const outer = tree[0];
    const values = new Map<string, number | null>([
      ["a", 1],
      ["b", null],
      ["c", 2],
      ["d", 3],
    ]);
    expect(groupValue(outer, values)).toBe(6);
    if (outer.type !== "group") throw new Error("expected a group");
    expect(groupValue(outer.children[2], values)).toBe(5);
    expect(groupValue(outer, new Map([["x", 1]]))).toBeNull();
    // A device node gives its own value.
    expect(groupValue(outer.children[0], values)).toBe(1);
    expect(groupValue(outer.children[1], values)).toBeNull();
  });

  it("does not count the children of a device in a group", () => {
    const devices = [dev("a"), dev("x", "a")];
    const tree = displayTree(buildTree(devices), [grp("g", ["a"])]);
    expect(groupValue(tree[0], new Map([["a", 4], ["x", 1]]))).toBe(4);
  });
});

describe("canGroup", () => {
  it("allows grouping only with the same parent", () => {
    const devices = base();
    const groups = [grp("g", ["a"], "p"), grp("top", ["e"], null)];
    expect(canGroup(devices, groups, ["a", "b"])).toBe(true);
    expect(canGroup(devices, groups, ["b", `${GROUP_PREFIX}g`])).toBe(true);
    expect(canGroup(devices, groups, ["a", "e"])).toBe(false);
    expect(canGroup(devices, groups, ["b", `${GROUP_PREFIX}top`])).toBe(false);
    expect(canGroup(devices, groups, ["p", "e"])).toBe(true);
    expect(canGroup(devices, groups, [])).toBe(false);
    expect(canGroup(devices, groups, ["zzz"])).toBe(false);
    expect(canGroup(devices, groups, [`${GROUP_PREFIX}zzz`])).toBe(false);
  });
});

describe("areaGroups", () => {
  function info(stat: string, area: string | null): StatInfo {
    return {
      stat,
      entity_id: stat,
      name: stat,
      unit: null,
      device_class: null,
      device_id: null,
      device_name: null,
      area_id: area,
      area_name: area,
      floor_id: null,
      floor_name: null,
    };
  }

  it("suggests one group per parent and area with two or more children", () => {
    const devices = [
      dev("p"),
      dev("a", "p"),
      dev("b", "p"),
      dev("c", "p"),
      dev("d", "p"),
      dev("e"),
      dev("f"),
      dev("g"),
    ];
    const stats = {
      a: info("a", "Kitchen"),
      b: info("b", "Kitchen"),
      c: info("c", "Hall"),
      d: info("d", null),
      e: info("e", "Kitchen"),
      f: info("f", "Kitchen"),
      g: info("g", "Garage"),
    };
    const changes = areaGroups(devices, [], stats, (area) => `Area ${area}`);
    expect(changes).toHaveLength(2);
    const [home, kitchen] = changes as Extract<Change, { type: "create_group" }>[];
    expect(kitchen).toMatchObject({
      type: "create_group",
      name: "Area Kitchen",
      parent: "p",
      members: ["a", "b"],
      groups: [],
    });
    expect(home).toMatchObject({ name: "Area Kitchen", parent: null, members: ["e", "f"] });
    expect(kitchen.id).toMatch(/^[0-9a-f]{32}$/);
    expect(kitchen.id).not.toBe(home.id);
  });

  it("leaves out devices that are in a group already, and names that are taken", () => {
    const devices = [dev("a"), dev("b"), dev("c"), dev("d")];
    const stats = {
      a: info("a", "Kitchen"),
      b: info("b", "Kitchen"),
      c: info("c", "Hall"),
      d: info("d", "Hall"),
    };
    const groups = [grp("g", ["a"]), { ...grp("h", ["c"]), name: "Hall" }];
    expect(areaGroups(devices, groups, stats, (area) => area)).toEqual([]);
    const free = areaGroups(devices, [grp("g", ["a"])], stats, (area) => area);
    expect(free).toHaveLength(1);
    expect(free[0]).toMatchObject({ name: "Hall", members: ["c", "d"] });
  });

  it("names the list of the change for water", () => {
    const devices = [dev("a"), dev("b")];
    const stats = { a: info("a", "Bath"), b: info("b", "Bath") };
    const [change] = areaGroups(devices, [], stats, (area) => area, "water");
    expect(change).toMatchObject({ kind: "water", members: ["a", "b"] });
  });
});

describe("ids", () => {
  it("builds block ids", () => {
    expect(GROUP_PREFIX).toBe("group:");
    expect(groupBlockId("abc")).toBe("group:abc");
  });
});

describe("newGroupId", () => {
  it("makes 32 hex characters, different each time", () => {
    const one = newGroupId();
    expect(one).toMatch(/^[0-9a-f]{32}$/);
    expect(newGroupId()).not.toBe(one);
    // Version 4 and variant bits.
    expect(one[12]).toBe("4");
    expect("89ab").toContain(one[16]);
  });

  it("works without crypto.randomUUID (no secure context)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      expect(newGroupId()).toMatch(/^[0-9a-f]{32}$/);
      const devices = [dev("a"), dev("b")];
      const stats = {
        a: { area_name: "Bath" },
        b: { area_name: "Bath" },
      } as unknown as Record<string, StatInfo>;
      const [change] = areaGroups(devices, [], stats, (area) => area);
      expect((change as { id: string }).id).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
