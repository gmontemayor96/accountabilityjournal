import { useEffect, useState } from "react";
import { addDays, longDate, todayKey } from "../domain/dates";
import { MOODS, type Day, type HabitEntry } from "../domain/model";
import { dayStats, entriesByDate } from "../domain/stats";
import { getHabitType } from "../habitTypes";
import { useStore } from "../store";

const WINDOW = 60; // days loaded per "Show older" step

export function JournalScreen() {
  const { repo, habits, tags, openDay, dataVersion } = useStore();
  const today = todayKey();
  const [from, setFrom] = useState(() => addDays(today, -(WINDOW - 1)));
  const [earliest, setEarliest] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, Day>>({});
  const [entries, setEntries] = useState<Record<string, Record<string, HabitEntry>>>({});
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    repo?.earliestDate().then(setEarliest);
  }, [repo, dataVersion]);
  useEffect(() => {
    let live = true;
    repo?.loadRange(from, today).then((r) => {
      if (!live) return;
      setDays(Object.fromEntries(r.days.map((d) => [d.date, d])));
      setEntries(entriesByDate(r.entries));
    });
    return () => { live = false; };
  }, [repo, from, today, dataVersion]);

  const habitById = new Map(habits.map((h) => [h.id, h]));
  const tag = (id: string) => tags.find((t) => t.id === id);
  const q = query.trim().toLowerCase();

  const dates = [...new Set([...Object.keys(days), ...Object.keys(entries)])].sort().reverse();
  const shown = dates.filter((date) => {
    const day = days[date];
    const es = Object.values(entries[date] ?? {});
    if (!day?.journal && !es.some((e) => e.value !== null || e.note)) return false;
    if (tagFilter && !(day?.tags.includes(tagFilter) || es.some((e) => habitById.get(e.habitId)?.tags.includes(tagFilter)))) return false;
    if (q) {
      const text = [day?.journal ?? "", ...es.map((e) => e.note), ...es.flatMap((e) => Object.values(e.fields))].join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
  const hasOlder = earliest !== null && earliest < from;

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Journal</h1>
          <div className="sub">Every day, with the habits you did and what you wrote.</div>
        </div>
        <div className="tools">
          <input type="search" aria-label="Search journal and notes" placeholder="Search journal and notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </header>
      <section className="canvas">
        {tags.length > 0 && (
          <div className="filters">
            <span className="label">Tag</span>
            <button className="chip" aria-pressed={!tagFilter} onClick={() => setTagFilter(null)}>All</button>
            {tags.map((t) => (
              <button key={t.id} className="chip" aria-pressed={tagFilter === t.id} onClick={() => setTagFilter(t.id)}>
                <span className="dot" style={{ background: t.color }} />{t.name}
              </button>
            ))}
          </div>
        )}
        <div className="feed">
          {shown.length === 0 && (
            <p className="empty">
              {q || tagFilter ? "No days match. Clear the search or pick another tag." : "Nothing logged yet. Days you log or write about will appear here."}
            </p>
          )}
          {shown.map((date) => {
            const day = days[date];
            const byHabit = entries[date] ?? {};
            const st = dayStats(habits, date, byHabit);
            const done = st.done.concat(
              habits.filter((h) => !st.due.includes(h) && getHabitType(h.type).isDone(h, byHabit[h.id])),
            );
            const notes = Object.values(byHabit).filter((e) => e.note && habitById.has(e.habitId));
            return (
              <article key={date} className="entry">
                <div className="eh">
                  <h3>{longDate(date)}</h3>
                  <span className="num">
                    {st.done.length}/{st.due.length} done{day?.mood != null ? ` · ${MOODS[day.mood]}` : ""}
                  </span>
                  {day?.tags.map((id) => tag(id)).filter(Boolean).map((t) => (
                    <span key={t!.id} className="chip"><span className="dot" style={{ background: t!.color }} />{t!.name}</span>
                  ))}
                  <button className="btn ghost" onClick={() => openDay(date)}>Open</button>
                </div>
                <div className="hchips">
                  {done.length === 0 && <span className="empty">No habits completed</span>}
                  {done.map((h) => (
                    <span key={h.id} className="hchip">
                      <span className="dot" style={{ background: h.color }} />
                      {h.name}
                      {h.type !== "check" && <span className="num">{getHabitType(h.type).format(h, byHabit[h.id])}</span>}
                    </span>
                  ))}
                </div>
                {day?.journal && <p>{day.journal}</p>}
                {notes.length > 0 && (
                  <ul className="hnotes">
                    {notes.map((e) => {
                      const h = habitById.get(e.habitId)!;
                      return <li key={e.habitId}><b style={{ color: h.color }}>{h.name}:</b> {e.note}</li>;
                    })}
                  </ul>
                )}
              </article>
            );
          })}
          {hasOlder && <button className="btn" onClick={() => setFrom(addDays(from, -WINDOW))}>Show older days</button>}
        </div>
      </section>
    </>
  );
}
