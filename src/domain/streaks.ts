import { getHabitType } from "../habitTypes/registry";
import { addDays, parseKey } from "./dates";
import type { Habit, HabitEntry } from "./model";
import { isDue } from "./schedule";

export interface Streak {
  current: number;
  best: number;
  /** Per-week habits count weeks that met their target; the others count due days done in a row. */
  unit: "day" | "week";
}

/** The Monday that starts the week holding `date`. */
export const weekStart = (date: string) => addDays(date, -((parseKey(date).getDay() + 6) % 7));

/**
 * Streaks for one habit up to `today`. `byDate` maps date -> habit id -> entry. Today (or this
 * week, for per-week habits) adds to the streak once done, but never breaks it while still open.
 * Days the habit isn't due are skipped, so a Mon/Wed/Fri habit keeps its streak over Tuesday.
 */
export function habitStreak(habit: Habit, byDate: Record<string, Record<string, HabitEntry>>, today: string): Streak {
  const type = getHabitType(habit.type);
  const doneOn = (date: string) => type.isDone(habit, byDate[date]?.[habit.id]);
  const logged = Object.keys(byDate).filter((d) => d <= today && byDate[d][habit.id]).sort();
  if (!logged.length) return { current: 0, best: 0, unit: habit.schedule.kind === "perWeek" ? "week" : "day" };
  const first = logged[0];

  if (habit.schedule.kind === "perWeek") {
    const n = habit.schedule.n;
    const thisWeek = weekStart(today);
    const metWeek = (monday: string) => {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(monday, i);
        if (d <= today && doneOn(d)) count++;
      }
      return count >= n;
    };
    let run = 0, best = 0, current = 0;
    for (let w = weekStart(first); w <= thisWeek; w = addDays(w, 7)) {
      const met = metWeek(w);
      if (met) run++;
      else if (w !== thisWeek) run = 0;
      best = Math.max(best, run);
      current = run;
    }
    return { current, best, unit: "week" };
  }

  let run = 0, best = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (!isDue(habit.schedule, d)) continue;
    if (doneOn(d)) run++;
    else if (d !== today) run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best, unit: "day" };
}

export function describeStreak(s: Streak): string {
  const unit = (n: number) => `${n} ${s.unit}${n === 1 ? "" : "s"}`;
  return `${unit(s.current)} in a row · best ${unit(s.best)}`;
}
