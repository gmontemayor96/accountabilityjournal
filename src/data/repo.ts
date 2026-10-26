import type { Area, Day, Goal, Habit, HabitEntry, Tag, Task } from "../domain/model";
import type { SyncChanges, SyncData } from "../sync/types";

/** Everything the app reads and writes. Screens never talk to storage directly. */
export interface Repo {
  loadHabits(): Promise<Habit[]>;
  saveHabit(habit: Habit): Promise<void>;
  setHabitArchived(id: string, archivedAt: string | null): Promise<void>;

  loadTags(): Promise<Tag[]>;
  saveTag(tag: Tag): Promise<void>;
  /** Removes the tag from every habit, task and day as well. */
  deleteTag(id: string): Promise<void>;

  loadDay(date: string): Promise<{ day: Day; entries: HabitEntry[] }>;
  saveDay(day: Day): Promise<void>;
  saveEntry(entry: HabitEntry): Promise<void>;
  deleteEntry(habitId: string, date: string): Promise<void>;

  loadTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  deleteTask(id: string): Promise<void>;

  loadAreas(): Promise<Area[]>;
  saveArea(area: Area): Promise<void>;
  /** Deletes the area and its goals, and unlinks their tasks. */
  deleteArea(id: string): Promise<void>;
  loadGoals(): Promise<Goal[]>;
  saveGoal(goal: Goal): Promise<void>;
  /** Deletes the goal; its subgoals lose their parent and its tasks their goal. */
  deleteGoal(id: string): Promise<void>;

  /** Every day row and entry between two dates, inclusive. Days with nothing saved are left out. */
  loadRange(from: string, to: string): Promise<{ days: Day[]; entries: HabitEntry[] }>;
  /** The first date with any saved entry or day, or null when nothing has been logged yet. */
  earliestDate(): Promise<string | null>;

  /** Every record with the time it last changed, plus deletion tombstones, for the sync file. */
  snapshot(): Promise<SyncData>;
  /** Applies records and deletions merged from other devices, keeping their timestamps. */
  applyChanges(changes: SyncChanges): Promise<void>;

  /** Settings that belong to this device only (sync folder, device id). */
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
