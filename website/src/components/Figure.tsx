import { DOSE, type Exercise } from "../data/program";
import { arcPath } from "../lib/dial";
import { figureSvg } from "../lib/figure";
import type { Saved } from "../lib/log";

/** Generated figure. The markup comes from our own exercise data (lib/figure.ts), never from user input. */
export function FigureSvg({ ex, k, cls }: { ex: Exercise; k: number; cls?: string }) {
  return <span className="fig-wrap" dangerouslySetInnerHTML={{ __html: figureSvg(ex, k, cls) }} />;
}

/** The movement as a start ↔ end crossfade: the original drawings where we have them, else the generated figure. */
export function Move({ ex }: { ex: Exercise }) {
  if (ex.move) {
    return (
      <span className="move">
        <img src={`${ex.move}-a.png`} alt="" />
        <img className="b" src={`${ex.move}-b.png`} alt="" />
      </span>
    );
  }
  return (
    <span className="move">
      <FigureSvg ex={ex} k={0} />
      {ex.fig!.b && <FigureSvg ex={ex} k={1} cls="b" />}
    </span>
  );
}

/** A single still of the start (k = 0) or end (k = 1) pose. */
export function Still({ ex, k }: { ex: Exercise; k: 0 | 1 }) {
  if (ex.move) return <img className="still" src={`${ex.move}-${k ? "b" : "a"}.png`} alt="" />;
  return <FigureSvg ex={ex} k={k} />;
}

/** Small diagram of the movement: the arc from A (hollow dot) to B (solid dot), using the saved
 *  calibration if there is one, otherwise a typical range. Holds show the band you need to stay inside. */
export function MotionArc({ ex, saved }: { ex: Exercise; saved: Saved }) {
  const c = saved[ex.id];
  const [a, b] = c && c.start != null ? [c.start, ex.hold ? c.start : c.final ?? c.start] : ex.demo;
  const cx = 60, cy = 58, r = 46;
  const p = (ang: number): [number, number] => {
    const th = (90 - Math.max(-90, Math.min(90, ang))) * Math.PI / 180;
    return [cx + r * Math.cos(th), cy - r * Math.sin(th)];
  };
  const [ax, ay] = p(a), [bx, by] = p(b);
  const move = ex.hold ? arcPath(a - DOSE.tol, a + DOSE.tol, r, cx, cy) : arcPath(a, b, r, cx, cy);
  return (
    <svg className="arc" viewBox="0 0 120 66" aria-hidden="true">
      <path className="t" d={arcPath(-90, 90, r, cx, cy)} />
      <path className="m" d={move} />
      <circle className="h" cx={cx} cy={cy} r="4" />
      {!ex.hold && <circle className="a" cx={ax.toFixed(1)} cy={ay.toFixed(1)} r="6" />}
      <circle className="b" cx={bx.toFixed(1)} cy={by.toFixed(1)} r="6" />
    </svg>
  );
}
