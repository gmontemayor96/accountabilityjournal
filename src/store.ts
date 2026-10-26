import { create } from "zustand";
import { openRepo, type Repo } from "./data";
import { todayKey } from "./domain/dates";
import { emptyDay, newId, PALETTE, slugTagId, type Day, type Habit, type HabitEntry, type Tag } from "./domain/model";

export type View = "day" | "habits" | "calendar" | "journal" | "tags";

interface State {
  repo: Repo | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  view: View;
  habits: Habit[];
  tags: Tag[];
  date: string;
  day: Day;
  entries: Record<string, HabitEntry>;

  init(): Promise<void>;
  setView(view: View): void;
  setDate(date: string): Promise<void>;

  logValue(habitId: string, value: number | null): void;
  setEntryNote(habitId: string, note: string): void;
  setEntryField(habitId: string, fieldId: string, value: string): void;

  setJournal(text: string): void;
  setMood(mood: number | null): void;
  toggleDayTag(tagId: string): void;

  createTag(name: string): Promise<string | null>;
  saveHabit(habit: Habit): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}

// Typing in notes and the journal saves after a short pause instead of on every key.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function debounce(key: string, fn: () => void, ms = 400) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
}

const reportError = (e: unknown) => console.error("Identity: failed to save", e);

export const useStore = create<State>((set, get) => {
  /** Writes the habit's entry for the current date, or removes it when nothing is left in it. */
  function persistEntry(habitId: string, immediate: boolean) {
    const { repo, date, entries } = get();
    if (!repo) return;
    const e = entries[habitId];
    const write = () => {
      const empty = !e || (e.value === null && !e.note && Object.values(e.fields).every((v) => !v));
      (empty ? repo.deleteEntry(habitId, date) : repo.saveEntry(e)).catch(reportError);
    };
    if (immediate) write();
    else debounce(`entry:${habitId}:${date}`, write);
  }

  function updateEntry(habitId: string, change: (e: HabitEntry) => HabitEntry) {
    const { date, entries } = get();
    const current = entries[habitId] ?? { habitId, date, value: null, note: "", fields: {}, loggedAt: new Date().toISOString() };
    set({ entries: { ...entries, [habitId]: change(current) } });
  }

  function updateDay(change: Partial<Day>, immediate: boolean) {
    const day = { ...get().day, ...change };
    set({ day });
    const write = () => get().repo?.saveDay(day).catch(reportError);
    if (immediate) write();
    else debounce(`day:${day.date}`, write);
  }

  return {
    repo: null,
    status: "loading",
    error: null,
    view: "day",
    habits: [],
    tags: [],
    date: todayKey(),
    day: emptyDay(todayKey()),
    entries: {},

    async init() {
      try {
        const repo = await openRepo();
        const [habits, tags] = await Promise.all([repo.loadHabits(), repo.loadTags()]);
        set({ repo, habits, tags });
        await get().setDate(get().date);
        set({ status: "ready" });
      } catch (e) {
        set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    setView: (view) => set({ view }),

    async setDate(date) {
      const repo = get().repo;
      if (!repo) return;
      const { day, entries } = await repo.loadDay(date);
      set({ date, day, entries: Object.fromEntries(entries.map((e) => [e.habitId, e])) });
    },

    logValue(habitId, value) {
      updateEntry(habitId, (e) => ({ ...e, value, loggedAt: e.value === null && value !== null ? new Date().toISOString() : e.loggedAt }));
      persistEntry(habitId, true);
    },
    setEntryNote(habitId, note) {
      updateEntry(habitId, (e) => ({ ...e, note }));
      persistEntry(habitId, false);
    },
    setEntryField(habitId, fieldId, value) {
      updateEntry(habitId, (e) => ({ ...e, fields: { ...e.fields, [fieldId]: value } }));
      persistEntry(habitId, false);
    },

    setJournal: (journal) => updateDay({ journal }, false),
    setMood: (mood) => updateDay({ mood }, true),
    toggleDayTag(tagId) {
      const tags = get().day.tags;
      updateDay({ tags: tags.includes(tagId) ? tags.filter((t) => t !== tagId) : [...tags, tagId] }, true);
    },

    async createTag(name) {
      const id = slugTagId(name);
      if (!id) return null;
      const { tags, repo } = get();
      if (!tags.some((t) => t.id === id)) {
        const tag = { id, name: name.trim(), color: PALETTE[tags.length % PALETTE.length] };
        await repo?.saveTag(tag);
        set({ tags: [...tags, tag].sort((a, b) => a.name.localeCompare(b.name)) });
      }
      return id;
    },

    async saveHabit(habit) {
      const { repo, habits } = get();
      await repo?.saveHabit(habit);
      const exists = habits.some((h) => h.id === habit.id);
      set({ habits: exists ? habits.map((h) => (h.id === habit.id ? habit : h)) : [...habits, habit] });
    },

    async setArchived(id, archived) {
      const archivedAt = archived ? new Date().toISOString() : null;
      await get().repo?.setHabitArchived(id, archivedAt);
      set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archivedAt } : h)) });
    },
  };
});

export function blankHabit(existing: Habit[]): Habit {
  return {
    id: newId("h"),
    name: "",
    identity: "",
    color: PALETTE[existing.length % PALETTE.length],
    type: "check",
    target: null,
    unit: "",
    schedule: { kind: "daily" },
    sortOrder: existing.reduce((m, h) => Math.max(m, h.sortOrder + 1), 0),
    createdAt: new Date().toISOString(),
    archivedAt: null,
    tags: [],
    fields: [],
  };
}
