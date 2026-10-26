import { useMemo } from "react";
import { visibleEvents } from "../google/events";
import { useStore } from "../store";

/** Google events from the calendars that are switched on, plus each calendar's colour. */
export function useVisibleEvents() {
  const events = useStore((s) => s.events);
  const calendars = useStore((s) => s.calendars);
  const choices = useStore((s) => s.calendarChoices);
  return useMemo(() => ({
    events: visibleEvents(events, calendars, choices),
    colorOf: (calendarId?: string) => calendars.find((c) => c.id === calendarId)?.color,
  }), [events, calendars, choices]);
}
