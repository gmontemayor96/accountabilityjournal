import type { Habit, Tag } from "../domain/model";

const now = "2026-10-01T00:00:00.000Z";
const base = { archivedAt: null, createdAt: now, fields: [], tags: [] as string[] };

/** Example habits for the browser preview only. The desktop app starts empty. */
export function sampleData(): { habits: Habit[]; tags: Tag[] } {
  return {
    tags: [
      { id: "fitness", name: "fitness", color: "#E07A5F" },
      { id: "mind", name: "mind", color: "#9B6BD6" },
      { id: "health", name: "health", color: "#3D8BD9" },
    ],
    habits: [
      { ...base, id: "h_run", name: "Morning run", identity: "I am a runner.", color: "#E07A5F", type: "duration", target: 30, unit: "min",
        schedule: { kind: "weekdays", days: [1, 2, 4, 6] }, sortOrder: 0, tags: ["fitness"],
        fields: [{ id: "f_dist", label: "Distance (km)", kind: "number" }, { id: "f_route", label: "Route", kind: "text" }] },
      { ...base, id: "h_read", name: "Read", identity: "I am a reader.", color: "#3D8BD9", type: "count", target: 20, unit: "pages",
        schedule: { kind: "daily" }, sortOrder: 1, tags: ["mind"], fields: [{ id: "f_book", label: "Book", kind: "text" }] },
      { ...base, id: "h_med", name: "Meditate", identity: "I am calm under pressure.", color: "#9B6BD6", type: "check", target: null, unit: "",
        schedule: { kind: "daily" }, sortOrder: 2, tags: ["mind", "health"] },
      { ...base, id: "h_energy", name: "Energy level", identity: "", color: "#7F9440", type: "scale", target: null, unit: "",
        schedule: { kind: "daily" }, sortOrder: 3, tags: ["health"] },
    ],
  };
}
