import { useEffect, useState } from "react";
import { PALETTE, type Tag } from "../domain/model";
import { useStore } from "../store";

function TagRow({ tag, habitCount, onDelete }: { tag: Tag; habitCount: number; onDelete: () => void }) {
  const updateTag = useStore((s) => s.updateTag);
  const [name, setName] = useState(tag.name);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setName(tag.name), [tag.name]);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tag.name) void updateTag({ ...tag, name: trimmed });
    else setName(tag.name);
  };

  return (
    <tr>
      <td>
        <input type="text" aria-label="Tag name" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      </td>
      <td>
        <div className="swatches small">
          {PALETTE.map((c) => (
            <button key={c} aria-label={`Color ${c}`} aria-pressed={tag.color === c} style={{ background: c }} onClick={() => updateTag({ ...tag, color: c })} />
          ))}
        </div>
      </td>
      <td className="num">{habitCount}</td>
      <td>
        <button className="btn ghost danger" onClick={() => (confirm ? onDelete() : setConfirm(true))} onBlur={() => setConfirm(false)}>
          {confirm ? "Confirm delete" : "Delete"}
        </button>
      </td>
    </tr>
  );
}

export function TagsScreen() {
  const { tags, habits, createTag, deleteTag } = useStore();
  const [draft, setDraft] = useState("");

  const add = async () => {
    if (await createTag(draft)) setDraft("");
  };

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Tags</h1>
          <div className="sub">One tag list for habits and days. Filter the calendar and journal by any of them.</div>
        </div>
      </header>
      <section className="canvas">
        {tags.length === 0 ? (
          <p className="empty">No tags yet. Add one below, or from the habit editor or the Today screen.</p>
        ) : (
          <div className="tablewrap">
            <table className="tags">
              <thead>
                <tr><th>Tag</th><th>Color</th><th className="num">Habits</th><th /></tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <TagRow key={t.id} tag={t} habitCount={habits.filter((h) => h.tags.includes(t.id)).length} onDelete={() => deleteTag(t.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="inline addtag">
          <input type="text" aria-label="New tag name" placeholder="New tag name" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn" onClick={add}>Add tag</button>
        </div>
        <p className="hint">Deleting a tag removes it from every habit and day. Your logs are kept.</p>
      </section>
    </>
  );
}
