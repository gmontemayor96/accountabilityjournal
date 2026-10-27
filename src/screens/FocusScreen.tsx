import { useEffect, useState } from "react";
import { Ring } from "../components/Ring";
import { addDays, todayKey } from "../domain/dates";
import { formatClock, PHASE_LABEL, phaseMs, PRESETS, timeLeft, type PomodoroSettings } from "../focus/pomodoro";
import { useStore } from "../store";

/** Re-renders every second while mounted, and moves the timer on in the browser preview too. */
export function useTick() {
  const tick = useStore((s) => s.tickPomodoro);
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      void tick();
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);
}

export function FocusScreen() {
  useTick();
  const { pomodoro, habits, tasks, pomodoroStart, pomodoroPause, pomodoroReset, pomodoroSkip, pomodoroSettings, pomodoroLink, toggleTask } = useStore();
  const { settings, state, log } = pomodoro;
  const left = timeLeft(state, new Date());
  const running = !!state.endsAt;
  const total = phaseMs(settings, state.phase);
  const color = state.phase === "focus" ? "var(--accent)" : "var(--break, #3D8BD9)";
  const durationHabits = habits.filter((h) => !h.archivedAt && h.type === "duration");
  const openTasks = tasks.filter((t) => !t.doneAt);
  const task = state.taskId ? tasks.find((t) => t.id === state.taskId) : undefined;
  const habit = state.habitId ? habits.find((h) => h.id === state.habitId) : undefined;
  const today = todayKey();
  const todayLog = log[today] ?? { sessions: 0, minutes: 0 };
  const week = Array.from({ length: 7 }, (_, i) => log[addDays(today, -i)]?.minutes ?? 0).reduce((a, b) => a + b, 0);
  const link = state.habitId ? `h:${state.habitId}` : state.taskId ? `t:${state.taskId}` : "";

  useEffect(() => {
    document.title = running ? `${formatClock(left)} · ${PHASE_LABEL[state.phase]} · Identity` : "Identity";
    return () => { document.title = "Identity"; };
  }, [running, left, state.phase]);

  const num = (key: keyof PomodoroSettings, label: string, max: number, hint?: string) => (
    <label className="pfield">
      <span className="label">{label}</span>
      <input type="number" min={1} max={max} value={settings[key] as number}
        onChange={(e) => e.target.value && void pomodoroSettings({ [key]: Number(e.target.value) })} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Focus</h1>
          <div className="sub">A pomodoro timer: focus, take a short break, and a longer one every few rounds.</div>
        </div>
      </header>
      <section className="canvas focuspage">
        <div className="timer">
          <div className="dial">
            <Ring pct={1 - left / total} size={240} color={color} />
            <div className="readout">
              <span className="phase">{PHASE_LABEL[state.phase]}</span>
              <span className="clock" role="timer" aria-live="off">{formatClock(left)}</span>
              <span className="rounds" aria-label={`${state.round} of ${settings.longEvery} focus sessions before a long break`}>
                {Array.from({ length: settings.longEvery }, (_, i) => <span key={i} className={i < state.round ? "on" : undefined} />)}
              </span>
            </div>
          </div>
          <div className="controls">
            <button className="btn primary big" onClick={() => void (running ? pomodoroPause() : pomodoroStart())}>
              {running ? "Pause" : left < total ? "Resume" : "Start"}
            </button>
            <button className="btn" onClick={() => void pomodoroReset()} disabled={!running && left === total}>Reset</button>
            <button className="btn" onClick={() => void pomodoroSkip()}>Skip to {state.phase === "focus" ? "break" : "focus"}</button>
          </div>
          {(state.round > 0 || state.phase !== "focus") && (
            <button className="linkbtn" onClick={() => void pomodoroReset(true)}>Start over from the first session</button>
          )}

          <div className="field working">
            <label className="label" htmlFor="focus-link">Working on</label>
            <select id="focus-link" value={link} onChange={(e) => {
              const v = e.target.value;
              void pomodoroLink({ habitId: v.startsWith("h:") ? v.slice(2) : null, taskId: v.startsWith("t:") ? v.slice(2) : null });
            }}>
              <option value="">Nothing in particular</option>
              {durationHabits.length > 0 && (
                <optgroup label="Habits (focus minutes are logged)">
                  {durationHabits.map((h) => <option key={h.id} value={`h:${h.id}`}>{h.name}</option>)}
                </optgroup>
              )}
              {openTasks.length > 0 && (
                <optgroup label="Tasks">
                  {openTasks.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.title}</option>)}
                </optgroup>
              )}
            </select>
            {habit && <span className="hint">Each finished focus session adds {settings.focus} min to {habit.name} for that day.</span>}
            {task && (
              <span className="hint">
                <button className="linkbtn" onClick={() => { void toggleTask(task.id); void pomodoroLink({ habitId: null, taskId: null }); }}>
                  Mark “{task.title}” done
                </button>
              </span>
            )}
          </div>

          <p className="focusstats">
            Today: <b>{todayLog.sessions}</b> session{todayLog.sessions === 1 ? "" : "s"}, <b>{todayLog.minutes}</b> min · Last 7 days: <b>{week}</b> min
          </p>
        </div>

        <div className="psettings">
          <h2 className="sectionhead first">Timer settings</h2>
          <div className="seg">
            {PRESETS.map((p) => {
              const on = (Object.keys(p.settings) as (keyof typeof p.settings)[]).every((k) => settings[k] === p.settings[k]);
              return <button key={p.label} type="button" aria-pressed={on} onClick={() => void pomodoroSettings(p.settings)}>{p.label}</button>;
            })}
          </div>
          <div className="pgrid">
            {num("focus", "Focus (min)", 180)}
            {num("short", "Short break (min)", 60)}
            {num("long", "Long break (min)", 120)}
            {num("longEvery", "Long break after", 12, "focus sessions")}
          </div>
          <label className="checkline">
            <input type="checkbox" checked={settings.autoStart} onChange={(e) => void pomodoroSettings({ autoStart: e.target.checked })} />
            Start the next phase automatically
          </label>
          <label className="checkline">
            <input type="checkbox" checked={settings.sound} onChange={(e) => void pomodoroSettings({ sound: e.target.checked })} />
            Play a chime when a phase ends
          </label>
          <p className="hint">
            You also get a notification when a phase ends, even with the app in the background on Android. Settings and the timer are kept on this device.
            A new length applies straight away if the timer hasn't started, otherwise from the next phase.
          </p>
        </div>
      </section>
    </>
  );
}

/** A small clock shown on other screens while the timer runs; tapping it opens Focus. */
export function FocusChip() {
  useTick();
  const { pomodoro, view, setView } = useStore();
  if (!pomodoro.state.endsAt || view === "focus") return null;
  return (
    <button className={`focuschip ${pomodoro.state.phase}`} onClick={() => setView("focus")} aria-label="Open the focus timer">
      {PHASE_LABEL[pomodoro.state.phase]} · {formatClock(timeLeft(pomodoro.state, new Date()))}
    </button>
  );
}
