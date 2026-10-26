import { longDate, todayKey } from "../domain/dates";
import { MOODS, type Day, type Habit, type HabitEntry, type Tag, type Task } from "../domain/model";
import { dayStats } from "../domain/stats";
import { getHabitType } from "../habitTypes";
import { blankTask, useStore } from "../store";
import { TaskItem } from "./TaskItem";

interface Props {
  date: string;
  habits: Habit[];
  tags: Tag[];
  tasks: Task[];
  day?: Day;
  entries: Record<string, HabitEntry>;
  tagFilter: string | null;
  onOpen: (date: string) => void;
}

function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 22;
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 28 28)" />
    </svg>
  );
}

/** The selected day's habits, journal and tags, shown beside the calendar. */
export function DaySummary({ date, habits, tags, tasks, day, entries, tagFilter, onOpen }: Props) {
  const editTask = useStore((s) => s.editTask);
  const taskList = (
    <>
      <div className="label">Tasks</div>
      <div className="list">
        {tasks.map((t) => <TaskItem key={t.id} task={t} />)}
        <button className="linkbtn addtask" onClick={() => editTask(blankTask(date))}>+ Add a task on this day</button>
      </div>
    </>
  );
  const isFuture = date > todayKey();
  const st = dayStats(habits, date, entries, tagFilter);
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="daycard">
      <div className="label">{date === todayKey() ? "Today" : "Selected day"}</div>
      <h2>{longDate(date)}</h2>
      {isFuture ? (
        <>
          <p className="empty">{st.due.length} habits scheduled. You can log this day once it arrives.</p>
          {taskList}
        </>
      ) : (
        <>
          <div className="meta">
            {day?.mood != null && `Mood: ${MOODS[day.mood]} · `}
            {day?.tags.length ? day.tags.map((t) => `#${tagName(t)}`).join(" ") : "No day tags"}
          </div>
          <div className="ring">
            <Ring pct={st.pct} />
            <div>
              <div className="big">{st.done.length}/{st.due.length}</div>
              <div className="hint">habits done{tagFilter ? ` in #${tagName(tagFilter)}` : ""}</div>
            </div>
          </div>
          <div className="label">Habits</div>
          <div className="list">
            {st.due.length === 0 && <p className="empty">Nothing scheduled.</p>}
            {st.due.map((h) => {
              const e = entries[h.id];
              const ok = getHabitType(h.type).isDone(h, e);
              return (
                <div key={h.id} className={`li${ok ? "" : " miss"}`}>
                  <span className="dot" style={{ background: ok ? h.color : "transparent", boxShadow: `inset 0 0 0 1.5px ${h.color}` }} />
                  <span>
                    {h.name}
                    {e?.note && <span className="n">{e.note}</span>}
                  </span>
                  <span className="v">{getHabitType(h.type).format(h, e)}</span>
                </div>
              );
            })}
          </div>
          {taskList}
          <div className="label">Journal</div>
          {day?.journal ? <div className="excerpt">{day.journal}</div> : <p className="empty">No entry yet.</p>}
          <button className="btn primary" onClick={() => onOpen(date)}>Open day</button>
        </>
      )}
    </div>
  );
}
