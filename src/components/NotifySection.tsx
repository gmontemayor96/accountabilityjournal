import { useState } from "react";
import { isAndroid } from "../sync/io";
import { REMIND_OPTIONS, type RemindKey } from "../tasks/reminders";
import { useStore } from "../store";

/** Notification choices for this device, shown on the Data screen. */
export function NotifySection() {
  const { notify, setNotify, testNotification } = useStore();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const test = async () => {
    const ok = await testNotification();
    setMessage(ok
      ? { text: "Sent. If nothing appeared, check that notifications for Identity are allowed in your system settings." }
      : { text: "Notifications are blocked for Identity. Allow them in your system settings, then try again.", error: true });
  };

  return (
    <>
      <h2 className="sectionhead">Notifications</h2>
      <div className="field">
        <span className="label">On this device</span>
        <div className="seg">
          <button type="button" aria-pressed={notify.enabled} onClick={() => void setNotify({ enabled: true })}>On</button>
          <button type="button" aria-pressed={!notify.enabled} onClick={() => void setNotify({ enabled: false })}>Off</button>
        </div>
        <p className="hint">
          Habits remind you at the times set in each habit, on days they're due and not yet logged. Tasks remind you at their reminder time.
          {isAndroid
            ? " Reminders arrive with the app closed. Habit reminders are planned a week ahead, so open the app at least once a week."
            : " On Windows, reminders appear while Identity is running."}
        </p>
      </div>
      <div className="field">
        <label className="label" htmlFor="notify-task-default">Reminder for new tasks</label>
        <select id="notify-task-default" value={notify.taskDefault} onChange={(e) => void setNotify({ taskDefault: e.target.value as RemindKey })}>
          {REMIND_OPTIONS.filter((o) => o.key !== "custom").map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <p className="hint">New tasks with a due date start with this reminder. You can change it on each task.</p>
      </div>
      <div className="inline">
        <button className="btn" onClick={() => void test()}>Send a test notification</button>
      </div>
      {message && <p className={message.error ? "error" : "hint"} role="status">{message.text}</p>}
    </>
  );
}
