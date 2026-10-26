import { addDays, longDate, todayKey } from "../domain/dates";
import type { Task } from "../domain/model";

/** "Today", "Tomorrow", "Yesterday" or "Wed, Oct 28", plus the time when there is one. */
export function dueLabel(t: Pick<Task, "dueDate" | "dueTime">, today = todayKey()): string {
  if (!t.dueDate) return "";
  const day =
    t.dueDate === today ? "Today" : t.dueDate === addDays(today, 1) ? "Tomorrow" : t.dueDate === addDays(today, -1) ? "Yesterday" : longDate(t.dueDate);
  return t.dueTime ? `${day} ${t.dueTime}` : day;
}

export type TaskGroup = "overdue" | "today" | "upcoming" | "someday" | "done";

export function groupOf(t: Task, today = todayKey()): TaskGroup {
  if (t.doneAt) return "done";
  if (!t.dueDate) return "someday";
  if (t.dueDate < today) return "overdue";
  return t.dueDate === today ? "today" : "upcoming";
}

/** Open tasks due on `date`; on today, overdue ones too. */
export function tasksForDay(tasks: Task[], date: string, today = todayKey()): Task[] {
  return tasks.filter((t) => t.dueDate === date || (date === today && !t.doneAt && t.dueDate !== null && t.dueDate < today));
}
