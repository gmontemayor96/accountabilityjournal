import { hasValue, type HabitType } from "./registry";

export const checkType: HabitType = {
  key: "check",
  label: "Yes / No",
  description: "A single tap marks it done.",
  usesTarget: false,
  isDone: (_habit, entry) => hasValue(entry),
  format: (_habit, entry) => (hasValue(entry) ? "done" : "—"),
  Input: ({ habit, value, onChange }) => {
    const on = !!value;
    return (
      <button
        type="button"
        className="toggle"
        aria-pressed={on}
        aria-label={`Mark ${habit.name} ${on ? "not done" : "done"}`}
        style={on ? { background: habit.color } : undefined}
        onClick={() => onChange(on ? null : 1)}
      >
        {on && (
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        )}
      </button>
    );
  },
};
