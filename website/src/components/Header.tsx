import type { Band, LinkMode } from "../hooks/useBand";
import { Button } from "./ui";

const LINKS: Record<LinkMode, { label: string; idle: string }> = {
  wifi: { label: "Wi‑Fi", idle: "Connect" },
  usb: { label: "USB", idle: "Choose port" },
};

function Link({ m, band }: { m: LinkMode; band: Band }) {
  const on = band.live && band.mode === m;
  const text = band.linkText[m];
  return (
    <div className={`link ${on ? "live" : ""}`}>
      <span className="link-label"><i className="dot" aria-hidden="true" />{LINKS[m].label}</span>
      {m === "wifi" && (
        <input
          className="host" value={band.host} spellCheck={false} aria-label="Band address"
          onChange={e => band.setHost(e.target.value)}
        />
      )}
      <Button size="md" variant="secondary" onClick={() => band.toggle(m)}>
        {on ? "Disconnect" : LINKS[m].idle}
      </Button>
      <span className="link-state" role="status" aria-live="polite">{text}</span>
    </div>
  );
}

export function Header({ band, onHome }: { band: Band; onHome: () => void }) {
  return (
    <header className="top">
      <div className="top-inner">
        <button type="button" className="mark" onClick={onHome}>
          <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <rect width="28" height="28" rx="8" fill="currentColor" />
            <path d="M7 19a9 9 0 0 1 14 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
            <path d="M7 19a9 9 0 0 1 9.5-7.6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="14" cy="19" r="2" fill="#fff" />
          </svg>
          IMU Exercise Band Tracker
        </button>
        <div className="links">
          <Link m="wifi" band={band} />
          <Link m="usb" band={band} />
        </div>
      </div>
    </header>
  );
}
