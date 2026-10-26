import type { Repo } from "../data/repo";
import type { Task } from "../domain/model";
import { eventFingerprint, eventIdFor, fromGoogle, planPush, taskToEvent, type CalEvent, type CalInfo, type EventCache, type GoogleEvent } from "./events";

export const G = {
  clientId: "google.clientId",
  clientSecret: "google.clientSecret",
  refreshToken: "google.refreshToken",
  accessToken: "google.accessToken",
  expiresAt: "google.expiresAt",
  calendarId: "google.calendarId",
  pushed: "google.pushed",
  events: "google.events",
} as const;

// Create and manage the app's own calendar; read (never change) the user's calendar list and events.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ");
const CALENDAR_NAME = "Identity";
const API = "https://www.googleapis.com/calendar/v3";

let http: Promise<typeof import("@tauri-apps/plugin-http")> | undefined;
async function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  const { fetch } = await (http ??= import("@tauri-apps/plugin-http"));
  return fetch(url, init);
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenRequest(params: Record<string, string>): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const res = await httpFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body;
}

/** Opens Google's consent page in the browser and stores the tokens once the user agrees. */
export async function signIn(repo: Repo, clientId: string, clientSecret: string): Promise<void> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId, response_type: "code", scope: SCOPES, code_challenge: challenge, code_challenge_method: "S256",
    state, access_type: "offline", prompt: "consent",
  }).toString() + "&redirect_uri={redirect}";

  const { invoke } = await import("@tauri-apps/api/core");
  const { redirect_uri, query } = await invoke<{ redirect_uri: string; query: string }>("google_oauth", { authUrl: url });
  const q = new URLSearchParams(query);
  if (q.get("state") !== state) throw new Error("Google sign-in was interrupted. Please try again.");
  if (q.get("error")) throw new Error(q.get("error") === "access_denied" ? "Google access was not allowed." : `Google sign-in failed: ${q.get("error")}`);

  const tok = await tokenRequest({
    code: q.get("code") ?? "", client_id: clientId, client_secret: clientSecret, redirect_uri, grant_type: "authorization_code", code_verifier: verifier,
  });
  if (!tok.refresh_token) throw new Error("Google didn't grant offline access. Remove Identity from your Google account's third-party access and sign in again.");
  await repo.setSetting(G.clientId, clientId);
  await repo.setSetting(G.clientSecret, clientSecret);
  await repo.setSetting(G.refreshToken, tok.refresh_token);
  await repo.setSetting(G.accessToken, tok.access_token);
  await repo.setSetting(G.expiresAt, String(Date.now() + tok.expires_in * 1000));
}

export async function signOut(repo: Repo): Promise<void> {
  for (const k of [G.refreshToken, G.accessToken, G.expiresAt, G.calendarId, G.pushed]) await repo.setSetting(k, "");
}

export async function isConnected(repo: Repo): Promise<boolean> {
  return !!(await repo.getSetting(G.refreshToken));
}

async function accessToken(repo: Repo): Promise<string> {
  const token = await repo.getSetting(G.accessToken);
  if (token && Number(await repo.getSetting(G.expiresAt)) > Date.now() + 60_000) return token;
  const tok = await tokenRequest({
    client_id: (await repo.getSetting(G.clientId)) ?? "",
    client_secret: (await repo.getSetting(G.clientSecret)) ?? "",
    refresh_token: (await repo.getSetting(G.refreshToken)) ?? "",
    grant_type: "refresh_token",
  });
  await repo.setSetting(G.accessToken, tok.access_token);
  await repo.setSetting(G.expiresAt, String(Date.now() + tok.expires_in * 1000));
  return tok.access_token;
}

async function api<T>(repo: Repo, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await httpFetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(repo)}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T;
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? String(res.status);
    throw Object.assign(new Error(`Google Calendar: ${msg}`), { status: res.status });
  }
  return { status: res.status, data };
}

/** The "Identity" calendar this app owns, created on first use. */
async function ownCalendar(repo: Repo): Promise<string> {
  const saved = await repo.getSetting(G.calendarId);
  if (saved && (await api(repo, "GET", `/calendars/${encodeURIComponent(saved)}`)).status === 200) return saved;
  const { data } = await api<{ id: string }>(repo, "POST", "/calendars", { summary: CALENDAR_NAME, description: "Tasks from the Identity app." });
  await repo.setSetting(G.calendarId, data.id);
  await repo.setSetting(G.pushed, "{}");
  return data.id;
}

