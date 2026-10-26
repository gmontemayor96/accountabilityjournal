import { create } from "zustand";
import { isDesktopApp, openRepo, type Repo } from "./data";
import { todayKey } from "./domain/dates";
import { emptyDay, newId, PALETTE, slugTagId, type Day, type Habit, type HabitEntry, type Tag, type Task } from "./domain/model";
import { toBackup } from "./data/exportFormats";
import { writeBackup } from "./data/files";
import { changeCount, isEmpty, planMerge } from "./sync/merge";
import { syncOnce, type SyncResult } from "./sync/engine";
import type { SyncData } from "./sync/types";
import { dueReminders, remindersScheduledBySystem, scheduleAndroid, sentKey, showNow } from "./tasks/reminders";
import { googleSync, isConnected, loadEventCache, signIn, signOut } from "./google/client";
import type { CalEvent } from "./google/events";
import { isAndroid } from "./sync/io";
import { defaultDeviceName, tauriSyncIO } from "./sync/io";

export type View = "day" | "tasks" | "habits" | "calendar" | "journal" | "tags" | "sync";

interface State {
  repo: Repo | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  view: View;
  habits: Habit[];
  tags: Tag[];
  tasks: Task[];
  date: string;
  day: Day;
  entries: Record<string, HabitEntry>;
  /** Goes up whenever a sync brings in changes, so screens that load their own data reload. */
  dataVersion: number;
  syncing: boolean;
  lastSync: SyncResult | null;
  /** Google Calendar events (read-only), fetched by the desktop app and shared through sync. */
  events: CalEvent[];
  google: { connected: boolean; syncing: boolean; lastAt: string | null; error: string | null };
  connectGoogle(clientId: string, clientSecret: string): Promise<void>;
  disconnectGoogle(): Promise<void>;
  /** Sends changed tasks to Google Calendar and refreshes events. Desktop only. */
  googleSyncNow(): Promise<void>;

  init(): Promise<void>;
  /** Merges with the other devices' files in the sync folder, then writes ours. */
  syncNow(): Promise<void>;
  /** Writes today's backup if there isn't one yet. Returns the backup folder when it wrote one. */
  backupIfDue(): Promise<string | null>;
  /** Merges a backup or export into the database; newer versions win. Returns how many records changed. */
  importData(data: SyncData): Promise<number>;
  setView(view: View): void;
  setDate(date: string): Promise<void>;

  logValue(habitId: string, value: number | null): void;
  setEntryNote(habitId: string, note: string): void;
  setEntryField(habitId: string, fieldId: string, value: string): void;

  setJournal(text: string): void;
  setMood(mood: number | null): void;
  toggleDayTag(tagId: string): void;

  createTag(name: string): Promise<string | null>;
  updateTag(tag: Tag): Promise<void>;
  deleteTag(id: string): Promise<void>;
  /** Shows a date on the Today screen. */
  openDay(date: string): Promise<void>;
  saveHabit(habit: Habit): Promise<void>;
  /** The task open in the editor, or null. */
  editingTask: Task | null;
  editTask(task: Task | null): void;
  saveTask(task: Task): Promise<void>;
  toggleTask(id: string): Promise<void>;
  deleteTask(id: string): Promise<void>;
  /** Shows reminders that are due (desktop) or hands them to the system (Android). */
  checkReminders(): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}

// Typing in notes and the journal saves after a short pause instead of on every key.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function debounce(key: string, fn: () => void, ms = 400) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
}

const reportError = (e: unknown) => console.error("Identity: failed to save", e);

const WRITES = new Set(["saveHabit", "setHabitArchived", "saveTag", "deleteTag", "saveDay", "saveEntry", "deleteEntry", "saveTask", "deleteTask"]);

