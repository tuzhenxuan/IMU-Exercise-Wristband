/** Heart-rate zones by heart-rate reserve (Karvonen): target = rest + % × (max − rest). */
export type PhaseId = "warmup" | "cardio" | "cooldown";
export interface Phase { name: string; min: number; max: number; lo: number; hi: number; how: string }

export const PHASES: Record<PhaseId, Phase> = {
  warmup:   { name: "Warm‑up",   min: 3 * 60,  max: 5 * 60,  lo: 0,   hi: 0.4, how: "Easy pace, 3–5 minutes. Let your heart rate climb slowly." },
  cardio:   { name: "Cardio",    min: 15 * 60, max: 30 * 60, lo: 0.4, hi: 0.6, how: "Moderate pace, 15–30 minutes at 40–60% of your heart‑rate reserve." },
  cooldown: { name: "Cool‑down", min: 3 * 60,  max: 5 * 60,  lo: 0,   hi: 0.4, how: "Easy pace, 3–5 minutes. Let your heart rate come down." },
};

export type MachineId = "treadmill" | "bike" | "elliptical";
export const MACHINES: { id: MachineId; label: string }[] = [
  { id: "treadmill", label: "Treadmill" },
  { id: "bike", label: "Recumbent bike" },
  { id: "elliptical", label: "Elliptical" },
];
export const MACHINE_TIPS: Record<MachineId, { up: string; down: string }> = {
  treadmill:  { up: "Raise the speed or incline a little.",     down: "Lower the speed or incline." },
  bike:       { up: "Add a little resistance or pedal faster.", down: "Lower the resistance or pedal slower." },
  elliptical: { up: "Add resistance or lengthen your stride.",  down: "Lower the resistance or slow your stride." },
};

/** Until the person enters their own numbers, start from typical values so the zone shows right away. */
export const HR_DEFAULT = { rest: 70, max: 180 };
export const HR_FRESH_MS = 90000;

export interface Reserve { rest: number; max: number; at: (p: number) => number }
export function reserve(restText: string, maxText: string): Reserve | null {
  const rest = Number(restText), max = Number(maxText);
  return rest && max && max > rest + 20 ? { rest, max, at: p => Math.round(rest + p * (max - rest)) } : null;
}

export type ZoneState = "low" | "in" | "high";
export function zoneOf(z: Reserve | null, phase: Phase, bpm: number | null): ZoneState | null {
  if (!z || bpm == null) return null;
  const lo = phase.lo ? z.at(phase.lo) : 0, hi = z.at(phase.hi);
  return bpm < lo ? "low" : bpm > hi ? "high" : "in";
}

export const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
