import { useEffect, useMemo, useState } from "react";
import { todayKey } from "../domain/dates";
import type { HabitEntry } from "../domain/model";
import { entriesByDate } from "../domain/stats";
import { habitStreak, type Streak } from "../domain/streaks";
import { useStore } from "../store";

/** Current and best streak for every habit, as of today. Follows edits on the open day live. */
export function useStreaks(): Record<string, Streak> {
  const { repo, habits, date, entries, dataVersion } = useStore();
  const [history, setHistory] = useState<Record<string, Record<string, HabitEntry>>>({});
  const today = todayKey();

  useEffect(() => {
    let live = true;
    void (async () => {
      const from = await repo?.earliestDate();
      if (!repo || !from) return;
      const { entries: all } = await repo.loadRange(from, today);
      if (live) setHistory(entriesByDate(all));
    })();
    return () => { live = false; };
  }, [repo, today, dataVersion]);

  return useMemo(() => {
    const byDate = { ...history, [date]: entries as Record<string, HabitEntry> };
    return Object.fromEntries(habits.map((h) => [h.id, habitStreak(h, byDate, today)]));
  }, [history, date, entries, habits, today]);
}
