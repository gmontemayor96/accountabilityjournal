import { useState } from "react";
import { AreaEditor } from "../components/AreaEditor";
import { Icons } from "../components/Icons";
import { Ring } from "../components/Ring";
import { ancestors, goalProgress, HORIZONS, pctLabel } from "../domain/goals";
import type { Area, Goal } from "../domain/model";
import { blankArea, blankGoal, useStore } from "../store";

export function GoalsScreen() {
  const { areas, goals, tasks, editGoal } = useStore();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  const inArea = area ? goals.filter((g) => g.areaId === area.id) : [];
  const doneInArea = inArea.filter((g) => goalProgress(g, goals, tasks).done).length;

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Goals</h1>
          <div className="sub">Goals for each area of your life, from today out to ten years. Link tasks and shorter goals to show the path.</div>
        </div>
        {area && (
          <div className="tools">
            <button className="btn primary" onClick={() => editGoal(blankGoal(area.id, "year"))}>+ New goal</button>
          </div>
        )}
      </header>
      <section className="canvas goalpage">
        {areas.length === 0 ? (
          <div className="emptybox">
            <p className="empty">Start with an area of your life, such as Health, Career, Family or Money. Each area gets goals from 1 day to 10 years.</p>
            <button className="btn primary" onClick={() => setEditingArea(blankArea(areas))}>+ Add an area</button>
          </div>
        ) : (
          <>
            <div className="filters" role="tablist" aria-label="Areas of life">
              <span className="label">Area</span>
              {areas.map((a) => (
                <button key={a.id} role="tab" className="chip" aria-selected={a.id === area?.id} aria-pressed={a.id === area?.id} onClick={() => setAreaId(a.id)}>
                  <span className="dot" style={{ background: a.color }} />{a.name}
                </button>
              ))}
              <button className="linkbtn" onClick={() => setEditingArea(blankArea(areas))}>+ Area</button>
            </div>
            {area && (
              <>
                <div className="areahead">
                  <div className="ring">
                    <Ring pct={inArea.length ? doneInArea / inArea.length : 0} color={area.color} />
                    <div>
                      <div className="big">{doneInArea}/{inArea.length}</div>
                      <div className="hint">goals done in {area.name}</div>
                    </div>
                  </div>
                  <button className="btn ghost" onClick={() => setEditingArea(area)}>Edit area</button>
                </div>
                <div className="buckets">
                  {HORIZONS.map(({ key, label }) => {
                    const list = inArea.filter((g) => g.horizon === key);
                    const done = list.filter((g) => goalProgress(g, goals, tasks).done).length;
                    return (
                      <div key={key} className="bucket">
                        <h3>{label} {list.length > 0 && <span className="count">{done}/{list.length} done</span>}</h3>
                        {list.map((g) => <GoalCard key={g.id} goal={g} color={area.color} />)}
                        <button className="linkbtn addtask" onClick={() => editGoal(blankGoal(area.id, key))}>+ Add a {label} goal</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </section>
      {editingArea && (
        <AreaEditor
          area={editingArea}
          onClose={() => setEditingArea(null)}
          onSaved={(id) => setAreaId(id)}
        />
      )}
    </>
  );
}

/** A goal in its bucket: a ring with its share done, steps done out of all, and what it leads to. */
export function GoalCard({ goal, color }: { goal: Goal; color: string }) {
  const { goals, tasks, editGoal, toggleGoal } = useStore();
  const p = goalProgress(goal, goals, tasks);
  const steps = p.subgoals.total + p.tasks.total;
  const stepsDone = p.subgoals.done + p.tasks.done;
  const parent = ancestors(goal, goals)[0];
  return (
    <div className={`goal${p.done ? " done" : ""}`}>
      {steps === 0 ? (
        <button type="button" className="check" role="checkbox" aria-checked={p.done} aria-label={`Done: ${goal.title}`} onClick={() => toggleGoal(goal.id)}>
          {p.done && Icons.check}
        </button>
      ) : (
        <span className="gring" title={`${pctLabel(p.pct)} done`}>
          <Ring pct={p.pct} size={34} color={color} />
          <span>{Math.round(p.pct * 100)}</span>
        </span>
      )}
      <button type="button" className="tbody" onClick={() => editGoal(goal)}>
        <span className="ttitle">{goal.title}</span>
        <span className="tmeta">
          {steps > 0 ? <span><b>{stepsDone}/{steps}</b> steps done · {pctLabel(p.pct)}</span> : <span>{p.done ? "Done" : "No steps yet"}</span>}
          {parent && <span className="toward">Toward: {parent.title}</span>}
        </span>
      </button>
    </div>
  );
}
