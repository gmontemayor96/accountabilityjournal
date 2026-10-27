import { describe, expect, it } from "vitest";
import { isUnsorted, quadrantOf } from "./matrix";

describe("eisenhower matrix", () => {
  it("places tasks by their two flags", () => {
    expect(quadrantOf({ important: true, urgent: true })).toBe("do");
    expect(quadrantOf({ important: true, urgent: false })).toBe("schedule");
    expect(quadrantOf({ important: false, urgent: true })).toBe("delegate");
    expect(quadrantOf({ important: false, urgent: false })).toBe("drop");
  });

  it("leaves tasks with no flags unsorted, and treats one missing flag as no", () => {
    expect(isUnsorted({})).toBe(true);
    expect(quadrantOf({ important: null, urgent: null })).toBeNull();
    expect(quadrantOf({ important: true })).toBe("schedule");
    expect(quadrantOf({ urgent: true, important: null })).toBe("delegate");
  });
});
