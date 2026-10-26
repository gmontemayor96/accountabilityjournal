import { describe, expect, it } from "vitest";
import type { Task } from "../domain/model";
import { dueReminders, notificationId, reminderFor, reminderKey, sentKey } from "./reminders";

const task = (over: Partial<Task>): Task => ({
  id: "t", title: "T", notes: "", dueDate: "2026-10-27", dueTime: "09:00", remindAt: null, doneAt: null, createdAt: "", tags: [], ...over,
});

describe("reminders", () => {
  it("derives reminder times from the due date and time", () => {
    expect(reminderFor("at", "2026-10-27", "09:00")).toBe("2026-10-27T09:00");
    expect(reminderFor("15m", "2026-10-27", "00:10")).toBe("2026-10-26T23:55");
    expect(reminderFor("1d", "2026-10-27", null)).toBe("2026-10-26T09:00");
    expect(reminderFor("1h", null, null)).toBeNull();
    expect(reminderKey(task({ remindAt: "2026-10-27T08:00" }))).toBe("1h");
    expect(reminderKey(task({ remindAt: "2026-10-27T07:12" }))).toBe("custom");
  });

  it("finds reminders that are due, not done, not shown, and under a day old", () => {
    const now = new Date(2026, 9, 27, 9, 0);
    const tasks = [
      task({ id: "due", remindAt: "2026-10-27T08:59" }),
      task({ id: "later", remindAt: "2026-10-27T09:01" }),
      task({ id: "done", remindAt: "2026-10-27T08:00", doneAt: "x" }),
      task({ id: "stale", remindAt: "2026-10-25T08:00" }),
      task({ id: "shown", remindAt: "2026-10-27T08:30" }),
    ];
    const sent = new Set([sentKey(tasks[4])]);
    expect(dueReminders(tasks, now, sent).map((t) => t.id)).toEqual(["due"]);
  });

  it("makes stable positive notification ids", () => {
    expect(notificationId("t_abc")).toBe(notificationId("t_abc"));
    expect(notificationId("t_abc")).toBeGreaterThan(0);
    expect(notificationId("t_abc")).not.toBe(notificationId("t_abd"));
  });
});
