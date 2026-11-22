import { DOSE, NO_LOAD, type Exercise } from "../data/program";
import { today } from "./format";

export interface SetRecord { reps?: number; secs?: number; partials?: number; breaks?: number; load: string }
export interface LogEntry { date: string; sets: SetRecord[] }
export type Log = Record<string, LogEntry[]>;
export interface Calibration { start: number; final: number | null }
export type Saved = Record<string, Calibration>;
export interface CardioEntry {
  date: string; phase: "warmup" | "cardio" | "cooldown"; machine: string;
  secs: number; inZone: number; avg: number | null; peak: number | null;
}

export const isSaved = (ex: Exercise, saved: Saved) => {
  const c = saved[ex.id];
  return !!c && c.start != null && (!!ex.hold || c.final != null);
};

export const entries = (log: Log, id: string) => (log[id] ?? []).filter(e => e.sets.length);
export const todaysEntry = (log: Log, id: string) => (log[id] ?? []).find(e => e.date === today());

export const setsSummary = (ex: Exercise, e: LogEntry) => e.sets.map(s => (ex.hold ? `${s.secs}s` : s.reps)).join(" · ");
export function entryLoad(e: LogEntry) {
  const l = e.sets.map(s => s.load).filter(Boolean);
  return l.length ? l[l.length - 1] : "";
}

/** Append a set to today's entry without mutating the old log. */
export function addSet(log: Log, id: string, set: SetRecord): Log {
  const list = log[id] ?? [];
  const day = today();
  const next = list.some(e => e.date === day)
    ? list.map(e => (e.date === day ? { ...e, sets: [...e.sets, set] } : e))
    : [...list, { date: day, sets: [set] }];
  return { ...log, [id]: next };
}

/** Session number = distinct days with anything logged (today counts even before the first set). */
export function sessionInfo(log: Log, cardio: CardioEntry[]) {
  const days = new Set<string>();
  for (const id in log) for (const e of log[id]) if (e.sets.length) days.add(e.date);
  for (const e of cardio) days.add(e.date);
  const n = days.size + (days.has(today()) ? 0 : 1);
  return { n, inBlock: ((n - 1) % DOSE.block) + 1 };
}

/** Ready for more load: 20 reps on every set, two sessions in a row. */
export function readyToProgress(ex: Exercise, log: Log) {
  if (ex.hold || NO_LOAD.has(ex.cat)) return false;
  const list = entries(log, ex.id);
  return list.length >= 2 && list.slice(-2).every(e => e.sets.every(s => (s.reps ?? 0) >= DOSE.max));
}
