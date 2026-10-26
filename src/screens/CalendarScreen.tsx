import { useEffect, useMemo, useState } from "react";
import { DaySummary } from "../components/DaySummary";
import { Icons } from "../components/Icons";
import { todayKey } from "../domain/dates";
import type { Day, HabitEntry } from "../domain/model";
import { dayStats, entriesByDate, inMonth, monthGrid } from "../domain/stats";
import { isDue } from "../domain/schedule";
import { getHabitType } from "../habitTypes";
import { useStore } from "../store";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarScreen() {
  const { repo, habits, tags, openDay, dataVersion } = useStore();
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [focusId, setFocusId] = useState("");
  const [data, setData] = useState<{ days: Record<string, Day>; entries: Record<string, Record<string, HabitEntry>> }>({ days: {}, entries: {} });

  const grid = useMemo(() => monthGrid(month.y, month.m), [month]);
  useEffect(() => {
    let live = true;
    repo?.loadRange(grid[0], grid.at(-1)!).then(({ days, entries }) => {
      if (live) setData({ days: Object.fromEntries(days.map((d) => [d.date, d])), entries: entriesByDate(entries) });
    });
    return () => { live = false; };
  }, [repo, grid, dataVersion]);

  const active = habits.filter((h) => !h.archivedAt);
  const focus = active.find((h) => h.id === focusId);
  const usedTags = tags.filter((t) => active.some((h) => h.tags.includes(t.id)));
  const shift = (n: number) => {
    const y = month.m + n < 0 ? month.y - 1 : month.m + n > 11 ? month.y + 1 : month.y;
    const m = (month.m + n + 12) % 12;
    setMonth({ y, m });
    // Keep the side panel on a day the grid has loaded: today if it is in view, else the 1st.
    setSelected(inMonth(today, y, m) ? today : `${y}-${String(m + 1).padStart(2, "0")}-01`);
  };
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  return (
    <>
      <header className="viewhead">
        <h1>{MONTHS[month.m]} <span className="year">{month.y}</span></h1>
        <div className="daynav">
          <button className="iconbtn" aria-label="Previous month" onClick={() => shift(-1)}>{Icons.left}</button>
          <button className="btn" onClick={goToday}>Today</button>
          <button className="iconbtn" aria-label="Next month" onClick={() => shift(1)}>{Icons.right}</button>
        </div>
        <div className="tools">
          <label className="hint" htmlFor="cal-focus">Show</label>
          <select id="cal-focus" value={focusId} onChange={(e) => setFocusId(e.target.value)}>
            <option value="">All habits</option>
            {active.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      </header>
      <div className="split">
        <section className="canvas">
          {usedTags.length > 0 && !focus && (
            <div className="filters">
              <span className="label">Tag</span>
              <button className="chip" aria-pressed={!tagFilter} onClick={() => setTagFilter(null)}>All</button>
              {usedTags.map((t) => (
                <button key={t.id} className="chip" aria-pressed={tagFilter === t.id} onClick={() => setTagFilter(t.id)}>
                  <span className="dot" style={{ background: t.color }} />{t.name}
                </button>
              ))}
            </div>
          )}
          <div className="cal" role="grid" aria-label={`${MONTHS[month.m]} ${month.y}`}>
            {WEEK.map((w) => <div key={w} className="wd">{w}</div>)}
            {grid.map((k) => {
              const day = data.days[k];
              const entries = data.entries[k] ?? {};
              const future = k > today;
              const st = dayStats(active, k, entries, tagFilter);
              let body = null;
              if (!future && focus) {
                const e = entries[focus.id];
                const type = getHabitType(focus.type);
                const done = type.isDone(focus, e);
                const partial = !done && e?.value && focus.target ? Math.min(0.9, e.value / focus.target) : 0;
                body = (
                  <>
                    <div className="heat" style={{ background: focus.color, opacity: done ? 0.85 : partial * 0.5 }} />
                    <div className="tagline">{isDue(focus.schedule, k) ? (e ? type.format(focus, e) : "missed") : "not scheduled"}</div>
                  </>
                );
              } else if (!future) {
                body = (
                  <>
                    <div className="dots">
                      {st.due.map((h) => (
                        <span key={h.id} className={`dot${st.done.includes(h) ? "" : " miss"}`} style={{ background: h.color }} title={h.name} />
                      ))}
                    </div>
                    {day?.tags.length ? <div className="tagline">{day.tags.map((t) => `#${tags.find((x) => x.id === t)?.name ?? t}`).join(" ")}</div> : null}
                    <div className="bar"><i style={{ width: `${Math.round(st.pct * 100)}%` }} /></div>
                  </>
                );
              }
              return (
                <button
                  key={k}
                  className={`cell${inMonth(k, month.y, month.m) ? "" : " out"}${future ? " future" : ""}${k === today ? " today" : ""}`}
                  aria-selected={selected === k}
                  aria-label={k}
                  onClick={() => (selected === k && !future ? openDay(k) : setSelected(k))}
                >
                  <span className="d"><b>{Number(k.slice(8))}</b>{day?.journal && !focus ? <span className="jmark" title="Has a journal entry">{Icons.journal}</span> : null}</span>
                  {body}
                </button>
              );
            })}
          </div>
          <div className="legend">
            {focus ? (
              <span><span className="dot" style={{ background: focus.color }} /> Shaded days: {focus.name} hit its target. Lighter: partly done.</span>
            ) : (
              <>
                <span><span className="barkey" /> Share of scheduled habits done</span>
                <span><span className="dot" style={{ background: "var(--muted)" }} /> Done</span>
                <span><span className="dot hollow" /> Scheduled, missed</span>
                <span><span className="jmark">{Icons.journal}</span> Journal entry</span>
                <span>Click a selected day again to open it.</span>
              </>
            )}
          </div>
        </section>
        <aside className="side">
          <DaySummary date={selected} habits={active} tags={tags} day={data.days[selected]} entries={data.entries[selected] ?? {}} tagFilter={tagFilter} onOpen={openDay} />
        </aside>
      </div>
    </>
  );
}
