import { describe, expect, it } from "vitest";
import { applyOrder, moveId, nextOrder } from "./order";

const items = (...ids: string[]) => ids.map((id) => ({ id, sortOrder: 0 }));

describe("order", () => {
  it("moves an id to another's place, either direction", () => {
    expect(moveId(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveId(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveId(["a", "b"], "a", "x")).toEqual(["a", "b"]);
  });

  it("reorders a group inside the places it already held, leaving the rest alone", () => {
    // b and d are one group on screen (say, one bucket); swap them.
    const { list, changed } = applyOrder(items("a", "b", "c", "d"), ["d", "b"]);
    expect(list.map((x) => x.id)).toEqual(["a", "d", "c", "b"]);
    expect(list.map((x) => x.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(changed.map((x) => x.id)).toEqual(["d", "c", "b"]);
  });

  it("saves only what changed once the list is numbered", () => {
    const start = [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 1 }, { id: "c", sortOrder: 2 }];
    const { changed } = applyOrder(start, ["b", "a"]);
    expect(changed).toEqual([{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }]);
    expect(applyOrder(start, ["a", "b", "c"]).changed).toEqual([]);
  });

  it("puts new items after everything", () => {
    expect(nextOrder([{ id: "a", sortOrder: 4 }, { id: "b" }])).toBe(5);
    expect(nextOrder([])).toBe(0);
  });
});
