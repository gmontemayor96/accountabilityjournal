import { hasValue, type HabitType } from "./registry";

export const scaleType: HabitType = {
  key: "scale",
  label: "Scale 1–5",
  description: "Rate it 1 to 5. Good for energy, focus or sleep quality.",
  usesTarget: false,
  isDone: (_habit, entry) => hasValue(entry),
  format: (_habit, entry) => (hasValue(entry) ? `${entry.value} / 5` : "—"),
  Input: ({ habit, value, onChange }) => (
    <div className="pips" role="group" aria-label={`${habit.name} rating`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          style={value === n ? { background: habit.color } : undefined}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
    </div>
  ),
};
