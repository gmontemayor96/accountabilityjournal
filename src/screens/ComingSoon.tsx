const COPY = {
  calendar: ["Calendar", "The month view with a dot per habit, completion bars and a per-habit heatmap."],
  journal: ["Journal", "A searchable feed of every day, with the habits you did and what you wrote."],
  tags: ["Tags", "Rename, recolor and delete tags. For now, add tags from the habit editor or the Today screen."],
} as const;

export function ComingSoon({ view }: { view: keyof typeof COPY }) {
  const [title, text] = COPY[view];
  return (
    <>
      <header className="viewhead">
        <div>
          <h1>{title}</h1>
          <div className="sub">Coming in the next milestone</div>
        </div>
      </header>
      <section className="canvas">
        <p className="empty">{text}</p>
      </section>
    </>
  );
}
