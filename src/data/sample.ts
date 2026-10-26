import { addDays, todayKey } from "../domain/dates";
import type { Area, Day, Goal, Habit, HabitEntry, Tag, Task } from "../domain/model";
import { isDue } from "../domain/schedule";

const now = "2026-10-01T00:00:00.000Z";
const base = { archivedAt: null, createdAt: now, fields: [], tags: [] as string[] };

/** Small deterministic random generator, so the preview looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Example habits and six weeks of history for the browser preview only. The desktop app starts empty. */
export function sampleData(today = todayKey()): { habits: Habit[]; tags: Tag[]; days: Record<string, Day>; entries: Record<string, HabitEntry>; tasks: Task[]; areas: Area[]; goals: Goal[]; settings: Record<string, string> } {
  const tags: Tag[] = [
    { id: "fitness", name: "fitness", color: "#E07A5F" },
    { id: "mind", name: "mind", color: "#9B6BD6" },
    { id: "health", name: "health", color: "#3D8BD9" },
    { id: "deep-work", name: "deep work", color: "#2FA37A" },
    { id: "travel", name: "travel", color: "#3FA3B5" },
  ];
  const habits: Habit[] = [
    { ...base, id: "h_run", name: "Morning run", identity: "I am a runner.", color: "#E07A5F", type: "duration", target: 30, unit: "min",
      schedule: { kind: "weekdays", days: [1, 2, 4, 6] }, sortOrder: 0, tags: ["fitness"],
      fields: [{ id: "f_dist", label: "Distance (km)", kind: "number" }, { id: "f_route", label: "Route", kind: "text" }] },
    { ...base, id: "h_read", name: "Read", identity: "I am a reader.", color: "#3D8BD9", type: "count", target: 20, unit: "pages",
      schedule: { kind: "daily" }, sortOrder: 1, tags: ["mind"], fields: [{ id: "f_book", label: "Book", kind: "text" }] },
    { ...base, id: "h_med", name: "Meditate", identity: "I am calm under pressure.", color: "#9B6BD6", type: "check", target: null, unit: "",
      schedule: { kind: "daily" }, sortOrder: 2, tags: ["mind", "health"] },
    { ...base, id: "h_energy", name: "Energy level", identity: "", color: "#7F9440", type: "scale", target: null, unit: "",
      schedule: { kind: "daily" }, sortOrder: 3, tags: ["health"] },
  ];
  const journals = [
    "Slept well. The run felt easy and I stayed off the phone at night.",
    "Busy day at work. Skipped the run but read on the train.",
    "Felt scattered in the morning. Ten minutes of meditation helped more than coffee.",
    "Deep work block from 9 to 12, the best focus in weeks.",
    "Low energy, probably the late night. Early bed tonight.",
  ];
  const r = rng(7);
  const days: Record<string, Day> = {};
  const entries: Record<string, HabitEntry> = {};
  for (let i = 42; i >= 1; i--) {
    const date = addDays(today, -i);
    const good = r();
    for (const h of habits) {
      if (!isDue(h.schedule, date) || r() > 0.45 + good * 0.5) continue;
      const value = h.type === "check" ? 1 : h.type === "scale" ? 2 + Math.floor(r() * 4) : h.type === "duration" ? 20 + Math.floor(r() * 5) * 5 : 8 + Math.floor(r() * 20);
      const note = h.id === "h_run" && r() < 0.3 ? "River loop" : h.id === "h_read" && r() < 0.2 ? "Finished a chapter" : "";
      entries[`${h.id}|${date}`] = { habitId: h.id, date, value, note, fields: {}, loggedAt: `${date}T0${6 + Math.floor(r() * 3)}:30:00.000Z` };
    }
    const tag = r();
    days[date] = {
      date,
      journal: r() < 0.55 ? journals[Math.floor(r() * journals.length)] : "",
      mood: r() < 0.6 ? Math.min(4, Math.round(good * 4)) : null,
      tags: tag < 0.15 ? ["travel"] : tag < 0.35 ? ["deep-work"] : [],
    };
  }
  const task = (id: string, title: string, dueDate: string | null, over: Partial<Task> = {}): Task =>
    ({ id, title, notes: "", dueDate, dueTime: null, remindAt: null, doneAt: null, createdAt: now, tags: [], ...over });
  // Example areas and goals, with tasks linked to the shortest ones.
  const areas = [
    { id: "a_health", name: "Health", color: "#2FA37A", sortOrder: 0, createdAt: now },
    { id: "a_career", name: "Career", color: "#3D8BD9", sortOrder: 1, createdAt: now },
  ];
  const goal = (id: string, areaId: string, horizon: Goal["horizon"], title: string, parentId: string | null = null, doneAt: string | null = null): Goal =>
    ({ id, areaId, parentId, title, notes: "", horizon, doneAt, createdAt: now });
  const goals = [
    goal("g_strong", "a_health", "10y", "Stay strong and mobile into my 50s"),
    goal("g_marathon", "a_health", "5y", "Run a marathon", "g_strong"),
    goal("g_half", "a_health", "year", "Run a half marathon", "g_marathon"),
    goal("g_10k", "a_health", "month", "Run 10k without stopping", "g_half"),
    goal("g_base", "a_health", "month", "Build up to 30 km a week", "g_half"),
    goal("g_week", "a_health", "week", "Run three times this week", "g_10k"),
    goal("g_shoes", "a_health", "day", "Sort out running gear", "g_week", `${addDays(today, -1)}T18:00:00.000Z`),
    goal("g_lead", "a_career", "5y", "Lead a team"),
    goal("g_course", "a_career", "year", "Finish a management course", "g_lead"),
  ];
  const tasks = [
    task("t_dentist", "Book the dentist", today, { dueTime: "10:00", remindAt: `${today}T09:45`, tags: ["health"] }),
    task("t_shoes", "Replace running shoes", addDays(today, -1), { tags: ["fitness"], goalId: "g_week" }),
    task("t_run1", "Easy 5k run", addDays(today, -2), { tags: ["fitness"], goalId: "g_week", doneAt: `${addDays(today, -2)}T07:30:00.000Z` }),
    task("t_run2", "Intervals at the track", addDays(today, 2), { tags: ["fitness"], goalId: "g_week" }),
    task("t_enrol", "Pick a management course", addDays(today, 5), { goalId: "g_course" }),
    task("t_trip", "Pack for the weekend", addDays(today, 3), { notes: "Charger, book, rain jacket", tags: ["travel"] }),
    task("t_tax", "Send tax documents", addDays(today, 9)),
    task("t_library", "Return library books", null, { tags: ["mind"] }),
    task("t_plants", "Water the plants", addDays(today, -2), { doneAt: `${addDays(today, -2)}T18:00:00.000Z` }),
  ];
  // Example Google Calendar events, as the desktop app would cache them.
  const calendars = [
    { id: "me@example.com", name: "Personal", color: "#039be5", primary: true, selected: true },
    { id: "work@example.com", name: "Work", color: "#33b679", primary: false, selected: true },
    { id: "holidays", name: "Holidays", color: "#e67c73", primary: false, selected: false },
  ];
  const ev = (id: string, calendarId: string, title: string, date: string, startTime: string | null, endTime: string | null, endDate = date) =>
    ({ id, title, startDate: date, startTime, endDate, endTime, calendarId });
  const events = [
    ev("g1", "work@example.com", "Team standup", today, "09:30", "09:45"),
    ev("g2", "me@example.com", "Lunch with Sam", today, "12:30", "13:30"),
    ev("g3", "me@example.com", "Weekend away", addDays(today, 4), null, null, addDays(today, 6)),
    ev("g4", "me@example.com", "Dentist", addDays(today, 2), "15:00", "15:45"),
    ev("g5", "work@example.com", "Quarterly review", addDays(today, 1), "14:00", "15:00"),
    ev("g6", "holidays", "Public holiday", addDays(today, 7), null, null),
  ];
  const settings = { "google.events": JSON.stringify({ fetchedAt: now, events, calendars }) };
  return { habits, tags, days, entries, tasks, areas, goals, settings };
}
