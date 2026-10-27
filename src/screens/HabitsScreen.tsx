import { Icons } from "../components/Icons";
import type { Habit } from "../domain/model";
import { describeSchedule } from "../domain/schedule";
import { describeStreak } from "../domain/streaks";
import { getHabitType } from "../habitTypes";
import { useStreaks } from "../hooks/useStreaks";
import { useStore } from "../store";

export function HabitsScreen({ onEditHabit }: { onEditHabit: (h?: Habit) => void }) {
  const { habits, tags, setArchived } = useStore();
  const streaks = useStreaks();
  const active = habits.filter((h) => !h.archivedAt);
  const archived = habits.filter((h) => h.archivedAt);
  const tag = (id: string) => tags.find((t) => t.id === id);

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Habits</h1>
          <div className="sub">Each habit is a module: a type, a schedule, tags and any extra fields you want to log.</div>
        </div>
        <div className="tools">
          <button className="btn primary" onClick={() => onEditHabit()}>+ New habit</button>
        </div>
      </header>
      <section className="canvas">
        {active.length === 0 && <p className="empty">No habits yet. Add one to start tracking.</p>}
        <div className="hgrid">
          {active.map((h) => {
            const type = getHabitType(h.type);
            return (
              <article key={h.id} className="hcard">
                <div className="h">
                  <span className="dot big" style={{ background: h.color }} />
                  <span className="name">{h.name}</span>
                  <button className="iconbtn" aria-label={`Edit ${h.name}`} onClick={() => onEditHabit(h)}>{Icons.edit}</button>
                </div>
                {h.identity && <div className="identity">“{h.identity}”</div>}
                <div className="inline">
                  <span className="badge">{type.label}{h.target ? ` · ${h.target} ${h.unit}` : ""}</span>
                  <span className="badge">{describeSchedule(h.schedule)}</span>
                  {!!h.reminders?.length && <span className="badge" title="Reminders">{Icons.bell} {h.reminders.join(", ")}</span>}
                  {h.tags.map((id) => tag(id)).filter(Boolean).map((t) => (
                    <span key={t!.id} className="chip"><span className="dot" style={{ background: t!.color }} />{t!.name}</span>
                  ))}
                </div>
                {streaks[h.id] && <div className="hint">Streak: {describeStreak(streaks[h.id])}</div>}
                {h.fields.length > 0 && <div className="hint">Also logs: {h.fields.map((f) => f.label).join(", ")}</div>}
              </article>
            );
          })}
        </div>
        {archived.length > 0 && (
          <div className="archived">
            <h3>Archived</h3>
            <p className="hint">Archived habits are hidden from Today but keep their history.</p>
            {archived.map((h) => (
              <div key={h.id} className="inline">
                <span className="dot" style={{ background: h.color }} />
                {h.name}
                <button className="linkbtn" onClick={() => setArchived(h.id, false)}>Restore</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
