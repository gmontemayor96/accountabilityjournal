import { useEffect, useRef, useState } from "react";
import { WEEKDAYS } from "../domain/dates";
import { newId, PALETTE, type Habit, type Schedule } from "../domain/model";
import { normalizeSchedule } from "../domain/schedule";
import { allHabitTypes, getHabitType } from "../habitTypes";
import { useStore } from "../store";
import { Icons } from "./Icons";
import { TagPicker } from "./TagPicker";

const SCHEDULES: { kind: Schedule["kind"]; label: string }[] = [
  { kind: "daily", label: "Every day" },
  { kind: "weekdays", label: "Specific days" },
  { kind: "perWeek", label: "Times per week" },
];

export function HabitEditor({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const { habits, tags, saveHabit, setArchived, createTag } = useStore();
  const isNew = !habits.some((h) => h.id === habit.id);
  const [d, setD] = useState<Habit>(() => structuredClone(habit));
  const [nameError, setNameError] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [days, setDays] = useState<number[]>(habit.schedule.kind === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5]);
  const [perWeek, setPerWeek] = useState(habit.schedule.kind === "perWeek" ? habit.schedule.n : 3);
  const nameRef = useRef<HTMLInputElement>(null);
  const type = getHabitType(d.type);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (change: Partial<Habit>) => setD((cur) => ({ ...cur, ...change }));

  const setKind = (kind: Schedule["kind"]) =>
    update({ schedule: kind === "daily" ? { kind } : kind === "weekdays" ? { kind, days } : { kind, n: perWeek } });

  async function save() {
    if (!d.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    const t = getHabitType(d.type);
    await saveHabit({
      ...d,
      name: d.name.trim(),
      identity: d.identity.trim(),
      target: t.usesTarget ? Math.max(1, d.target ?? t.defaultTarget ?? 1) : null,
      unit: t.usesTarget ? d.unit.trim() : "",
      schedule: normalizeSchedule(d.schedule),
      fields: d.fields.filter((f) => f.label.trim()).map((f) => ({ ...f, label: f.label.trim() })),
    });
    onClose();
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header>
          <h2 id="editor-title">{isNew ? "New habit" : "Edit habit"}</h2>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>{Icons.close}</button>
        </header>
        <div className="form">
          <div className="field">
            <label className="label" htmlFor="ed-name">Name</label>
            <input
              ref={nameRef}
              id="ed-name"
              type="text"
              className={nameError ? "invalid" : undefined}
              placeholder={nameError ? "Give the habit a name" : "e.g. Evening stretch"}
              value={d.name}
              onChange={(e) => { update({ name: e.target.value }); setNameError(false); }}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="ed-identity">Identity statement</label>
            <input id="ed-identity" type="text" placeholder="I am someone who…" value={d.identity} onChange={(e) => update({ identity: e.target.value })} />
            <span className="hint">Shown with the habit as a reminder of who you're becoming.</span>
          </div>
          <div className="field">
            <span className="label">Color</span>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={d.color === c} style={{ background: c }} onClick={() => update({ color: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">How you log it</span>
            <div className="seg">
              {allHabitTypes().map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={d.type === t.key}
                  onClick={() => update({ type: t.key, target: t.usesTarget ? d.target ?? t.defaultTarget ?? 1 : null, unit: t.usesTarget ? d.unit || t.defaultUnit || "" : "" })}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {type.usesTarget && (
              <div className="inline">
                <label className="hint" htmlFor="ed-target">Daily target</label>
                <input id="ed-target" type="number" min={1} className="narrow" value={d.target ?? ""} onChange={(e) => update({ target: Number(e.target.value) || null })} />
                <input type="text" aria-label="Unit" className="mid" placeholder={d.type === "duration" ? "min" : "pages, glasses…"} value={d.unit} onChange={(e) => update({ unit: e.target.value })} />
              </div>
            )}
            <span className="hint">{type.description}</span>
          </div>
          <div className="field">
            <span className="label">Schedule</span>
            <div className="seg">
              {SCHEDULES.map((s) => (
                <button key={s.kind} type="button" aria-pressed={d.schedule.kind === s.kind} onClick={() => setKind(s.kind)}>{s.label}</button>
              ))}
            </div>
            {d.schedule.kind === "weekdays" && (
              <div className="wdays">
                {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                  const on = days.includes(i);
                  return (
                    <button key={i} type="button" aria-pressed={on} onClick={() => {
                      const next = on ? days.filter((x) => x !== i) : [...days, i];
                      setDays(next);
                      update({ schedule: { kind: "weekdays", days: next } });
                    }}>{WEEKDAYS[i]}</button>
                  );
                })}
              </div>
            )}
            {d.schedule.kind === "perWeek" && (
              <div className="inline">
                <input type="number" min={1} max={7} className="narrow" aria-label="Times per week" value={perWeek} onChange={(e) => {
                  const n = Number(e.target.value) || 1;
                  setPerWeek(n);
                  update({ schedule: { kind: "perWeek", n } });
                }} />
                <span className="hint">times per week, any days</span>
              </div>
            )}
          </div>
          <div className="field">
            <span className="label">Tags</span>
            <TagPicker
              inputId="ed-new-tag"
              tags={tags}
              selected={d.tags}
              onToggle={(id) => update({ tags: d.tags.includes(id) ? d.tags.filter((t) => t !== id) : [...d.tags, id] })}
              onCreate={createTag}
            />
          </div>
          <div className="field">
            <span className="label">Extra fields</span>
            {d.fields.map((f, i) => (
              <div key={f.id} className="modfield">
                <input type="text" aria-label="Field name" placeholder="Field name, e.g. Distance (km)" value={f.label} onChange={(e) => update({ fields: d.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <select aria-label="Field type" value={f.kind} onChange={(e) => update({ fields: d.fields.map((x, j) => (j === i ? { ...x, kind: e.target.value as "text" | "number" } : x)) })}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
                <button type="button" className="iconbtn" aria-label="Remove field" onClick={() => update({ fields: d.fields.filter((_, j) => j !== i) })}>{Icons.close}</button>
              </div>
            ))}
            <div>
              <button type="button" className="btn" onClick={() => update({ fields: [...d.fields, { id: newId("f"), label: "", kind: "text" }] })}>+ Add field</button>
            </div>
            <span className="hint">Log extra details with each entry, like distance for a run or the book you're reading.</span>
          </div>
        </div>
        <footer>
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              if (!confirmArchive) return setConfirmArchive(true);
              await setArchived(d.id, true);
              onClose();
            }}>
              {confirmArchive ? "Confirm archive" : "Archive habit"}
            </button>
          )}
          <div className="r">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isNew ? "Create habit" : "Save changes"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
