import { useEffect, useRef, useState } from "react";
import { goalProgress, HORIZONS, horizonLabel, parentOptions, pctLabel } from "../domain/goals";
import type { Goal, Horizon } from "../domain/model";
import { blankGoal, blankTask, useStore } from "../store";
import { Icons } from "./Icons";
import { Ring } from "./Ring";
import { TaskItem } from "./TaskItem";

export function GoalEditor({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { areas, goals, tasks, saveGoal, deleteGoal, editGoal, editTask, editingTask } = useStore();
  const isNew = !goals.some((g) => g.id === goal.id);
  const [d, setD] = useState<Goal>(() => structuredClone(goal));
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => setD(structuredClone(goal)), [goal]);
  useEffect(() => {
    titleRef.current?.focus();
    // A task opened from here sits on top and takes Escape first.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !useStore.getState().editingTask && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goal.id]);

  const area = areas.find((a) => a.id === d.areaId);
  const parents = parentOptions(d, goals);
  const update = (change: Partial<Goal>) =>
    setD((cur) => {
      const next = { ...cur, ...change };
      // A new area or a shorter horizon can make the old parent impossible.
      if (next.parentId && !parentOptions(next, goals).some((g) => g.id === next.parentId)) next.parentId = null;
      return next;
    });
  const subgoals = goals.filter((g) => g.parentId === goal.id);
  const linked = tasks.filter((t) => t.goalId === goal.id);
  const p = goalProgress({ ...d, id: goal.id }, goals, tasks);
  const steps = p.subgoals.total + p.tasks.total;
  const shorter = HORIZONS.slice(0, HORIZONS.findIndex((h) => h.key === d.horizon));

  /** Saves, and returns false when the title is missing. */
  async function commit(): Promise<boolean> {
    if (!d.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return false;
    }
    await saveGoal({ ...d, title: d.title.trim(), notes: d.notes.trim() });
    return true;
  }
  const save = async () => (await commit()) && onClose();

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && !editingTask && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="goal-editor-title">
        <header>
          <h2 id="goal-editor-title">{isNew ? "New goal" : "Edit goal"}</h2>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>{Icons.close}</button>
        </header>
        <div className="form">
          <div className="field">
            <label className="label" htmlFor="goal-title">Goal</label>
            <input ref={titleRef} id="goal-title" type="text" className={titleError ? "invalid" : undefined}
              placeholder={titleError ? "Give the goal a name" : "e.g. Run a half marathon"} value={d.title}
              onChange={(e) => { update({ title: e.target.value }); setTitleError(false); }}
              onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
          <div className="field">
            <span className="label">Timescale</span>
            <div className="seg" role="group" aria-label="Timescale">
              {HORIZONS.map((h) => (
                <button key={h.key} type="button" aria-pressed={d.horizon === h.key} onClick={() => update({ horizon: h.key })}>{h.label}</button>
              ))}
            </div>
          </div>
          <div className="inline wide">
            <div className="field">
              <label className="label" htmlFor="goal-area">Area</label>
              <select id="goal-area" value={d.areaId} onChange={(e) => update({ areaId: e.target.value })}>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field grow">
              <label className="label" htmlFor="goal-parent">A step toward</label>
              <select id="goal-parent" value={d.parentId ?? ""} onChange={(e) => update({ parentId: e.target.value || null })}>
                <option value="">Nothing (a top goal)</option>
                {parents.map((g) => <option key={g.id} value={g.id}>{horizonLabel(g.horizon)}: {g.title}</option>)}
              </select>
            </div>
          </div>
          {parents.length === 0 && d.horizon !== "10y" && <span className="hint">Add a longer goal in {area?.name ?? "this area"} to make this one a step toward it.</span>}
          <div className="field">
            <label className="label" htmlFor="goal-notes">Notes</label>
            <textarea id="goal-notes" rows={2} value={d.notes} onChange={(e) => update({ notes: e.target.value })} />
          </div>

          {!isNew && (
            <div className="field">
              <span className="label">Progress</span>
              <div className="ring">
                <Ring pct={p.pct} color={area?.color} />
                <div>
                  <div className="big">{steps ? `${p.subgoals.done + p.tasks.done}/${steps}` : p.done ? "Done" : "0/0"}</div>
                  <div className="hint">
                    {steps
                      ? `steps done · ${pctLabel(p.pct)}${p.subgoals.total ? ` · ${p.subgoals.done}/${p.subgoals.total} subgoals` : ""}${p.tasks.total ? ` · ${p.tasks.done}/${p.tasks.total} tasks` : ""}`
                      : "No subgoals or tasks yet, so tick it off yourself."}
                  </div>
                </div>
              </div>
              {steps === 0 && (
                <label className="inline">
                  <input type="checkbox" checked={!!d.doneAt} onChange={(e) => update({ doneAt: e.target.checked ? new Date().toISOString() : null })} />
                  Done
                </label>
              )}
              {steps > 0 && <span className="hint">It completes itself when every subgoal and task is done.</span>}
            </div>
          )}

          {!isNew && (
            <div className="field">
              <span className="label">Subgoals</span>
              <div className="list">
                {subgoals.length === 0 && <p className="empty">None yet.</p>}
                {subgoals.map((g) => {
                  const sp = goalProgress(g, goals, tasks);
                  return (
                    <button key={g.id} type="button" className="subgoal" onClick={async () => (await commit()) && editGoal(g)}>
                      <span className="hint">{horizonLabel(g.horizon)}</span>
                      <span className="grow">{g.title}</span>
                      <span className="pct">{pctLabel(sp.pct)}</span>
                    </button>
                  );
                })}
                {shorter.length > 0 && (
                  <button type="button" className="linkbtn addtask" onClick={async () => {
                    if (await commit()) editGoal(blankGoal(d.areaId, shorter.at(-1)!.key as Horizon, goal.id));
                  }}>+ Add a subgoal</button>
                )}
              </div>
            </div>
          )}

          {!isNew && (
            <div className="field">
              <span className="label">Tasks</span>
              <div className="list">
                {linked.length === 0 && <p className="empty">No tasks linked yet. Pick this goal in a task's Goal field, or add one here.</p>}
                {linked.map((t) => <TaskItem key={t.id} task={t} />)}
                <button type="button" className="linkbtn addtask" onClick={() => editTask({ ...blankTask(null), goalId: goal.id })}>+ Add a task for this goal</button>
              </div>
            </div>
          )}
        </div>
        <footer>
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await deleteGoal(goal.id);
              onClose();
            }}>
              {confirmDelete ? "Confirm delete" : "Delete goal"}
            </button>
          )}
          <div className="r">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isNew ? "Add goal" : "Save changes"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
