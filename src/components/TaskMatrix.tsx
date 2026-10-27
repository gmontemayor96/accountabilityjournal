import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Task } from "../domain/model";
import { blankTask, useStore } from "../store";
import { isUnsorted, QUADRANTS, quadrantOf, type Quadrant } from "../tasks/matrix";
import { Icons } from "./Icons";
import { TaskItem } from "./TaskItem";

interface Drag {
  id: string;
  x: number;
  y: number;
  /** Where it would land: the box, and the task it would go before (null for the end). */
  to: { q: Quadrant; before: string | null } | null;
}

/** Open tasks in the four Eisenhower boxes. Drag a task's handle to reorder it or move it to another box. */
export function TaskMatrix({ tasks }: { tasks: Task[] }) {
  const { moveTaskInMatrix, saveTask } = useStore();
  const open = tasks.filter((t) => !t.doneAt);
  const byQ = (q: Quadrant) => open.filter((t) => quadrantOf(t) === q);
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef({ drag, open });
  live.current = { drag, open };

  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = live.current.drag;
      if (!d) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const box = el?.closest<HTMLElement>("[data-quadrant]");
      let to: Drag["to"] = null;
      if (box) {
        const q = box.dataset.quadrant as Quadrant;
        const rows = [...box.querySelectorAll<HTMLElement>("[data-task-id]")].filter((r) => r.dataset.taskId !== d.id);
        // Before the first row whose middle is below the pointer.
        const next = rows.find((r) => {
          const rect = r.getBoundingClientRect();
          return e.clientY < rect.top + rect.height / 2;
        });
        to = { q, before: next?.dataset.taskId ?? null };
      }
      setDrag({ ...d, x: e.clientX, y: e.clientY, to });
      // Scroll when dragging near the top or bottom, so boxes off screen can be reached.
      const scroller = document.querySelector<HTMLElement>(".canvas");
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollBy(0, -14);
        else if (e.clientY > r.bottom - 48) scroller.scrollBy(0, 14);
      }
    };
    const up = () => {
      const d = live.current.drag;
      setDrag(null);
      if (d?.to) void drop(d.id, d.to.q, d.to.before);
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    // drop reads the latest tasks through `live`, so it doesn't need to be a dependency.
  }, [dragging]);

  async function drop(id: string, q: Quadrant, before: string | null) {
    const info = QUADRANTS.find((x) => x.key === q)!;
    const ids = live.current.open.filter((t) => quadrantOf(t) === q && t.id !== id).map((t) => t.id);
    const at = before ? ids.indexOf(before) : -1;
    ids.splice(at < 0 ? ids.length : at, 0, id);
    await moveTaskInMatrix(id, { important: info.important, urgent: info.urgent }, ids);
  }

  /** Arrow keys on a handle: up and down within the box, left and right across to the other urgency. */
  function onKey(e: KeyboardEvent, t: Task) {
    const q = quadrantOf(t);
    if (!q) return;
    const ids = byQ(q).map((x) => x.id);
    const i = ids.indexOf(t.id);
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const j = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return;
      void drop(t.id, q, e.key === "ArrowUp" ? ids[j] : ids[j + 1] ?? null);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const urgent = e.key === "ArrowLeft";
      if (!!t.urgent === urgent) return;
      const target = QUADRANTS.find((x) => x.important === !!t.important && x.urgent === urgent)!;
      void drop(t.id, target.key, null);
    }
  }

  const dragged = drag ? open.find((t) => t.id === drag.id) : undefined;
  const unsorted = open.filter(isUnsorted);

  const handle = (t: Task) => (
    <button type="button" className="draghandle" title="Drag to reorder or move to another box"
      aria-label={`Move ${t.title} (drag, or arrow keys: up and down to reorder, left and right to change urgency)`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setDrag({ id: t.id, x: e.clientX, y: e.clientY, to: null });
      }}
      onKeyDown={(e) => onKey(e, t)}>
      {Icons.grip}
    </button>
  );

  return (
    <>
    {unsorted.length > 0 && (
      <details className="unsorted" open>
        <summary><h3>Not sorted yet <span className="count">{unsorted.length}</span></h3></summary>
        <p className="hint">Drag each task into a box, or set Important and Urgent in the task.</p>
        {unsorted.map((t) => (
          <div key={t.id} className={drag?.id === t.id ? "ghosted" : undefined}><TaskItem task={t} handle={handle(t)} /></div>
        ))}
      </details>
    )}
    <div className={`matrix${drag ? " dragging" : ""}`}>
      <div className="axis top"><span>Urgent</span><span>Not urgent</span></div>
      <div className="axis side"><span>Important</span><span>Not important</span></div>
      <div className="quads">
        {QUADRANTS.map((q) => {
          const list = byQ(q.key);
          const target = drag?.to?.q === q.key ? drag.to : null;
          return (
            <section key={q.key} className={`quad ${q.key}${target ? " over" : ""}`} data-quadrant={q.key} aria-label={`${q.title}: ${q.sub}`}>
              <header>
                <h3>{q.title} <span className="count">{list.length}</span></h3>
                <span className="hint">{q.sub}</span>
              </header>
              {list.map((t) => (
                <div key={t.id} data-task-id={t.id} className={drag?.id === t.id ? "ghosted" : undefined}>
                  {target && target.before === t.id && <div className="dropline" />}
                  <TaskItem task={t} handle={handle(t)} />
                </div>
              ))}
              {target && target.before === null && <div className="dropline" />}
              {list.length === 0 && !target && <p className="empty small">Nothing here.</p>}
              <QuickAdd onAdd={(title) => saveTask({ ...blankTask(null), title, important: q.important, urgent: q.urgent })} label={q.title} />
            </section>
          );
        })}
      </div>
      {drag && dragged && <div className="dragghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>{dragged.title}</div>}
    </div>
    </>
  );
}

function QuickAdd({ onAdd, label }: { onAdd: (title: string) => Promise<void>; label: string }) {
  const [text, setText] = useState("");
  return (
    <input type="text" className="quadadd" placeholder="+ Add a task" aria-label={`Add a task to ${label}`} value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key !== "Enter" || !text.trim()) return;
        await onAdd(text.trim());
        setText("");
      }} />
  );
}
