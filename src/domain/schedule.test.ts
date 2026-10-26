import { describe, expect, it } from "vitest";
import { addDays, longDate, parseKey, toKey } from "./dates";
import { describeSchedule, isDue, normalizeSchedule } from "./schedule";

describe("dates", () => {
  it("round-trips local calendar dates", () => {
    expect(toKey(parseKey("2026-10-15"))).toBe("2026-10-15");
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("formats a long date", () => {
    expect(longDate("2026-10-15")).toBe("Thu, Oct 15");
  });
});

describe("schedule", () => {
  it("is due every day for daily and per-week habits", () => {
    expect(isDue({ kind: "daily" }, "2026-10-18")).toBe(true);
    expect(isDue({ kind: "perWeek", n: 3 }, "2026-10-18")).toBe(true);
  });
  it("is due only on chosen weekdays", () => {
    const s = { kind: "weekdays" as const, days: [1, 3] }; // Mon, Wed
    expect(isDue(s, "2026-10-19")).toBe(true); // Monday
    expect(isDue(s, "2026-10-20")).toBe(false); // Tuesday
  });
  it("describes schedules in plain words, Monday first", () => {
    expect(describeSchedule({ kind: "weekdays", days: [5, 4, 3, 2, 1] })).toBe("Weekdays");
    expect(describeSchedule({ kind: "weekdays", days: [0, 1, 6] })).toBe("Mon · Sat · Sun");
    expect(describeSchedule({ kind: "perWeek", n: 3 })).toBe("3× per week");
  });
  it("normalizes empty day lists and out-of-range per-week counts", () => {
    expect(normalizeSchedule({ kind: "weekdays", days: [] })).toEqual({ kind: "daily" });
    expect(normalizeSchedule({ kind: "perWeek", n: 12 })).toEqual({ kind: "perWeek", n: 7 });
  });
});
