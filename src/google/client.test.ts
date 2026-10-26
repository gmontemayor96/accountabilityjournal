import { describe, expect, it, vi } from "vitest";
import { SqliteRepo } from "../data/sqliteRepo";
import type { Task } from "../domain/model";
import { memoryDriver } from "../test/sqlite";

// A tiny in-memory Google: token refresh, calendars and events, enough to drive googleSync.
const google = {
  calendars: new Map<string, Map<string, Record<string, unknown>>>(),
  primary: [] as Record<string, unknown>[],
  /** The sidebar's calendars, or "forbidden" for a sign-in without calendar-list access. */
  list: [] as Record<string, unknown>[] | "forbidden",
  feeds: {} as Record<string, Record<string, unknown>[]>,
  refreshes: 0,
};
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: async (url: string, init: RequestInit = {}) => {
    const json = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });
    const u = new URL(url);
    const method = init.method ?? "GET";
    if (u.host === "oauth2.googleapis.com") {
      google.refreshes++;
      return json(200, { access_token: "tok", expires_in: 3600 });
    }
    const path = decodeURIComponent(u.pathname.replace("/calendar/v3", ""));
    if (path === "/calendars" && method === "POST") {
      google.calendars.set("cal1", new Map());
      return json(200, { id: "cal1" });
    }
    if (path === "/users/me/calendarList") {
      return google.list === "forbidden" ? json(403, { error: { message: "Insufficient Permission" } }) : json(200, { items: google.list });
    }
    if (google.feeds[path.split("/")[2]] && path.endsWith("/events") && method === "GET") return json(200, { items: google.feeds[path.split("/")[2]] });
    if (path === "/calendars/primary/events" || path === "/calendars/me@x.com/events") {
      const page = u.searchParams.get("pageToken");
      return page ? json(200, { items: google.primary.slice(1) }) : json(200, { items: google.primary.slice(0, 1), nextPageToken: "p2" });
    }
    const m = path.match(/^\/calendars\/([^/]+)(?:\/events(?:\/([^/]+))?)?$/);
    const cal = m && google.calendars.get(m[1]);
    if (!m || !cal) return json(404, {});
    if (!m[2] && path.endsWith("/events") && method === "POST") {
      const body = JSON.parse(init.body as string);
      cal.set(body.id, body);
      return json(200, body);
    }
    if (!m[2]) return json(200, { id: m[1] });
    if (method === "PUT") {
      if (!cal.has(m[2])) return json(404, {});
      cal.set(m[2], { ...JSON.parse(init.body as string), id: m[2] });
      return json(200, {});
    }
    if (method === "DELETE") return cal.delete(m[2]) ? json(204, null) : json(410, {});
    return json(404, {});
  },
}));

const { G, googleSync, loadEventCache } = await import("./client");

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, notes: "", dueDate: "2026-10-27", dueTime: null, remindAt: null, doneAt: null, createdAt: "", tags: [], ...over,
});

describe("googleSync", () => {
  it("creates the calendar, pushes dated tasks, updates and deletes them, and caches events", async () => {
    const repo = new SqliteRepo(memoryDriver());
    await repo.setSetting(G.refreshToken, "r");
    google.list = [
      { id: "cal1", summary: "Identity" },
      { id: "fam", summary: "Family", backgroundColor: "#f00", selected: false },
      { id: "me@x.com", summary: "me@x.com", summaryOverride: "Jerry", backgroundColor: "#00f", primary: true },
      { id: "old", summary: "Hidden one", hidden: true },
    ];
    google.feeds = { fam: [{ id: "f1", summary: "Recital", start: { date: "2026-10-30" }, end: { date: "2026-10-31" } }] };
    google.primary = [
      { id: "e1", summary: "Lunch", start: { date: "2026-10-28" }, end: { date: "2026-10-29" } },
      { id: "e2", summary: "Gym", start: { date: "2026-10-29" }, end: { date: "2026-10-30" } },
    ];

    const first = await googleSync(repo, [task("a"), task("b", { dueTime: "09:30" }), task("nodate", { dueDate: null })]);
    expect(first.pushed).toBe(2);
    const cal = google.calendars.get("cal1")!;
    expect([...cal.values()].map((e) => e.summary).sort()).toEqual(["a", "b"]);
    // Every sidebar calendar but the app's own and hidden ones, primary first, with Google's ticks.
    expect(first.events.calendars).toEqual([
      { id: "me@x.com", name: "Jerry", color: "#00f", primary: true, selected: true },
      { id: "fam", name: "Family", color: "#f00", primary: false, selected: false },
    ]);
    expect(first.events.events.map((e) => [e.title, e.calendarId])).toEqual([["Lunch", "me@x.com"], ["Gym", "me@x.com"], ["Recital", "fam"]]);

    // Nothing changed: nothing is sent, and the cached events keep their timestamp.
    const again = await googleSync(repo, [task("a"), task("b", { dueTime: "09:30" })]);
    expect(again.pushed).toBe(0);
    expect(again.events.fetchedAt).toBe(first.events.fetchedAt);

    // Finish one, delete the other.
    const third = await googleSync(repo, [task("a", { doneAt: "x" })]);
    expect(third.pushed).toBe(2);
    expect([...cal.values()].map((e) => e.summary)).toEqual(["✓ a"]);
    expect((await loadEventCache(repo))?.events.length).toBe(3);
    expect(google.refreshes).toBe(1); // the access token is reused until it expires
  });

  it("falls back to the primary calendar when the sign-in can't read the calendar list", async () => {
    const repo = new SqliteRepo(memoryDriver());
    await repo.setSetting(G.refreshToken, "r");
    google.list = "forbidden";
    const { events } = await googleSync(repo, []);
    expect(events.primaryOnly).toBe(true);
    expect(events.calendars).toEqual([]);
    expect(events.events.map((e) => e.calendarId)).toEqual(["primary", "primary"]);
  });
});
