import { describe, expect, it } from "vitest";
import type { Task } from "../domain/model";
import { eventFingerprint, eventIdFor, eventsOn, eventTimeLabel, fromGoogle, planPush, taskToEvent } from "./events";

const task = (over: Partial<Task>): Task => ({
  id: "t_1", title: "Dentist", notes: "", dueDate: "2026-10-27", dueTime: null, remindAt: null, doneAt: null, createdAt: "", tags: [], ...over,
});

describe("Google events", () => {
  it("reads all-day events with Google's exclusive end date", () => {
    expect(fromGoogle({ id: "a", summary: "Trip", start: { date: "2026-10-30" }, end: { date: "2026-11-02" } }))
      .toEqual({ id: "a", title: "Trip", startDate: "2026-10-30", startTime: null, endDate: "2026-11-01", endTime: null });
    expect(fromGoogle({ id: "b", status: "cancelled", start: { date: "2026-10-30" }, end: { date: "2026-10-31" } })).toBeNull();
  });

  it("reads timed events in local time", () => {
    const s = new Date(2026, 9, 27, 14, 0), e = new Date(2026, 9, 27, 15, 30);
    const ev = fromGoogle({ id: "c", start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() } })!;
    expect(ev).toEqual({ id: "c", title: "(No title)", startDate: "2026-10-27", startTime: "14:00", endDate: "2026-10-27", endTime: "15:30" });
    expect(eventTimeLabel(ev, "2026-10-27")).toBe("14:00–15:30");
  });

  it("lists events covering a date, all-day first", () => {
    const evs = [
      { id: "1", title: "Lunch", startDate: "2026-10-31", startTime: "12:00", endDate: "2026-10-31", endTime: "13:00" },
      { id: "2", title: "Trip", startDate: "2026-10-30", startTime: null, endDate: "2026-11-01", endTime: null },
    ];
    expect(eventsOn(evs, "2026-10-31").map((e) => e.id)).toEqual(["2", "1"]);
    expect(eventsOn(evs, "2026-11-02")).toEqual([]);
  });

  it("makes valid, stable event ids from task ids", () => {
    const id = eventIdFor("t_ab12");
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFor("t_ab12")).toBe(id);
  });

  it("turns tasks into all-day or 30-minute events", () => {
    expect(taskToEvent(task({}), "Europe/London")).toMatchObject({ start: { date: "2026-10-27" }, end: { date: "2026-10-28" }, summary: "Dentist" });
    expect(taskToEvent(task({ dueTime: "23:45", doneAt: "x" }), "Europe/London")).toMatchObject({
      summary: "✓ Dentist",
      start: { dateTime: "2026-10-27T23:45:00", timeZone: "Europe/London" },
      end: { dateTime: "2026-10-28T00:15:00" },
    });
    expect(taskToEvent(task({ dueDate: null }), "UTC")).toBeNull();
  });

  it("pushes only changed dated tasks and removes events for gone ones", () => {
    const a = task({ id: "a" }), b = task({ id: "b", title: "Changed" }), c = task({ id: "c", dueDate: null });
    const pushed = { a: eventFingerprint(a), b: "old", c: "old", d: "old" };
    const plan = planPush([a, b, c], pushed);
    expect(plan.upsert.map((t) => t.id)).toEqual(["b"]);
    expect(plan.remove.sort()).toEqual(["c", "d"]);
  });
});
