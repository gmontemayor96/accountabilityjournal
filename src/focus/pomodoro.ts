/** Pomodoro timer: focus sessions with short breaks, and a long break every few sessions. */

export type Phase = "focus" | "short" | "long";

export interface PomodoroSettings {
  /** Minutes. */
  focus: number;
  short: number;
  long: number;
  /** Focus sessions before a long break. */
  longEvery: number;
  /** Start the next phase straight away when one ends. */
  autoStart: boolean;
  /** Play a chime when a phase ends while the app is open. */
  sound: boolean;
}

export interface PomodoroState {
  phase: Phase;
  /** Focus sessions finished since the last long break. */
  round: number;
  /** When the running phase ends (ISO); null while paused or not started. */
  endsAt: string | null;
  /** Milliseconds left while paused. */
  remaining: number;
  /** What the focus time counts toward: a duration habit gets the minutes, a task is shown. */
  habitId: string | null;
  taskId: string | null;
}

/** Focus sessions and minutes per day (YYYY-MM-DD), kept for a few weeks. */
export type FocusLog = Record<string, { sessions: number; minutes: number }>;

export const DEFAULT_SETTINGS: PomodoroSettings = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false, sound: true };

export const PRESETS: { label: string; settings: Pick<PomodoroSettings, "focus" | "short" | "long" | "longEvery"> }[] = [
  { label: "Classic 25 / 5", settings: { focus: 25, short: 5, long: 15, longEvery: 4 } },
  { label: "Deep 50 / 10", settings: { focus: 50, short: 10, long: 30, longEvery: 3 } },
  { label: "Sprint 15 / 3", settings: { focus: 15, short: 3, long: 10, longEvery: 4 } },
];

export const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

const clampMin = (n: unknown, fallback: number, max: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 1 ? Math.min(v, max) : fallback;
};

/** Reads stored settings, filling gaps and keeping numbers sensible. */
export function cleanSettings(raw: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const r = raw ?? {};
  return {
    focus: clampMin(r.focus, DEFAULT_SETTINGS.focus, 180),
    short: clampMin(r.short, DEFAULT_SETTINGS.short, 60),
    long: clampMin(r.long, DEFAULT_SETTINGS.long, 120),
    longEvery: clampMin(r.longEvery, DEFAULT_SETTINGS.longEvery, 12),
    autoStart: typeof r.autoStart === "boolean" ? r.autoStart : DEFAULT_SETTINGS.autoStart,
    sound: typeof r.sound === "boolean" ? r.sound : DEFAULT_SETTINGS.sound,
  };
}

export const phaseMs = (s: PomodoroSettings, phase: Phase) => s[phase] * 60_000;

export function idleState(s: PomodoroSettings): PomodoroState {
  return { phase: "focus", round: 0, endsAt: null, remaining: phaseMs(s, "focus"), habitId: null, taskId: null };
}

/** The phase after this one: a break after focus (long every few sessions), focus after a break. */
export function nextPhase(state: Pick<PomodoroState, "phase" | "round">, s: PomodoroSettings): { phase: Phase; round: number } {
  if (state.phase !== "focus") return { phase: "focus", round: state.phase === "long" ? 0 : state.round };
  const round = state.round + 1;
  return { phase: round >= s.longEvery ? "long" : "short", round };
}

/** Milliseconds left in the current phase. */
export function timeLeft(state: PomodoroState, now: Date): number {
  return state.endsAt ? Math.max(0, Date.parse(state.endsAt) - now.getTime()) : state.remaining;
}

/**
 * Moves past every phase that has ended by `now`, as happens after the app was asleep.
 * With auto-start, each next phase begins when the last one ended; without it, the next phase waits.
 * Returns the phases that finished, oldest first, so focus time can be counted.
 */
export function advance(state: PomodoroState, s: PomodoroSettings, now: Date): { state: PomodoroState; finished: { phase: Phase; endedAt: Date }[] } {
  const finished: { phase: Phase; endedAt: Date }[] = [];
  let cur = state;
  for (let i = 0; i < 100 && cur.endsAt && Date.parse(cur.endsAt) <= now.getTime(); i++) {
    const endedAt = new Date(cur.endsAt);
    finished.push({ phase: cur.phase, endedAt });
    const next = nextPhase(cur, s);
    const length = phaseMs(s, next.phase);
    cur = {
      ...cur,
      ...next,
      endsAt: s.autoStart ? new Date(endedAt.getTime() + length).toISOString() : null,
      remaining: length,
    };
  }
  return { state: cur, finished };
}

/** When upcoming phases end, for alarms while the app is closed: just this one, or several with auto-start. */
export function upcomingEnds(state: PomodoroState, s: PomodoroSettings, count = 8): { phase: Phase; next: Phase; at: Date }[] {
  const out: { phase: Phase; next: Phase; at: Date }[] = [];
  let cur = state;
  while (cur.endsAt && out.length < count) {
    const at = new Date(cur.endsAt);
    const next = nextPhase(cur, s);
    out.push({ phase: cur.phase, next: next.phase, at });
    if (!s.autoStart) break;
    cur = { ...cur, ...next, endsAt: new Date(at.getTime() + phaseMs(s, next.phase)).toISOString() };
  }
  return out;
}

/** Adds a finished focus session to the log, dropping days older than about two months. */
export function logFocus(log: FocusLog, date: string, minutes: number): FocusLog {
  const day = log[date] ?? { sessions: 0, minutes: 0 };
  const next = { ...log, [date]: { sessions: day.sessions + 1, minutes: day.minutes + minutes } };
  const keep = Object.keys(next).sort().slice(-60);
  return Object.fromEntries(keep.map((k) => [k, next[k]]));
}

export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function endMessage(phase: Phase, next: Phase): { title: string; body: string } {
  if (phase === "focus") return { title: "Focus session done", body: next === "long" ? "Time for a long break." : "Time for a short break." };
  return { title: "Break's over", body: "Ready for the next focus session." };
}
