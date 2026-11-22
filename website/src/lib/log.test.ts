import { afterEach, describe, expect, it, vi } from "vitest";
import { EXERCISES } from "../data/program";
import { addSet, isSaved, readyToProgress, sessionInfo, type Log } from "./log";
import { reserve, zoneOf, PHASES } from "./hr";

const ex = (id: string) => EXERCISES.find(e => e.id === id)!;
const sets = (reps: number[]) => reps.map(r => ({ reps: r, load: "" }));

afterEach(() => vi.useRealTimers());

describe("isSaved", () => {
  it("needs A and B for reps, only A for holds", () => {
    expect(isSaved(ex("curl"), { curl: { start: 0, final: null } })).toBe(false);
    expect(isSaved(ex("curl"), { curl: { start: 0, final: 50 } })).toBe(true);
    expect(isSaved(ex("plank"), { plank: { start: 5, final: null } })).toBe(true);
    expect(isSaved(ex("plank"), {})).toBe(false);
  });
});

describe("addSet", () => {
  it("appends to today's entry without mutating the old log", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-04T10:00:00"));
    const a: Log = {};
    const b = addSet(a, "curl", { reps: 12, load: "10 lb" });
    const c = addSet(b, "curl", { reps: 11, load: "10 lb" });
    expect(a).toEqual({});
    expect(b.curl[0].sets).toHaveLength(1);
    expect(c.curl).toHaveLength(1);
    expect(c.curl[0].sets.map(s => s.reps)).toEqual([12, 11]);
  });
  it("starts a new entry on a new day", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-05T10:00:00"));
    const next = addSet({ curl: [{ date: "2026-03-04", sets: sets([12]) }] }, "curl", { reps: 10, load: "" });
    expect(next.curl.map(e => e.date)).toEqual(["2026-03-04", "2026-03-05"]);
  });
});

describe("readyToProgress", () => {
  const day = (d: string, reps: number[]) => ({ date: d, sets: sets(reps) });
  it("needs 20 reps on every set for two sessions in a row", () => {
    expect(readyToProgress(ex("curl"), { curl: [day("a", [20, 20]), day("b", [20, 20])] })).toBe(true);
    expect(readyToProgress(ex("curl"), { curl: [day("a", [20, 20]), day("b", [20, 19])] })).toBe(false);
    expect(readyToProgress(ex("curl"), { curl: [day("b", [20, 20])] })).toBe(false);
  });
  it("never applies to holds or bodyweight categories", () => {
    expect(readyToProgress(ex("plank"), { plank: [day("a", [20]), day("b", [20])] })).toBe(false);
    expect(readyToProgress(ex("rainbow"), { rainbow: [day("a", [20]), day("b", [20])] })).toBe(false);
  });
});

describe("sessionInfo", () => {
  it("counts distinct logged days and today", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-10T10:00:00"));
    const log: Log = { curl: [{ date: "2026-03-01", sets: sets([10]) }], row: [{ date: "2026-03-01", sets: sets([10]) }, { date: "2026-03-03", sets: sets([10]) }] };
    expect(sessionInfo(log, [])).toEqual({ n: 3, inBlock: 3 });   // 2 logged days + today
  });
  it("wraps at the 12-session block", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-20T10:00:00"));
    const cardio = Array.from({ length: 12 }, (_, i) => ({ date: `2026-03-${String(i + 1).padStart(2, "0")}`, phase: "warmup" as const, machine: "bike", secs: 300, inZone: 0, avg: null, peak: null }));
    expect(sessionInfo({}, cardio)).toEqual({ n: 13, inBlock: 1 });
  });
  it("ignores empty entries", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-10T10:00:00"));
    expect(sessionInfo({ curl: [{ date: "2026-03-01", sets: [] }] }, [])).toEqual({ n: 1, inBlock: 1 });
  });
});

describe("heart-rate zones", () => {
  it("computes Karvonen targets", () => {
    const z = reserve("70", "180")!;
    expect(z.at(0.4)).toBe(114);
    expect(z.at(0.6)).toBe(136);
  });
  it("rejects a max that is not clearly above rest", () => {
    expect(reserve("70", "85")).toBeNull();
    expect(reserve("", "180")).toBeNull();
  });
  it("classifies bpm against the phase zone", () => {
    const z = reserve("70", "180");
    expect(zoneOf(z, PHASES.cardio, 100)).toBe("low");
    expect(zoneOf(z, PHASES.cardio, 120)).toBe("in");
    expect(zoneOf(z, PHASES.cardio, 150)).toBe("high");
    expect(zoneOf(z, PHASES.warmup, 100)).toBe("in");    // warm-up: anything under 40%
    expect(zoneOf(z, PHASES.warmup, 120)).toBe("high");
    expect(zoneOf(null, PHASES.cardio, 120)).toBeNull();
  });
});
