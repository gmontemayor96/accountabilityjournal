import type { Day, Habit, HabitEntry, Tag } from "../domain/model";

/** Everything the app reads and writes. Screens never talk to storage directly. */
export interface Repo {
  loadHabits(): Promise<Habit[]>;
  saveHabit(habit: Habit): Promise<void>;
  setHabitArchived(id: string, archivedAt: string | null): Promise<void>;

  loadTags(): Promise<Tag[]>;
  saveTag(tag: Tag): Promise<void>;

  loadDay(date: string): Promise<{ day: Day; entries: HabitEntry[] }>;
  saveDay(day: Day): Promise<void>;
  saveEntry(entry: HabitEntry): Promise<void>;
  deleteEntry(habitId: string, date: string): Promise<void>;
}
