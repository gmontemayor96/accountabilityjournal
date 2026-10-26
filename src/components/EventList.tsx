import { eventsOn, eventTimeLabel } from "../google/events";
import { useStore } from "../store";

/** The day's Google Calendar events, read-only. Renders nothing when there are none. */
export function EventList({ date, heading }: { date: string; heading?: React.ReactNode }) {
  const events = eventsOn(useStore((s) => s.events), date);
  if (!events.length) return null;
  return (
    <>
      {heading}
      <ul className="events">
        {events.map((e) => (
          <li key={e.id}>
            <span className="etime">{eventTimeLabel(e, date)}</span>
            <span className="etitle">{e.title}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
