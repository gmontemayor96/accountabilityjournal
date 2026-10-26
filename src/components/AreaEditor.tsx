import { useEffect, useRef, useState } from "react";
import { PALETTE, type Area } from "../domain/model";
import { useStore } from "../store";
import { Icons } from "./Icons";

export function AreaEditor({ area, onClose, onSaved }: { area: Area; onClose: () => void; onSaved: (id: string) => void }) {
  const { areas, goals, saveArea, deleteArea } = useStore();
  const isNew = !areas.some((a) => a.id === area.id);
  const [d, setD] = useState(area);
  const [nameError, setNameError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const goalCount = goals.filter((g) => g.areaId === area.id).length;

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!d.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    await saveArea({ ...d, name: d.name.trim() });
    onSaved(d.id);
    onClose();
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="area-editor-title">
        <header>
          <h2 id="area-editor-title">{isNew ? "New area of life" : "Edit area"}</h2>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>{Icons.close}</button>
        </header>
        <div className="form">
          <div className="field">
            <label className="label" htmlFor="area-name">Name</label>
            <input ref={nameRef} id="area-name" type="text" className={nameError ? "invalid" : undefined}
              placeholder={nameError ? "Give the area a name" : "e.g. Health"} value={d.name}
              onChange={(e) => { setD({ ...d, name: e.target.value }); setNameError(false); }}
              onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
          <div className="field">
            <span className="label">Color</span>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={d.color === c} style={{ background: c }} onClick={() => setD({ ...d, color: c })} />
              ))}
            </div>
          </div>
        </div>
        <footer>
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await deleteArea(area.id);
              onClose();
            }}>
              {confirmDelete ? `Delete ${goalCount ? `it and ${goalCount} goal${goalCount === 1 ? "" : "s"}` : "it"}` : "Delete area"}
            </button>
          )}
          <div className="r">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isNew ? "Add area" : "Save changes"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
