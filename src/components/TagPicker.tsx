import { useState } from "react";
import type { Tag } from "../domain/model";

interface Props {
  tags: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string) => Promise<string | null>;
  inputId: string;
}

/** Tag chips you can toggle, plus a field that creates a tag and selects it on Enter. */
export function TagPicker({ tags, selected, onToggle, onCreate, inputId }: Props) {
  const [draft, setDraft] = useState("");
  return (
    <div className="tagrow">
      {tags.map((t) => (
        <button key={t.id} type="button" className="chip" aria-pressed={selected.includes(t.id)} onClick={() => onToggle(t.id)}>
          <span className="dot" style={{ background: t.color }} />
          {t.name}
        </button>
      ))}
      <input
        id={inputId}
        type="text"
        placeholder="+ new tag"
        aria-label="New tag"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const id = await onCreate(draft);
          if (id && !selected.includes(id)) onToggle(id);
          setDraft("");
        }}
      />
    </div>
  );
}
