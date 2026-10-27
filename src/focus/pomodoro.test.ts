import { describe, expect, it } from "vitest";
import { advance, cleanSettings, DEFAULT_SETTINGS, formatClock, idleState, logFocus, nextPhase, timeLeft, upcomingEnds } from "./pomodoro";

const s = { ...DEFAULT_SETTINGS, focus: 25, short: 5, long: 15, longEvery: 2 };
const t0 = new Date("2026-10-27T09:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const running = (phase: "focus" | "short" | "long", round: number, endsMin: number) =>
  ({ ...idleState(s), phase, round, endsAt: at(endsMin).toISOString() });

describe("pomodoro", () => {
  it("cleans stored settings", () => {
    expect(cleanSettings({ focus: 0, short: 7.4, long: 999, longEvery: "x" as unknown as number, autoStart: true }))
      .toEqual({ ...DEFAULT_SETTINGS, short: 7, long: 120, autoStart: true });
  });

  it("goes focus, short break, focus, long break, then starts over", () => {
    let p = { phase: "focus" as const, round: 0 } as { phase: "focus" | "short" | "long"; round: number };
    const seen = [];
    for (let i = 0; i < 5; i++) seen.push((p = nextPhase(p, s)).phase);
    expect(seen).toEqual(["short", "focus", "long", "focus", "short"]);
  });

  it("waits at the next phase when auto-start is off", () => {
    const { state, finished } = advance(running("focus", 0, 25), s, at(40));
    expect(finished.map((f) => f.phase)).toEqual(["focus"]);
    expect(state).toMatchObject({ phase: "short", round: 1, endsAt: null, remaining: 5 * 60_000 });
    expect(timeLeft(state, at(60))).toBe(5 * 60_000);
  });

  it("catches up on several phases with auto-start, timing each from the last one's end", () => {
    const auto = { ...s, autoStart: true };
    // Focus ends at 25, short break at 30, focus at 55; at 60 we're 5 minutes into the long break.
    const { state, finished } = advance(running("focus", 0, 25), auto, at(60));
    expect(finished.map((f) => f.phase)).toEqual(["focus", "short", "focus"]);
    expect(state.phase).toBe("long");
    expect(timeLeft(state, at(60))).toBe(10 * 60_000);
  });

  it("lists upcoming ends for alarms", () => {
    expect(upcomingEnds(running("focus", 0, 25), s).map((e) => e.next)).toEqual(["short"]);
    const auto = upcomingEnds(running("focus", 0, 25), { ...s, autoStart: true }, 4);
    expect(auto.map((e) => [e.phase, e.at.toISOString()])).toEqual([
      ["focus", at(25).toISOString()], ["short", at(30).toISOString()], ["focus", at(55).toISOString()], ["long", at(70).toISOString()],
    ]);
    expect(upcomingEnds(idleState(s), s)).toEqual([]);
  });

  it("logs focus time per day", () => {
    const log = logFocus(logFocus({}, "2026-10-27", 25), "2026-10-27", 50);
    expect(log["2026-10-27"]).toEqual({ sessions: 2, minutes: 75 });
  });

  it("formats the clock", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(61_500)).toBe("1:02");
    expect(formatClock(0)).toBe("0:00");
  });
});
