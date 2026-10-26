import { describe, expect, it } from "vitest";
import "../habitTypes";
import type { Habit } from "../domain/model";
import { emptySyncData } from "../sync/types";
import { entriesCsv, journalCsv, parseBackup, toBackup } from "./exportFormats";

const at = "2026-10-26T00:00:00.000Z";
const run: Habit = {
  id: "h_run", name: "Run", identity: "", color: "#000", type: "duration", target: 30, unit: "min", schedule: { kind: "daily" },
  sortOrder: 0, createdAt: at, archivedAt: null, tags: [], fields: [{ id: "f1", label: "Route", kind: "text" }],
};
const data = {
  ...emptySyncData(),
  habits: [{ data: run, updatedAt: at }],
  tags: [{ data: { id: "mind", name: "mind", color: "#000" }, updatedAt: at }],
  days: [
    { data: { date: "2026-10-25", journal: 'Said "hi", then left', mood: 3, tags: ["mind"] }, updatedAt: at },
    { data: { date: "2026-10-24", journal: "", mood: null, tags: [] }, updatedAt: at },
  ],
  entries: [{ data: { habitId: "h_run", date: "2026-10-25", value: 35, note: "Hills, wet", fields: { f1: "River" }, loggedAt: at }, updatedAt: at }],
};

describe("export formats", () => {
  it("round-trips a backup and rejects other JSON", () => {
    expect(parseBackup(JSON.stringify(toBackup(data)))).toEqual(data);
    expect(parseBackup('{"format":"other"}')).toBeNull();
    expect(parseBackup("not json")).toBeNull();
  });

  it("writes entries as CSV with quoting and field labels", () => {
    expect(entriesCsv(data)).toBe('date,habit,value,unit,done,note,details\r\n2026-10-25,Run,35,min,yes,"Hills, wet",Route: River\r\n');
  });

  it("writes journal days as CSV, skipping empty ones", () => {
    expect(journalCsv(data)).toBe('date,mood,tags,journal\r\n2026-10-25,Good,mind,"Said ""hi"", then left"\r\n');
  });
});
