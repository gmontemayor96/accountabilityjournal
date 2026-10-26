import { useEffect, useState } from "react";
import { HabitEditor } from "./components/HabitEditor";
import { Icons } from "./components/Icons";
import { isDesktopApp } from "./data";
import type { Habit } from "./domain/model";
import { DayScreen } from "./screens/DayScreen";
import { HabitsScreen } from "./screens/HabitsScreen";
import { ComingSoon } from "./screens/ComingSoon";
import { blankHabit, useStore, type View } from "./store";

const NAV: { view: View; label: string; icon: keyof typeof Icons }[] = [
  { view: "day", label: "Today", icon: "day" },
  { view: "habits", label: "Habits", icon: "habits" },
  { view: "calendar", label: "Calendar", icon: "calendar" },
  { view: "journal", label: "Journal", icon: "journal" },
  { view: "tags", label: "Tags", icon: "tags" },
];

export default function App() {
  const { status, error, view, setView, init, habits } = useStore();
  const [editing, setEditing] = useState<Habit | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  const openEditor = (habit?: Habit) => setEditing(habit ?? blankHabit(habits));

  return (
    <div className="app">
      <nav className="rail" aria-label="Sections">
        <div className="brand">
          Identity<small>Habit tracker</small>
        </div>
        {NAV.map((n) => (
          <button key={n.view} className="nav" aria-current={view === n.view ? "page" : undefined} onClick={() => setView(n.view)}>
            {Icons[n.icon]}
            {n.label}
          </button>
        ))}
        <div className="spacer" />
        {!isDesktopApp && <p className="foot">Browser preview with example habits. Data stays in this browser.</p>}
      </nav>
      <main className="main">
        {status === "loading" && <p className="empty pad">Opening your journal…</p>}
        {status === "error" && (
          <div className="pad">
            <h1>Couldn't open your data</h1>
            <p className="empty">{error}</p>
          </div>
        )}
        {status === "ready" && view === "day" && <DayScreen onEditHabit={openEditor} />}
        {status === "ready" && view === "habits" && <HabitsScreen onEditHabit={openEditor} />}
        {status === "ready" && (view === "calendar" || view === "journal" || view === "tags") && <ComingSoon view={view} />}
      </main>
      {editing && <HabitEditor habit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
