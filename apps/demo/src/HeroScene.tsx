/** Fixed star positions (percent), so the scene renders the same every time. */
const STARS = [
  [8, 12], [22, 30], [37, 8], [61, 18], [78, 9], [90, 34], [14, 52], [86, 58], [70, 40], [30, 62],
];

/**
 * Home-screen art, pure CSS: a pixel signing device whose screen flips between
 * what blind signing shows today (hex) and what clear signing shows (the warning).
 * With reduced motion it holds on the clear-signed screen.
 */
export function HeroScene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-stars">
        {STARS.map(([x, y], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 0.6}s` }} />
        ))}
      </div>
      <div className="pixel-device">
        <div className="pixel-screen">
          <div className="screen-layer screen-hex">
            <span className="screen-label">BLIND SIGN?</span>
            <code>1200142200020000 2400000001634000 0000000000000068 4000000000000000 C63B9AE6C1F3B7D2 524C555344000000 …</code>
          </div>
          <div className="screen-layer screen-clear">
            <span className="warn-code">⚠ IMPERSONATION</span>
            <span className="warn-text">"RLUSD" from an unverified issuer, unlimited limit.</span>
            <span className="warn-cta">REJECT</span>
          </div>
        </div>
        <div className="pixel-buttons">
          <span />
          <span />
        </div>
      </div>
      <div className="scene-caption">
        <span className="a">today: raw hex</span>
        <span className="b">clear signed</span>
      </div>
      <div className="scene-grid" />
    </div>
  );
}
