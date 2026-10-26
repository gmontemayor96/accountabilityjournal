import type { Goal, Horizon, Task } from "./model";

export const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "day", label: "1 day" },
  { key: "week", label: "1 week" },
  { key: "month", label: "1 month" },
  { key: "year", label: "1 year" },
  { key: "5y", label: "5 years" },
  { key: "10y", label: "10 years" },
];

const rank = (h: Horizon) => HORIZONS.findIndex((x) => x.key === h);
export const horizonLabel = (h: Horizon) => HORIZONS[rank(h)]?.label ?? h;

export interface Progress {
  /** 0..1 */
  pct: number;
  done: boolean;
  subgoals: { done: number; total: number };
  tasks: { done: number; total: number };
}

/**
 * A goal's progress. With no subgoals or linked tasks it is all or nothing, by its own tick.
 * Otherwise each subgoal and each task counts as one step, a subgoal by its own progress, and
 * the goal is done once every step is.
 */
export function goalProgress(goal: Goal, goals: Goal[], tasks: Task[], seen = new Set<string>()): Progress {
  seen.add(goal.id);
  const subs = goals.filter((g) => g.parentId === goal.id && !seen.has(g.id));
  const linked = tasks.filter((t) => t.goalId === goal.id);
  const subProgress = subs.map((g) => goalProgress(g, goals, tasks, seen));
  const steps = subProgress.length + linked.length;
  const tasksDone = linked.filter((t) => t.doneAt).length;
  const pct = steps === 0
    ? (goal.doneAt ? 1 : 0)
    : (subProgress.reduce((n, p) => n + p.pct, 0) + tasksDone) / steps;
  return {
    pct,
    done: pct >= 1,
    subgoals: { done: subProgress.filter((p) => p.done).length, total: subs.length },
    tasks: { done: tasksDone, total: linked.length },
  };
}

/** Goals this one can be a step toward: the same area, a longer horizon, and not one of its own subgoals. */
export function parentOptions(goal: Pick<Goal, "id" | "areaId" | "horizon">, goals: Goal[]): Goal[] {
  const below = new Set<string>([goal.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of goals) if (g.parentId && below.has(g.parentId) && !below.has(g.id)) { below.add(g.id); grew = true; }
  }
  return goals
    .filter((g) => g.areaId === goal.areaId && rank(g.horizon) > rank(goal.horizon) && !below.has(g.id))
    .sort((a, b) => rank(a.horizon) - rank(b.horizon) || a.title.localeCompare(b.title));
}

/** The chain of goals above this one, nearest first. */
export function ancestors(goal: Goal, goals: Goal[]): Goal[] {
  const out: Goal[] = [];
  const seen = new Set([goal.id]);
  let cur = goal.parentId ? goals.find((g) => g.id === goal.parentId) : undefined;
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = cur.parentId ? goals.find((g) => g.id === cur!.parentId) : undefined;
  }
  return out;
}

export const pctLabel = (p: number) => `${Math.round(p * 100)}%`;
