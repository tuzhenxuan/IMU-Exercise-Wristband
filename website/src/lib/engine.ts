/** Rep and hold counting. Pure logic: feed it angles, it tells you what happened. */
import { DOSE, type Exercise } from "../data/program";
import type { Calibration } from "./log";

export const REACH_B = 0.85;   // 85% of the way to B counts as reaching B
export const NEAR_A = 0.15;    // within 15% of the range from A counts as back at A

export interface Zones { start: number; final: number; rom: number; dir: number; hold?: true }

export function zonesFor(ex: Exercise, c: Partial<Calibration> | undefined): Zones | null {
  if (!c || c.start == null) return null;
  if (ex.hold) return { start: c.start, final: c.start, rom: 0, dir: 1, hold: true };
  if (c.final == null) return null;
  const rom = Math.abs(c.final - c.start);
  return { start: c.start, final: c.final, rom, dir: Math.sign(c.final - c.start) || 1 };
}
export const progress = (a: number, z: Zones) => (z.rom ? ((a - z.start) * z.dir) / z.rom : 0);

export interface StepResult { cue: string | null; hit: boolean; bump: boolean }

export class SetEngine {
  reps = 0;
  partials = 0;
  history: number[] = [];
  phase: "idle" | "atStart" | "moving" = "idle";
  peak = 0;
  held = 0;
  inZone = false;

  reset() {
    this.reps = 0; this.partials = 0; this.history = []; this.phase = "idle";
    this.peak = 0; this.held = 0; this.inZone = false;
  }

  /** One sample of a rep exercise. cue === null means "leave the cue as it is". */
  step(a: number, z: Zones): StepResult {
    const p = progress(a, z);
    const inStart = Math.abs(p) <= NEAR_A;
    const hit = p >= REACH_B;
    let cue: string | null = null, bump = false;

    if (this.phase === "idle") {
      if (inStart) this.phase = "atStart";
      return { cue: inStart ? "Ready." : "Move to the start position.", hit, bump };
    }
    if (this.phase === "atStart" && !inStart) { this.phase = "moving"; this.peak = 0; }
    if (this.phase === "moving") {
      this.peak = Math.max(this.peak, p);
      if (inStart) {
        const pct = Math.min(1.2, this.peak);
        if (this.peak >= REACH_B) {
          this.reps++; this.history.push(pct); bump = true;
          cue = this.reps === DOSE.min ? `${DOSE.min} reps — you’re in range. Keep going toward ${DOSE.max} if your form holds.`
            : this.reps === DOSE.max ? `${DOSE.max} reps. Finish the set.`
            : this.reps > DOSE.max ? "Past the top of the range — finish the set." : "Good rep.";
        } else if (this.peak > 0.3) {
          this.partials++;
          cue = `Short rep — ${Math.round(pct * 100)}%. Go further.`;
        }
        this.phase = "atStart";
      }
    }
    return { cue, hit, bump };
  }

  /** One sample of a hold: the clock runs while the angle stays within ±tol° of A. */
  stepHold(a: number, dt: number, z: Zones, target: number): StepResult {
    const inZone = Math.abs(a - z.start) <= DOSE.tol;
    const before = this.held;
    if (inZone) this.held += dt;
    else if (this.inZone && this.held > 0) this.partials++;
    this.inZone = inZone;
    const bump = before < target && this.held >= target;
    const cue = !inZone ? (this.held > 0 ? "Back into position." : "Get into position.")
      : this.held >= target ? "Target reached. Finish the set." : "Holding — stay steady.";
    return { cue, hit: inZone, bump };
  }
}
