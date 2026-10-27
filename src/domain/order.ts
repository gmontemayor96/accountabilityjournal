/** Something kept in a user-chosen order. */
export interface Ordered {
  id: string;
  sortOrder?: number;
}

/**
 * Applies a new order for some of the items, such as one group on screen, to the whole list.
 * The moved items take the places the group already held, so everything else stays put.
 * Returns the reordered list, renumbered from 0, and just the items whose number changed, to save.
 */
export function applyOrder<T extends Ordered>(all: T[], ids: string[]): { list: T[]; changed: T[] } {
  const moved = new Set(ids);
  const byId = new Map(all.map((x) => [x.id, x]));
  const queue = ids.map((id) => byId.get(id)).filter((x): x is T => !!x);
  const placed = all.map((x) => (moved.has(x.id) ? queue.shift() ?? x : x));
  const list = placed.map((x, i) => (x.sortOrder === i ? x : { ...x, sortOrder: i }));
  return { list, changed: list.filter((_, i) => placed[i].sortOrder !== i) };
}

/** The next number after every item's, for something new to go at the end. */
export const nextOrder = (all: Ordered[]) => all.reduce((m, x) => Math.max(m, (x.sortOrder ?? 0) + 1), 0);

/** Moves one id to another's place in a list of ids. */
export function moveId(ids: string[], from: string, to: string): string[] {
  const i = ids.indexOf(from);
  const j = ids.indexOf(to);
  if (i < 0 || j < 0 || i === j) return ids;
  const next = ids.filter((id) => id !== from);
  next.splice(j, 0, from);
  return next;
}
