import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { CX, CY, TICKS, arcPath, clampAngle } from "../lib/dial";
import { NEAR_A, REACH_B, progress, type Zones } from "../lib/engine";
import { DOSE } from "../data/program";

interface Props {
  zones: Zones | null;
  hit: boolean;
  angleRef: MutableRefObject<number>;
  connected: boolean;
  isHold: boolean;
  partials: number;
}

/** Spring-damped needle on a half-circle dial, with the A and B zones from calibration. The needle moves
 *  every animation frame, so it is driven through refs; only the text readouts go through React state. */
export function LiveDial({ zones, hit, angleRef, connected, isHold, partials }: Props) {
  const needle = useRef<SVGGElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const [angle, setAngle] = useState("—");
  const [range, setRange] = useState("—");
  const live = useRef({ zones, connected });
  live.current = { zones, connected };

  useEffect(() => {
    let pos = 0, vel = 0, raf = 0;
    const frame = () => {
      const { zones: z, connected: on } = live.current;
      const a = angleRef.current;
      vel += (clampAngle(a) - pos) * 0.12; vel *= 0.72; pos += vel;
      needle.current?.setAttribute("transform", `rotate(${pos.toFixed(2)} ${CX} ${CY})`);
      // live fill: from A to wherever the limb is now
      fill.current?.setAttribute("d", z && on ? arcPath(z.start, pos) : "");
      setAngle(`${a.toFixed(1)}°`);
      setRange(!z ? "—" : z.hold ? `${Math.abs(a - z.start).toFixed(0)}°` : `${Math.round(Math.max(0, progress(a, z)) * 100)}%`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [angleRef]);

  let startZone = "", finalZone = "";
  if (zones) {
    if (zones.hold) {
      finalZone = arcPath(zones.start - DOSE.tol, zones.start + DOSE.tol);
    } else {
      const at = (p: number) => zones.start + zones.dir * zones.rom * p;   // angle at a fraction of the way from A to B
      startZone = arcPath(at(-NEAR_A), at(NEAR_A));
      finalZone = arcPath(at(REACH_B), at(1) + zones.dir * 8);
    }
  }

  return (
    <div className="live">
      <svg className="dial" viewBox="0 0 600 330" role="img" aria-label="Live joint angle">
        <g className="ticks">
          {TICKS.map(t => <line key={t.a} className={t.major ? "major" : ""} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />)}
        </g>
        <path className="track" d={arcPath(-90, 90)} />
        <path ref={fill} className="fill" />
        <path className="zone start" d={startZone} />
        <path className={`zone final ${hit ? "hit" : ""}`} d={finalZone} />
        <g ref={needle} className="needle"><line x1="300" y1="310" x2="300" y2="80" /></g>
        <circle cx="300" cy="310" r="10" className="hub" />
      </svg>
      <dl className="readout">
        <div><dt>Angle</dt><dd>{angle}</dd></div>
        <div><dt>{isHold ? "Off by" : "Range"}</dt><dd>{range}</dd></div>
        <div><dt>{isHold ? "Breaks" : "Short"}</dt><dd>{partials}</dd></div>
      </dl>
    </div>
  );
}
