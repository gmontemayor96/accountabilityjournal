import { entryKey, emptySyncData, type Stamped, type SyncChanges, type SyncData, type Tombstone } from "./types";

type Item =
  | { kind: "habit" | "tag" | "day" | "entry" | "task" | "area" | "goal"; key: string; at: string; record: Stamped<unknown> }
  | { kind: Tombstone["kind"]; key: string; at: string; tombstone: Tombstone };

function items(d: SyncData): Map<string, Item> {
  const out = new Map<string, Item>();
  const put = (item: Item) => {
    const id = `${item.kind}:${item.key}`;
    const prev = out.get(id);
    if (!prev || item.at > prev.at) out.set(id, item);
  };
  for (const r of d.habits) put({ kind: "habit", key: r.data.id, at: r.updatedAt, record: r });
  for (const r of d.tags) put({ kind: "tag", key: r.data.id, at: r.updatedAt, record: r });
  for (const r of d.days) put({ kind: "day", key: r.data.date, at: r.updatedAt, record: r });
  for (const r of d.entries) put({ kind: "entry", key: entryKey(r.data), at: r.updatedAt, record: r });
  for (const r of d.tasks ?? []) put({ kind: "task", key: r.data.id, at: r.updatedAt, record: r });
  for (const r of d.areas ?? []) put({ kind: "area", key: r.data.id, at: r.updatedAt, record: r });
  for (const r of d.goals ?? []) put({ kind: "goal", key: r.data.id, at: r.updatedAt, record: r });
  for (const t of d.tombstones) put({ kind: t.kind, key: t.key, at: t.deletedAt, tombstone: t });
  return out;
}

/**
 * Works out what to change locally so this device holds the newest version of every record
 * across `local` and each of `remotes`. A newer deletion beats an older edit and the other way
 * round. On an exact tie the local copy stays, so a merge never undoes itself.
 */
export function planMerge(local: SyncData, remotes: SyncData[]): SyncChanges {
  const mine = items(local);
  const winners = new Map(mine);
  for (const remote of remotes) {
    for (const [id, item] of items(remote)) {
      const cur = winners.get(id);
      if (!cur || item.at > cur.at) winners.set(id, item);
    }
  }

  const changes = emptySyncData();
  for (const [id, item] of winners) {
    if (mine.get(id) === item) continue;
    if ("tombstone" in item) changes.tombstones.push(item.tombstone);
    else if (item.kind === "habit") changes.habits.push(item.record as SyncChanges["habits"][number]);
    else if (item.kind === "tag") changes.tags.push(item.record as SyncChanges["tags"][number]);
    else if (item.kind === "day") changes.days.push(item.record as SyncChanges["days"][number]);
    else if (item.kind === "task") changes.tasks!.push(item.record as NonNullable<SyncChanges["tasks"]>[number]);
    else if (item.kind === "area") changes.areas!.push(item.record as NonNullable<SyncChanges["areas"]>[number]);
    else if (item.kind === "goal") changes.goals!.push(item.record as NonNullable<SyncChanges["goals"]>[number]);
    else changes.entries.push(item.record as SyncChanges["entries"][number]);
  }
  return changes;
}

export function isEmpty(c: SyncChanges): boolean {
  return changeCount(c) === 0;
}

export function changeCount(c: SyncChanges): number {
  return c.habits.length + c.tags.length + c.days.length + c.entries.length + (c.tasks?.length ?? 0) + (c.areas?.length ?? 0) + (c.goals?.length ?? 0) + c.tombstones.length;
}
