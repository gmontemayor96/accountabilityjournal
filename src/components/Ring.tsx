/** A progress ring, 0 to 1. */
export function Ring({ pct, size = 56, color = "var(--accent)" }: { pct: number; size?: number; color?: string }) {
  const c = 2 * Math.PI * 22;
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true" className="ringsvg">
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, Math.max(0, pct))} ${c}`} transform="rotate(-90 28 28)" />
    </svg>
  );
}
