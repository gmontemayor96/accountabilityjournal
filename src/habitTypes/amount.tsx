import type { Habit } from "../domain/model";
import { hasValue, type HabitInputProps, type HabitType } from "./registry";

/** Step size for the +/- buttons, scaled to the target so big targets are not tedious. */
export function stepFor(habit: Habit): number {
  if (habit.type === "duration") return 5;
  const t = habit.target ?? 1;
  if (t >= 100) return 50;
  if (t >= 20) return 5;
  return 1;
}

function Stepper({ habit, value, onChange }: HabitInputProps) {
  const step = stepFor(habit);
  const v = value ?? 0;
  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${habit.name}`} onClick={() => onChange(Math.max(0, v - step) || null)}>
        −
      </button>
      <input
        type="number"
        min={0}
        aria-label={`${habit.name} amount`}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
      />
      <span className="unit">
        / {habit.target ?? 0} {habit.unit}
      </span>
      <button type="button" aria-label={`Increase ${habit.name}`} onClick={() => onChange(v + step)}>
        +
      </button>
    </div>
  );
}

const reachedTarget = (habit: Habit, value: number) => value >= (habit.target ?? 1);
const formatAmount = (habit: Habit, value: number) => `${value} / ${habit.target ?? 0} ${habit.unit}`.trim();

export const countType: HabitType = {
  key: "count",
  label: "Count",
  description: "Counts up toward a target. Done when you reach it.",
  usesTarget: true,
  defaultTarget: 1,
  isDone: (habit, entry) => hasValue(entry) && reachedTarget(habit, entry.value!),
  format: (habit, entry) => (hasValue(entry) ? formatAmount(habit, entry.value!) : "—"),
  Input: Stepper,
};

export const durationType: HabitType = {
  key: "duration",
  label: "Duration",
  description: "Minutes toward a target. Done when you reach it.",
  usesTarget: true,
  defaultTarget: 20,
  defaultUnit: "min",
  isDone: (habit, entry) => hasValue(entry) && reachedTarget(habit, entry.value!),
  format: (habit, entry) => (hasValue(entry) ? formatAmount(habit, entry.value!) : "—"),
  Input: Stepper,
};
