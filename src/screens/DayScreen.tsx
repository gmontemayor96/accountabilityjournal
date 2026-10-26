import { useState } from "react";
import { Icons } from "../components/Icons";
import { TagPicker } from "../components/TagPicker";
import { addDays, longDate, todayKey } from "../domain/dates";
import { MOODS, type Habit } from "../domain/model";
import { describeSchedule, isDue } from "../domain/schedule";
import { getHabitType } from "../habitTypes";
import { useStore } from "../store";

function HabitRow({ habit, onEdit }: { habit: Habit; onEdit: (h: Habit) => void }) {
  const entry = useStore((s) => s.entries[habit.id]);
  const { logValue, setEntryNote, setEntryField } = useStore();
  const [open, setOpen] = useState(false);
  const type = getHabitType(habit.type);
  const done = type.isDone(habit, entry);

  return (
    <div className={`hrow${done ? " done" : ""}`}>
      <div className="top">
        <span className="sw" style={{ background: habit.color }} />
        <div className="hname">
          <div className="name">{habit.name}</div>
          <div className="why">
            {habit.identity && `${habit.identity} · `}
            {describeSchedule(habit.schedule)}
          </div>
        </div>
        <div className="ctl">
          <type.Input habit={habit} value={entry?.value ?? null} onChange={(v) => logValue(habit.id, v)} />
          <button type="button" className="iconbtn" aria-expanded={open} aria-label={`Notes and details for ${habit.name}`} onClick={() => setOpen(!open)}>
            {Icons.edit}
          </button>
        </div>
      </div>
      {open && (
        <div className="more">
          <label>
            Note
            <input type="text" placeholder="How did it go?" value={entry?.note ?? ""} onChange={(e) => setEntryNote(habit.id, e.target.value)} />
          </label>
          {habit.fields.map((f) => (
            <label key={f.id}>
              {f.label}
              <input
                type={f.kind === "number" ? "number" : "text"}
                value={entry?.fields[f.id] ?? ""}
                onChange={(e) => setEntryField(habit.id, f.id, e.target.value)}
              />
            </label>
          ))}
          <div className="hint">
            {entry?.value != null ? `Logged at ${new Date(entry.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ` : ""}
            <button type="button" className="linkbtn" onClick={() => onEdit(habit)}>
              Edit {habit.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DayScreen({ onEditHabit }: { onEditHabit: (h?: Habit) => void }) {
  const { date, day, habits, tags, entries, setDate, setJournal, setMood, toggleDayTag, createTag } = useStore();
  const active = habits.filter((h) => !h.archivedAt);
  const due = active.filter((h) => isDue(h.schedule, date));
  const notDue = active.filter((h) => !isDue(h.schedule, date));
  const doneCount = due.filter((h) => getHabitType(h.type).isDone(h, entries[h.id])).length;
  const isToday = date === todayKey();
  const timeline = active
    .map((h) => ({ h, e: entries[h.id] }))
    .filter(({ e }) => e && e.value !== null)
    .sort((a, b) => a.e!.loggedAt.localeCompare(b.e!.loggedAt));

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>{longDate(date)}</h1>
          <div className="sub">
            {isToday ? "Today · " : ""}
            {doneCount} of {due.length} scheduled habits done
          </div>
        </div>
        <div className="tools">
          <button className="iconbtn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>{Icons.left}</button>
          <button className="btn" onClick={() => setDate(todayKey())}>Today</button>
          <button className="iconbtn" aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>{Icons.right}</button>
        </div>
      </header>
      <section className="canvas">
        <div className="daygrid">
          <div>
            <div className="section-h">
              <h3>Habits</h3>
              <button className="btn" onClick={() => onEditHabit()}>+ New habit</button>
            </div>
            {active.length === 0 && (
              <div className="emptybox">
                <p>No habits yet. Start with one small thing you want to do every day.</p>
                <button className="btn primary" onClick={() => onEditHabit()}>Add your first habit</button>
              </div>
            )}
            {due.map((h) => <HabitRow key={h.id} habit={h} onEdit={onEditHabit} />)}
            {notDue.length > 0 && (
              <details className="unsched">
                <summary>{notDue.length} not scheduled today</summary>
                {notDue.map((h) => <HabitRow key={h.id} habit={h} onEdit={onEditHabit} />)}
              </details>
            )}
          </div>
          <div>
            <div className="section-h"><h3>Journal</h3></div>
            <textarea
              key={date}
              rows={8}
              aria-label="Journal"
              placeholder="What happened today? What did you notice?"
              value={day.journal}
              onChange={(e) => setJournal(e.target.value)}
            />
            <div className="section-h spaced"><h3>Mood</h3></div>
            <div className="moods">
              {MOODS.map((m, i) => (
                <button key={m} aria-pressed={day.mood === i} onClick={() => setMood(day.mood === i ? null : i)}>{m}</button>
              ))}
            </div>
            <div className="section-h spaced"><h3>Day tags</h3></div>
            <TagPicker inputId="day-new-tag" tags={tags} selected={day.tags} onToggle={toggleDayTag} onCreate={createTag} />
            <div className="section-h spaced"><h3>Day at a glance</h3></div>
            {timeline.length === 0 ? (
              <p className="empty">Nothing logged yet. Logged habits appear here in time order.</p>
            ) : (
              <div className="timeline">
                {timeline.map(({ h, e }) => (
                  <div key={h.id} style={{ ["--c" as string]: h.color }}>
                    <span className="t">{new Date(e!.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {h.name} <span className="hint">{getHabitType(h.type).format(h, e)}{e!.note ? ` · ${e!.note}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
