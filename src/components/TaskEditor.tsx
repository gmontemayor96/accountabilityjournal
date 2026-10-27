import { useEffect, useRef, useState } from "react";
import type { Task } from "../domain/model";
import { HORIZONS, horizonLabel } from "../domain/goals";
import { useStore } from "../store";
import { DEFAULT_TIME, ensurePermission, REMIND_OPTIONS, reminderFor, reminderKey, type RemindKey } from "../tasks/reminders";
import { isDesktopApp } from "../data";
import { Icons } from "./Icons";
import { TagPicker } from "./TagPicker";

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { tasks, tags, areas, goals, saveTask, deleteTask, createTag, notify } = useStore();
  const rank = (h: string) => HORIZONS.findIndex((x) => x.key === h);
  const isNew = !tasks.some((t) => t.id === task.id);
  const [d, setD] = useState<Task>(() => structuredClone(task));
  const [remind, setRemind] = useState<RemindKey>(() => (isNew && !task.remindAt ? notify.taskDefault : reminderKey(task)));
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (change: Partial<Task>) => setD((cur) => ({ ...cur, ...change }));
  const toggleTag = (id: string) =>
    setD((cur) => ({ ...cur, tags: cur.tags.includes(id) ? cur.tags.filter((t) => t !== id) : [...cur.tags, id] }));

  async function save() {
    if (!d.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    const dueTime = d.dueDate ? d.dueTime : null;
    const remindAt = remind === "custom" ? d.remindAt : reminderFor(remind, d.dueDate, dueTime);
    if (remindAt && isDesktopApp) await ensurePermission().catch(() => false);
    await saveTask({ ...d, title: d.title.trim(), notes: d.notes.trim(), dueTime, remindAt });
    onClose();
  }

  const presets = REMIND_OPTIONS.filter((o) => d.dueDate || o.key === "" || o.key === "custom");

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header>
          <h2 id="task-editor-title">{isNew ? "New task" : "Edit task"}</h2>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>{Icons.close}</button>
        </header>
        <div className="form">
          <div className="field">
            <label className="label" htmlFor="task-title">Task</label>
            <input
              ref={titleRef}
              id="task-title"
              type="text"
              className={titleError ? "invalid" : undefined}
              placeholder={titleError ? "Give the task a name" : "e.g. Book the dentist"}
              value={d.title}
              onChange={(e) => { update({ title: e.target.value }); setTitleError(false); }}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
          <div className="field">
            <span className="label">Due</span>
            <div className="inline">
              <input type="date" aria-label="Due date" value={d.dueDate ?? ""} onChange={(e) => update({ dueDate: e.target.value || null })} />
              {d.dueDate && (
                <input type="time" aria-label="Due time" value={d.dueTime ?? ""} onChange={(e) => update({ dueTime: e.target.value || null })} />
              )}
              {d.dueDate && <button type="button" className="linkbtn" onClick={() => update({ dueDate: null, dueTime: null })}>No date</button>}
            </div>
            <span className="hint">Tasks with a date show on that day in Today and the calendar.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="task-remind">Reminder</label>
            <div className="inline">
              <select id="task-remind" value={presets.some((o) => o.key === remind) ? remind : ""} onChange={(e) => {
                const key = e.target.value as RemindKey;
                setRemind(key);
                if (key === "custom" && !d.remindAt) {
                  update({ remindAt: reminderFor("at", d.dueDate, d.dueTime) ?? `${new Date().toISOString().slice(0, 10)}T${DEFAULT_TIME}` });
                }
              }}>
                {presets.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {remind === "custom" && (
                <input type="datetime-local" aria-label="Reminder time" value={d.remindAt ?? ""} onChange={(e) => update({ remindAt: e.target.value || null })} />
              )}
            </div>
            {remind && remind !== "custom" && !d.dueTime && d.dueDate && <span className="hint">No time set, so the reminder uses {DEFAULT_TIME}.</span>}
          </div>
          {goals.length > 0 && (
            <div className="field">
              <label className="label" htmlFor="task-goal">Goal</label>
              <select id="task-goal" value={goals.some((g) => g.id === d.goalId) ? d.goalId! : ""} onChange={(e) => update({ goalId: e.target.value || null })}>
                <option value="">No goal</option>
                {areas.map((a) => {
                  const list = goals.filter((g) => g.areaId === a.id).sort((x, y) => rank(x.horizon) - rank(y.horizon));
                  return list.length ? (
                    <optgroup key={a.id} label={a.name}>
                      {list.map((g) => <option key={g.id} value={g.id}>{horizonLabel(g.horizon)}: {g.title}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
              <span className="hint">Finishing the task counts toward that goal's progress.</span>
            </div>
          )}
          <div className="field">
            <span className="label">Tags</span>
            <TagPicker inputId="task-new-tag" tags={tags} selected={d.tags} onToggle={toggleTag} onCreate={createTag} />
          </div>
          <div className="field">
            <label className="label" htmlFor="task-notes">Notes</label>
            <textarea id="task-notes" rows={3} value={d.notes} onChange={(e) => update({ notes: e.target.value })} />
          </div>
        </div>
        <footer>
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await deleteTask(d.id);
              onClose();
            }}>
              {confirmDelete ? "Confirm delete" : "Delete task"}
            </button>
          )}
          <div className="r">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isNew ? "Add task" : "Save changes"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
