import { describe, expect, it } from "vitest";
import { EXERCISES } from "../data/program";
import { SetEngine, progress, zonesFor } from "./engine";

const curl = EXERCISES.find(e => e.id === "curl")!;       // A → B rep exercise
const plank = EXERCISES.find(e => e.id === "plank")!;     // hold
const zones = zonesFor(curl, { start: 0, final: 100 })!;

/** Move through angles like a limb would, returning the engine afterwards. */
function run(angles: number[]) {
  const e = new SetEngine();
  for (const a of angles) e.step(a, zones);
  return e;
}

describe("zonesFor", () => {
  it("needs both A and B for a rep exercise", () => {
    expect(zonesFor(curl, undefined)).toBeNull();
    expect(zonesFor(curl, { start: 5 })).toBeNull();
    expect(zonesFor(curl, { start: 5, final: 65 })).toMatchObject({ rom: 60, dir: 1 });
  });
  it("detects a descending range", () => {
    expect(zonesFor(curl, { start: 80, final: 20 })).toMatchObject({ rom: 60, dir: -1 });
  });
  it("only needs A for a hold", () => {
    expect(zonesFor(plank, { start: 5 })).toMatchObject({ hold: true, rom: 0 });
  });
  it("progress is 0 at A and 1 at B", () => {
    expect(progress(0, zones)).toBe(0);
    expect(progress(100, zones)).toBe(1);
  });
});

describe("SetEngine.step", () => {
  it("waits for the start position before counting", () => {
    const e = new SetEngine();
    expect(e.step(60, zones).cue).toBe("Move to the start position.");
    expect(e.step(2, zones).cue).toBe("Ready.");
    expect(e.phase).toBe("atStart");
  });
  it("counts a full rep (reach 85% of B, return to A)", () => {
    const e = run([0, 0, 40, 90, 50, 5]);
    expect(e.reps).toBe(1);
    expect(e.partials).toBe(0);
    expect(e.history).toHaveLength(1);
  });
  it("counts a short rep (past 30% but under 85%) as a partial, not a rep", () => {
    const e = run([0, 0, 50, 5]);
    expect(e.reps).toBe(0);
    expect(e.partials).toBe(1);
  });
  it("ignores small wiggles", () => {
    const e = run([0, 0, 20, 0, 25, 3]);
    expect(e.reps).toBe(0);
    expect(e.partials).toBe(0);
  });
  it("reports bump and milestone cues", () => {
    const e = new SetEngine();
    let last = e.step(0, zones);
    for (let i = 0; i < 10; i++) { e.step(50, zones); e.step(95, zones); last = e.step(0, zones); }
    expect(e.reps).toBe(10);
    expect(last.bump).toBe(true);
    expect(last.cue).toMatch(/10 reps/);
  });
  it("reset clears everything", () => {
    const e = run([0, 0, 90, 5]);
    e.reset();
    expect(e).toMatchObject({ reps: 0, partials: 0, history: [], phase: "idle", held: 0 });
  });
});

describe("SetEngine.stepHold", () => {
  const hz = zonesFor(plank, { start: 10 })!;
  it("only runs the clock while within the tolerance", () => {
    const e = new SetEngine();
    e.stepHold(10, 0.1, hz, 30);
    e.stepHold(15, 0.1, hz, 30);
    e.stepHold(40, 0.1, hz, 30);   // out of position
    expect(e.held).toBeCloseTo(0.2);
  });
  it("counts a break when leaving the zone, once", () => {
    const e = new SetEngine();
    e.stepHold(10, 0.1, hz, 30);
    e.stepHold(50, 0.1, hz, 30);
    e.stepHold(50, 0.1, hz, 30);
    expect(e.partials).toBe(1);
  });
  it("bumps exactly when the target is reached", () => {
    const e = new SetEngine();
    e.held = 29.95;
    e.inZone = true;
    expect(e.stepHold(10, 0.1, hz, 30).bump).toBe(true);
    expect(e.stepHold(10, 0.1, hz, 30).bump).toBe(false);
  });
});
