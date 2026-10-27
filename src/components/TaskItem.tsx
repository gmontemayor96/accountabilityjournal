import type { HTMLAttributes, ReactNode } from "react";
import type { Task } from "../domain/model";
import { blankTask, useStore } from "../store";
import { localStamp, reminderFor } from "../tasks/reminders";
import { dueLabel, groupOf } from "../tasks/taskDates";
import { Icons } from "./Icons";

/** One task: a checkbox, its title, when it's due, and its tags. Clicking the title opens the editor. */
export function TaskItem({ task, handle, ...rest }: { task: Task; handle?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const { tags, goals, areas, toggleTask, editTask } = useStore();
  const goal = task.goalId ? goals.find((g) => g.id === task.goalId) : undefined;
  const area = goal && areas.find((a) => a.id === goal.areaId);
  const overdue = groupOf(task) === "overdue";
  return (
    <div className={`task${task.doneAt ? " done" : ""}`} {...rest}>
      {handle}
      <button type="button" className="check" role="checkbox" aria-checked={!!task.doneAt} aria-label={`Done: ${task.title}`} onClick={() => toggleTask(task.id)}>
        {task.doneAt && Icons.check}
      </button>
      <button type="button" className="tbody" onClick={() => editTask(task)}>
        <span className="ttitle">{task.title}</span>
        <span className="tmeta">
          {task.dueDate && <span className={overdue ? "overdue" : undefined}>{dueLabel(task)}</span>}
          {task.remindAt && !task.doneAt && <span className="bell" title={`Reminder ${task.remindAt.replace("T", " ")}`}>{Icons.bell}</span>}
          {task.tags.map((id) => tags.find((t) => t.id === id)).filter(Boolean).map((t) => (
            <span key={t!.id} className="ttag"><span className="dot" style={{ background: t!.color }} />{t!.name}</span>
          ))}
          {goal && <span className="tgoal" title="Counts toward this goal">{Icons.goals}<span style={{ color: area?.color }}>{goal.title}</span></span>}
          {task.notes && <span className="tnote">{task.notes.split("\n")[0]}</span>}
        </span>
      </button>
    </div>
  );
}

/** A one-line field that adds a task on Enter, due on `dueDate` when given. */
export function QuickAddTask({ dueDate, placeholder = "Add a task" }: { dueDate: string | null; placeholder?: string }) {
  const { saveTask, notify } = useStore();
  return (
    <input
      type="text"
      className="quickadd"
      aria-label="New task"
      placeholder={placeholder}
      onKeyDown={async (e) => {
        const input = e.currentTarget;
        const title = input.value.trim();
        if (e.key !== "Enter" || !title) return;
        const remindAt = reminderFor(notify.taskDefault, dueDate, null);
        await saveTask({ ...blankTask(dueDate), title, remindAt: remindAt && remindAt > localStamp(new Date()) ? remindAt : null });
        input.value = "";
      }}
    />
  );
}
