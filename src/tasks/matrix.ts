import type { Task } from "../domain/model";

/** The four boxes of the Eisenhower matrix. */
export type Quadrant = "do" | "schedule" | "delegate" | "drop";

export const QUADRANTS: { key: Quadrant; title: string; sub: string; important: boolean; urgent: boolean }[] = [
  { key: "do", title: "Do first", sub: "Urgent and important", important: true, urgent: true },
  { key: "schedule", title: "Schedule", sub: "Important, not urgent", important: true, urgent: false },
  { key: "delegate", title: "Delegate", sub: "Urgent, not important", important: false, urgent: true },
  { key: "drop", title: "Drop", sub: "Neither urgent nor important", important: false, urgent: false },
];

/** Not placed in the matrix yet: neither flag has been set. */
export const isUnsorted = (t: Pick<Task, "important" | "urgent">) => t.important == null && t.urgent == null;

/** The box a task is in; a task with only one flag set counts the other as no. Null when unsorted. */
export function quadrantOf(t: Pick<Task, "important" | "urgent">): Quadrant | null {
  if (isUnsorted(t)) return null;
  return QUADRANTS.find((q) => q.important === !!t.important && q.urgent === !!t.urgent)!.key;
}

export const quadrantInfo = (key: Quadrant) => QUADRANTS.find((q) => q.key === key)!;
