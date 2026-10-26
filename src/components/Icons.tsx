const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;

export const Icons = {
  calendar: <svg viewBox="0 0 16 16" {...s}><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>,
  day: <svg viewBox="0 0 16 16" {...s}><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" /></svg>,
  habits: <svg viewBox="0 0 16 16" {...s}><path d="M2 4h2M2 8h2M2 12h2M6.5 4H14M6.5 8H14M6.5 12H14" /></svg>,
  journal: <svg viewBox="0 0 16 16" {...s}><path d="M3.5 1.8h8a1 1 0 0 1 1 1v10.4a1 1 0 0 1-1 1h-8z" /><path d="M6 5h4M6 7.5h4" /></svg>,
  tags: <svg viewBox="0 0 16 16" {...s}><path d="M1.8 8.6V2.2a.4.4 0 0 1 .4-.4h6.4l5.6 5.6-6.8 6.8z" /><circle cx="5" cy="5" r="1" /></svg>,
  sync: <svg viewBox="0 0 16 16" {...s}><path d="M13.5 6.5A5.5 5.5 0 0 0 3.2 5M2.5 9.5A5.5 5.5 0 0 0 12.8 11" /><path d="M3 2v3h3M13 14v-3h-3" /></svg>,
  tasks: <svg viewBox="0 0 16 16" {...s}><rect x="2" y="2" width="12" height="12" rx="2" /><path d="m5 8 2 2 4-4" /></svg>,
  goals: <svg viewBox="0 0 16 16" {...s}><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><circle cx="8" cy="8" r=".6" /></svg>,
  check: <svg viewBox="0 0 16 16" width="12" height="12" {...s} strokeWidth={2.2}><path d="m3.5 8.5 3 3 6-7" /></svg>,
  bell: <svg viewBox="0 0 16 16" width="12" height="12" {...s}><path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8zM6.5 14h3" /></svg>,
  edit: <svg viewBox="0 0 16 16" width="14" height="14" {...s}><path d="M10.5 2.5l3 3L6 13H3v-3z" /></svg>,
  close: <svg viewBox="0 0 16 16" width="14" height="14" {...s} strokeWidth={1.6}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>,
  left: <svg viewBox="0 0 16 16" width="14" height="14" {...s} strokeWidth={1.8}><path d="M10 3 5 8l5 5" /></svg>,
  right: <svg viewBox="0 0 16 16" width="14" height="14" {...s} strokeWidth={1.8}><path d="m6 3 5 5-5 5" /></svg>,
};
