import { describe, expect, it } from "vitest";
import { EXERCISES } from "../data/program";
import { figurePhase, figureSvg } from "./figure";

describe("figureSvg", () => {
  const withFig = EXERCISES.filter(e => e.fig);
  it.each(withFig.map(e => [e.id, e] as const))("draws %s at start, middle and end without NaN", (_id, e) => {
    for (const k of [0, 0.5, 1]) {
      const svg = figureSvg(e, k);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toContain('class="band"');
    }
  });
  it("every exercise has either a drawing or a figure", () => {
    for (const e of EXERCISES) expect(Boolean(e.move || e.fig)).toBe(true);
  });
});

describe("figurePhase", () => {
  it("holds at A, moves to B, holds at B, comes back", () => {
    expect(figurePhase(0)).toBe(0);
    expect(figurePhase(0.1 * 3600)).toBe(0);
    expect(figurePhase(0.325 * 3600)).toBeCloseTo(0.5);
    expect(figurePhase(0.55 * 3600)).toBe(1);
    expect(figurePhase(0.825 * 3600)).toBeCloseTo(0.5);
  });
});
