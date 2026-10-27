import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { moveId } from "../domain/order";

/**
 * Drag-to-reorder for one list, by a handle on each item. Uses pointer events so it works with a
 * mouse and with touch on Android; arrow keys on a focused handle move the item too.
 * `canMove(from, to)` can keep items within a part of the list, such as tasks due the same day.
 */
export function useSortable<T extends { id: string }>(items: T[], onReorder: (ids: string[]) => void, canMove?: (from: T, to: T) => boolean) {
  const listId = useId();
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const byId = new Map(items.map((x) => [x.id, x]));
  const ids = items.map((x) => x.id);
  const allowed = (from: string, to: string) => !canMove || (byId.has(from) && byId.has(to) && canMove(byId.get(from)!, byId.get(to)!));

  // The window listeners below outlive this render, so they read the latest values from here.
  const live = useRef({ drag, ids, allowed, onReorder });
  live.current = { drag, ids, allowed, onReorder };

  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return;
    // Listen on the window: moving the dragged item in the page can make its handle lose the pointer.
    const move = (e: globalThis.PointerEvent) => {
      const { drag: d, allowed: ok } = live.current;
      if (!d) return;
      e.preventDefault();
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(`[data-sort-list="${listId}"]`);
      const to = over?.dataset.sortId;
      if (to && to !== d.id && ok(d.id, to)) setDrag({ id: d.id, order: moveId(d.order, d.id, to) });
      // Scroll the page when dragging near its top or bottom edge.
      const scroller = document.querySelector<HTMLElement>(`[data-sort-list="${listId}"]`)?.closest<HTMLElement>(".canvas");
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 48) scroller.scrollBy(0, -12);
        else if (e.clientY > r.bottom - 48) scroller.scrollBy(0, 12);
      }
    };
    const up = () => {
      const { drag: d, ids: now, onReorder: save } = live.current;
      setDrag(null);
      const order = d ? d.order.filter((id) => now.includes(id)) : [];
      if (d && order.join() !== now.join()) save(order);
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
  }, [dragging, listId]);

  // Items can come or go mid-drag (a sync lands); show the drag order for the items that still exist.
  const order = drag ? [...drag.order.filter((id) => byId.has(id)), ...ids.filter((id) => !drag.order.includes(id))] : ids;

  const handle = (id: string, label: string) => ({
    type: "button" as const,
    className: "draghandle",
    "aria-label": `Move ${label} (drag, or use the arrow keys)`,
    title: "Drag to reorder",
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      if (e.button !== 0) return;
      e.preventDefault();
      setDrag({ id, order: ids });
    },
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const i = ids.indexOf(id);
      const to = ids[e.key === "ArrowUp" ? i - 1 : i + 1];
      if (to && allowed(id, to)) onReorder(moveId(ids, id, to));
    },
  });

  const item = (id: string) => ({ "data-sort-list": listId, "data-sort-id": id, "data-dragging": drag?.id === id || undefined });

  return { items: order.map((id) => byId.get(id)!), handle, item };
}
