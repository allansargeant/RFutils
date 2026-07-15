/** Roadmap placeholders for the frequency coordination / allocation /
 * deployment services this suite is being built to grow into. */
export function PlaceholderTab({
  title,
  blurb,
  bullets,
}: {
  title: string;
  blurb: string;
  bullets: string[];
}): JSX.Element {
  return (
    <div className="tab-panel">
      <div className="placeholder">
        <span className="placeholder__pill">Planned</span>
        <h2>{title}</h2>
        <p>{blurb}</p>
        <ul>
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="placeholder__foot">
          The unified channel model and device registry that power the Convert and Monitor tabs are
          the foundation these services will build on.
        </p>
      </div>
    </div>
  );
}
