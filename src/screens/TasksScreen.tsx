import { useState } from "react";
import { Icons } from "../components/Icons";
import { QuickAddTask, TaskItem } from "../components/TaskItem";
import { todayKey } from "../domain/dates";
import type { Task } from "../domain/model";
import { useSortable } from "../hooks/useSortable";
import { blankTask, useStore } from "../store";
import { groupOf, type TaskGroup } from "../tasks/taskDates";

const GROUPS: { key: Exclude<TaskGroup, "done">; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "someday", label: "No date" },
];

export function TasksScreen() {
  const { tasks, tags, editTask } = useStore();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const today = todayKey();
  const shown = tasks.filter((t) => !tagFilter || t.tags.includes(tagFilter));
  const usedTags = tags.filter((t) => tasks.some((x) => x.tags.includes(t.id)));
  const done = shown.filter((t) => t.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Tasks</h1>
          <div className="sub">One-off things to do. Give them a date to see them on that day, and a reminder to get a nudge.</div>
        </div>
        <div className="tools">
          <button className="btn primary" onClick={() => editTask(blankTask(today))}>+ New task</button>
        </div>
      </header>
      <section className="canvas taskpage">
        <QuickAddTask dueDate={null} placeholder="Add a task with no date, then press Enter" />
        {usedTags.length > 0 && (
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
        {shown.length === 0 && <p className="empty">No tasks{tagFilter ? " with this tag" : " yet"}.</p>}
        {GROUPS.map(({ key, label }) => {
          const list = shown.filter((t) => groupOf(t, today) === key);
          // Upcoming tasks stay in date order; dragging reorders those due the same day.
          if (key === "upcoming") list.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
          if (!list.length) return null;
          return (
            <div key={key} className="taskgroup">
              <h3 className={key === "overdue" ? "overdue" : undefined}>{label} <span className="count">{list.length}</span></h3>
              <SortableTasks tasks={list} sameDay={key === "upcoming"} />
            </div>
          );
        })}
        {done.length > 0 && (
          <details className="taskgroup">
            <summary><h3>Done <span className="count">{done.length}</span></h3></summary>
            {done.slice(0, 50).map((t) => <TaskItem key={t.id} task={t} />)}
          </details>
        )}
      </section>
    </>
  );
}

/** One group of open tasks, reordered by dragging. */
function SortableTasks({ tasks, sameDay }: { tasks: Task[]; sameDay: boolean }) {
  const reorderTasks = useStore((s) => s.reorderTasks);
  const sort = useSortable(tasks, reorderTasks, sameDay ? (a, b) => a.dueDate === b.dueDate : undefined);
  // A task only gets a handle when there's something it can swap with.
  const movable = (t: Task) => tasks.some((x) => x.id !== t.id && (!sameDay || x.dueDate === t.dueDate));
  return (
    <>
      {sort.items.map((t) => (
        <TaskItem key={t.id} task={t} {...sort.item(t.id)}
          handle={movable(t) ? <button {...sort.handle(t.id, t.title)}>{Icons.grip}</button> : undefined} />
      ))}
    </>
  );
}