/** Calls `after` with the method name once any write to the repository finishes. */
function onWrites(repo: Repo, after: (method: string) => void): Repo {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (!WRITES.has(String(prop))) return value.bind(target);
      return async (...args: unknown[]) => {
        const result = await value.apply(target, args);
        after(String(prop));
        return result;
      };
    },
  });
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let googleTimer: ReturnType<typeof setTimeout> | undefined;
// Google sign-in uses a browser redirect to a local port, which only the desktop app can catch.
const googleCapable = isDesktopApp && !isAndroid;

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

  /** Reloads everything shown, after data changed underneath the screens (sync, import). */
  async function reloadAll() {
    const repo = get().repo;
    if (!repo) return;
    const [habits, tags, tasks] = await Promise.all([repo.loadHabits(), repo.loadTags(), repo.loadTasks()]);
    set({ habits, tags, tasks, dataVersion: get().dataVersion + 1 });
    void get().checkReminders();
    await get().setDate(get().date);
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
    tasks: [],
    editingTask: null,
    date: todayKey(),
    day: emptyDay(todayKey()),
    entries: {},
    dataVersion: 0,
    syncing: false,
    lastSync: null,
    events: [],
    google: { connected: false, syncing: false, lastAt: null, error: null },

    async init() {
      try {
        // Local edits are sent to the sync folder a few seconds after the last one.
        const scheduleSync = () => {
          clearTimeout(syncTimer);
          syncTimer = setTimeout(() => void get().syncNow(), 4000);
        };
        const repo = isDesktopApp
          ? onWrites(await openRepo(), (method) => {
              scheduleSync();
              if (method !== "saveTask" && method !== "deleteTask") return;
              clearTimeout(googleTimer);
              googleTimer = setTimeout(() => void get().googleSyncNow(), 5000);
            })
          : await openRepo();
        const [habits, tags, tasks] = await Promise.all([repo.loadHabits(), repo.loadTags(), repo.loadTasks()]);
        set({ repo, habits, tags, tasks });
        await get().setDate(get().date);
        set({ status: "ready", events: (await loadEventCache(repo))?.events ?? [], google: { ...get().google, connected: await isConnected(repo) } });
        if (isDesktopApp) {
          void get().backupIfDue();
          setInterval(() => void get().backupIfDue(), 3_600_000);
          void get().syncNow();
          void get().checkReminders();
          if (googleCapable) {
            void get().googleSyncNow();
            setInterval(() => void get().googleSyncNow(), 10 * 60_000);
          }
          if (!remindersScheduledBySystem) setInterval(() => void get().checkReminders(), 30_000);
          // Pick up other devices' changes when the app comes back into view, and every minute while open.
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void get().syncNow());
          window.addEventListener("focus", () => void get().syncNow());
          setInterval(() => document.visibilityState === "visible" && void get().syncNow(), 60_000);
        }
      } catch (e) {
        set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    async syncNow() {
      const { repo, syncing } = get();
      if (!repo || !isDesktopApp || syncing) return;
      // Typing is still waiting to be saved; try again once it has been.
      if (timers.size) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => void get().syncNow(), 2000);
        return;
      }
      set({ syncing: true });
      const result = await syncOnce(repo, tauriSyncIO, defaultDeviceName);
      set({ syncing: false, lastSync: result });
      if (result.status === "ok" && result.applied > 0 && !timers.size) {
        await reloadAll();
        void get().googleSyncNow();
      }
      set({ events: (await loadEventCache(repo))?.events ?? get().events });
    },

    async connectGoogle(clientId, clientSecret) {
      const repo = get().repo;
      if (!repo) return;
      await signIn(repo, clientId.trim(), clientSecret.trim());
      set({ google: { ...get().google, connected: true, error: null } });
      await get().googleSyncNow();
    },

    async disconnectGoogle() {
      const repo = get().repo;
      if (!repo) return;
      await signOut(repo);
      set({ google: { connected: false, syncing: false, lastAt: null, error: null } });
    },

    async googleSyncNow() {
      const { repo, google, tasks } = get();
      if (!repo || !googleCapable || !google.connected || google.syncing) return;
      set({ google: { ...google, syncing: true } });
      try {
        const { events } = await googleSync(repo, tasks);
        set({ events: events.events, google: { ...get().google, syncing: false, lastAt: new Date().toISOString(), error: null } });
        void get().syncNow(); // pass fresh events on to the phone
      } catch (e) {
        set({ google: { ...get().google, syncing: false, error: e instanceof Error ? e.message : String(e) } });
      }
    },

    async backupIfDue() {
      const repo = get().repo;
      if (!repo || !isDesktopApp) return null;
      const today = todayKey();
      if ((await repo.getSetting("backup.lastDate")) === today) return null;
      try {
        const folder = await writeBackup(`identity-backup-${today}.json`, JSON.stringify(toBackup(await repo.snapshot())));
        await repo.setSetting("backup.lastDate", today);
        return folder;
      } catch (e) {
        console.error("Identity: backup failed", e);
        return null;
      }
    },

    async importData(data) {
      const repo = get().repo;
      if (!repo) return 0;
      const changes = planMerge(await repo.snapshot(), [data]);
      if (isEmpty(changes)) return 0;
      await repo.applyChanges(changes);
      await reloadAll();
      void get().syncNow();
      return changeCount(changes);
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

    async updateTag(tag) {
      await get().repo?.saveTag(tag);
      set({ tags: get().tags.map((t) => (t.id === tag.id ? tag : t)).sort((a, b) => a.name.localeCompare(b.name)) });
    },

    async deleteTag(id) {
      await get().repo?.deleteTag(id);
      const { tags, habits, day, tasks } = get();
      set({
        tags: tags.filter((t) => t.id !== id),
        habits: habits.map((h) => ({ ...h, tags: h.tags.filter((t) => t !== id) })),
        tasks: tasks.map((t) => ({ ...t, tags: t.tags.filter((x) => x !== id) })),
        day: { ...day, tags: day.tags.filter((t) => t !== id) },
      });
    },

    async openDay(date) {
      await get().setDate(date);
      set({ view: "day" });
    },

    async saveHabit(habit) {
      const { repo, habits } = get();
      await repo?.saveHabit(habit);
      const exists = habits.some((h) => h.id === habit.id);
      set({ habits: exists ? habits.map((h) => (h.id === habit.id ? habit : h)) : [...habits, habit] });
    },

    editTask: (editingTask) => set({ editingTask }),

    async saveTask(task) {
      const { repo, tasks } = get();
      await repo?.saveTask(task);
      const exists = tasks.some((t) => t.id === task.id);
      set({ tasks: exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task] });
      void get().checkReminders();
    },

    async toggleTask(id) {
      const task = get().tasks.find((t) => t.id === id);
      if (task) await get().saveTask({ ...task, doneAt: task.doneAt ? null : new Date().toISOString() });
    },

    async deleteTask(id) {
      await get().repo?.deleteTask(id);
      set({ tasks: get().tasks.filter((t) => t.id !== id) });
      void get().checkReminders();
    },

    async checkReminders() {
      const { repo, tasks } = get();
      if (!repo || !isDesktopApp) return;
      try {
        if (remindersScheduledBySystem) return await scheduleAndroid(tasks);
        const sent = new Set<string>(JSON.parse((await repo.getSetting("reminders.sent")) ?? "[]"));
        const due = dueReminders(tasks, new Date(), sent);
        if (!due.length) return;
        for (const t of due) {
          await showNow(t);
          sent.add(sentKey(t));
        }
        // Keep only keys for reminders that still exist, so the list doesn't grow forever.
        const live = new Set(tasks.filter((t) => t.remindAt).map(sentKey));
        await repo.setSetting("reminders.sent", JSON.stringify([...sent].filter((k) => live.has(k))));
      } catch (e) {
        console.error("Identity: reminders failed", e);
      }
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

export function blankTask(dueDate: string | null = null): Task {
  return { id: newId("t"), title: "", notes: "", dueDate, dueTime: null, remindAt: null, doneAt: null, createdAt: new Date().toISOString(), tags: [] };
}
