import { eventsOn, eventTimeLabel } from "../google/events";
import { useVisibleEvents } from "../hooks/useVisibleEvents";

/** The day's Google Calendar events, read-only. Renders nothing when there are none. */
export function EventList({ date, heading }: { date: string; heading?: React.ReactNode }) {
  const { events: all, colorOf } = useVisibleEvents();
  const events = eventsOn(all, date);
  if (!events.length) return null;
  return (
    <>
      {heading}
      <ul className="events">
        {events.map((e) => (
          <li key={`${e.calendarId}/${e.id}`} style={{ borderLeftColor: colorOf(e.calendarId) }}>
            <span className="etime">{eventTimeLabel(e, date)}</span>
            <span className="etitle">{e.title}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
