// Adapted from LedgerHQ/device-management-kit-ts-workshop (Apache-2.0).
import { useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * Shows the Speculos screen in the page and lets you use it with the mouse.
 * Touch models (Stax/Flex): click to tap, keep the mouse down to hold-to-sign.
 * Button models (Nano X/S Plus): use the 3 buttons under the screen.
 */
export function SpeculosScreen({ url }: { url: string }) {
  const base = url.replace(/\/+$/, "");
  const [src, setSrc] = useState<string>();
  const [hasButtons, setHasButtons] = useState(false);
  const pressed = useRef<{ x: number; y: number } | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setSrc(`${base}/screenshot?t=${Date.now()}`);
    refresh();
    const events = new EventSource(`${base}/events?stream=true`);
    events.onmessage = refresh;
    events.onopen = refresh;
    return () => events.close();
  }, [base]);

  const post = (path: string, body: object) =>
    fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});

  const onPointerDown = (e: PointerEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) * img.naturalWidth) / rect.width);
    const y = Math.round(((e.clientY - rect.top) * img.naturalHeight) / rect.height);
    img.setPointerCapture(e.pointerId);
    pressed.current = { x, y };
    post("finger", { action: "press", x, y });
  };

  const onPointerUp = () => {
    if (!pressed.current) return;
    post("finger", { action: "release", ...pressed.current });
    pressed.current = undefined;
  };

  const button = (name: "left" | "both" | "right") =>
    post(`button/${name}`, { action: "press-and-release" });

  return (
    <div className="speculos">
      {src ? (
        <>
          <p className="hint">
            {hasButtons
              ? "Use the buttons under the screen."
              : "Click to tap · hold the mouse down to sign."}
          </p>
          <img
            src={src}
            alt="Ledger device screen (Speculos)"
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLoad={(e) =>
              setHasButtons(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)
            }
            onError={() => setSrc(undefined)}
          />
          {hasButtons && (
            <div className="speculos-buttons">
              <button onClick={() => button("left")}>◀</button>
              <button onClick={() => button("both")}>● ●</button>
              <button onClick={() => button("right")}>▶</button>
            </div>
          )}
        </>
      ) : (
        <div className="device-frame off">
          <span>
            Speculos isn't running.
            <br />
            Start it with <code>./run-speculos.sh stax</code>
          </span>
        </div>
      )}
    </div>
  );
}