async function pushTasks(repo: Repo, tasks: Task[]): Promise<number> {
  const cal = encodeURIComponent(await ownCalendar(repo));
  const pushed: Record<string, string> = JSON.parse((await repo.getSetting(G.pushed)) || "{}");
  const { upsert, remove } = planPush(tasks, pushed);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const t of upsert) {
    const id = eventIdFor(t.id);
    const body = taskToEvent(t, tz)!;
    const put = await api(repo, "PUT", `/calendars/${cal}/events/${id}`, body);
    if (put.status === 404 || put.status === 410) await api(repo, "POST", `/calendars/${cal}/events`, { ...body, id });
    pushed[t.id] = eventFingerprint(t);
    await repo.setSetting(G.pushed, JSON.stringify(pushed)); // save as we go, so a failure halfway isn't redone
  }
  for (const taskId of remove) {
    await api(repo, "DELETE", `/calendars/${cal}/events/${eventIdFor(taskId)}`);
    delete pushed[taskId];
    await repo.setSetting(G.pushed, JSON.stringify(pushed));
  }
  return upsert.length + remove.length;
}

interface GoogleCalendar { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; selected?: boolean; hidden?: boolean }

/**
 * The calendars in the user's Google sidebar, without the app's own (its tasks already show as tasks).
 * Null when the sign-in has no calendar-list access (connected before it was asked for).
 */
async function fetchCalendars(repo: Repo, own: string): Promise<CalInfo[] | null> {
  const out: CalInfo[] = [];
  let page = "";
  try {
    do {
      const qs = new URLSearchParams({ maxResults: "250", ...(page ? { pageToken: page } : {}) });
      const { data } = await api<{ items?: GoogleCalendar[]; nextPageToken?: string }>(repo, "GET", `/users/me/calendarList?${qs}`);
      for (const c of data.items ?? []) {
        if (c.id === own || c.hidden) continue;
        out.push({ id: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || "#9e9e9e", primary: !!c.primary, selected: c.selected !== false });
      }
      page = data.nextPageToken ?? "";
    } while (page);
  } catch (e) {
    if ((e as { status?: number }).status === 403) return null;
    throw e;
  }
  // Primary first, like Google's sidebar; the rest in Google's order.
  return out.sort((a, b) => Number(b.primary) - Number(a.primary));
}

/** One calendar's events from 30 days back to 120 days ahead. */
async function fetchEvents(repo: Repo, calendarId: string): Promise<CalEvent[]> {
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 120 * 86_400_000).toISOString();
  const out: CalEvent[] = [];
  let page = "";
  do {
    const qs = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", maxResults: "2500", ...(page ? { pageToken: page } : {}) });
    const { status, data } = await api<{ items?: GoogleEvent[]; nextPageToken?: string }>(repo, "GET", `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`);
    if (status === 404 || status === 410) return out; // removed since the list was read
    for (const g of data.items ?? []) {
      const e = fromGoogle(g, calendarId);
      if (e) out.push(e);
    }
    page = data.nextPageToken ?? "";
  } while (page);
  return out;
}

/** Every calendar's events, or just the primary calendar's when the calendar list can't be read. */
async function fetchAll(repo: Repo): Promise<Omit<EventCache, "fetchedAt">> {
  const own = (await repo.getSetting(G.calendarId)) ?? "";
  const calendars = await fetchCalendars(repo, own);
  if (!calendars) return { events: await fetchEvents(repo, "primary"), calendars: [], primaryOnly: true };
  const events = (await Promise.all(calendars.map((c) => fetchEvents(repo, c.id)))).flat();
  return { events, calendars };
}

export async function loadEventCache(repo: Repo): Promise<EventCache | null> {
  try {
    return JSON.parse((await repo.getSetting(G.events)) || "null");
  } catch {
    return null;
  }
}

/** One round: send changed tasks to Google, then refresh the cached events. */
export async function googleSync(repo: Repo, tasks: Task[]): Promise<{ pushed: number; events: EventCache }> {
  const pushed = await pushTasks(repo, tasks);
  const fresh = await fetchAll(repo);
  const cached = await loadEventCache(repo);
  // Only a real change gets a new timestamp, so the sync file isn't rewritten every round.
  const same = (c: Omit<EventCache, "fetchedAt">) => JSON.stringify([c.events, c.calendars ?? [], !!c.primaryOnly]);
  if (cached && same(cached) === same(fresh)) return { pushed, events: cached };
  const events: EventCache = { fetchedAt: new Date().toISOString(), ...fresh };
  await repo.setSetting(G.events, JSON.stringify(events));
  return { pushed, events };
}
