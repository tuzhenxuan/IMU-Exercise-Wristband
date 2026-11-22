import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { today } from "../lib/format";
import { HR_DEFAULT, HR_FRESH_MS, PHASES, average, reserve, zoneOf, type MachineId, type PhaseId } from "../lib/hr";
import { KEYS, load, save } from "../lib/storage";
import type { CardioEntry } from "../lib/log";
import type { Sample } from "../lib/sources";

interface HrSaved { rest?: string | number; max?: string | number; machine?: MachineId }

/** Cardio session: phase timer, heart-rate samples, zone time, log. The timer state lives in a ref and the
 *  hook re-renders on each tick, since the clock updates 4× a second regardless. */
export function useCardio(demo: boolean, bandSubscribe: (fn: (s: Sample) => void) => () => void) {
  const saved = useRef(load<HrSaved>(KEYS.hr, {})).current;
  const [rest, setRest] = useState(String(saved.rest || HR_DEFAULT.rest));
  const [max, setMax] = useState(String(saved.max || HR_DEFAULT.max));
  const [machine, setMachineState] = useState<MachineId>(saved.machine || "treadmill");
  const [log, setLog] = useState<CardioEntry[]>(() => load(KEYS.cardio, []));
  const [cue, setCue] = useState("");
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const c = useRef({
    phase: "warmup" as PhaseId, running: false, elapsed: 0, inZone: 0, last: 0,
    bpm: null as number | null, bpmAt: 0, samples: [] as { t: number; bpm: number }[],
  }).current;
  const z = reserve(rest, max);
  const zRef = useRef(z); zRef.current = z;
  const machineRef = useRef(machine); machineRef.current = machine;
  const logRef = useRef(log); logRef.current = log;
  const lastCue = useRef("");

  const fresh = c.bpm != null && performance.now() - c.bpmAt < HR_FRESH_MS;

  const persistHR = useCallback((r: string, m: string, mach: MachineId) => save(KEYS.hr, { rest: r, max: m, machine: mach }), []);
  const setRestSaved = (v: string) => { setRest(v); persistHR(v, max, machine); };
  const setMaxSaved = (v: string) => { setMax(v); persistHR(rest, v, machine); };
  const setMachine = (m: MachineId) => { setMachineState(m); persistHR(rest, max, m); };

  const onHR = useCallback((bpm: number) => {
    if (!(bpm > 30 && bpm < 240)) return;
    c.bpm = Math.round(bpm); c.bpmAt = performance.now();
    const last = c.samples[c.samples.length - 1];
    if (c.running && (!last || c.elapsed - last.t >= 2)) c.samples.push({ t: c.elapsed, bpm: c.bpm });
    rerender();
  }, [c]);

  useEffect(() => bandSubscribe(s => { if (s.bpm && s.bpm > 0) onHR(s.bpm); }), [bandSubscribe, onHR]);

  // timer
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now(), dt = c.last ? (now - c.last) / 1000 : 0;
      c.last = now;
      if (!c.running) return;
      const P = PHASES[c.phase], before = c.elapsed;
      c.elapsed += dt;
      const isFresh = c.bpm != null && now - c.bpmAt < HR_FRESH_MS;
      if (isFresh && zoneOf(zRef.current, P, c.bpm) === "in") c.inZone += dt;
      const crossed = (t: number) => before < t && c.elapsed >= t;
      const next = c.phase === "warmup" ? "start cardio" : c.phase === "cardio" ? "move on to strength" : "finish";
      if (crossed(P.min)) lastCue.current = `${P.min / 60} minutes done. You can ${next} any time before ${P.max / 60} min.`;
      if (crossed(P.max)) lastCue.current = `${P.max / 60} minutes — time to ${next}.`;
      setCue(lastCue.current);
      rerender();
    }, 250);
    return () => clearInterval(id);
  }, [c]);

  // Demo (?demo): a simulated heart rate that follows the phase.
  useEffect(() => {
    if (!demo) return;
    let hrSim = 72;
    const id = setInterval(() => {
      const zz = zRef.current; if (!zz) return;
      const goal = !c.running ? zz.at(0.1) : c.phase === "cardio" ? zz.at(0.5) + 12 * Math.sin(c.elapsed / 40) : zz.at(0.3);
      hrSim += (goal - hrSim) * 0.08 + (Math.random() - 0.5) * 2;
      onHR(hrSim);
    }, 1000);
    return () => clearInterval(id);
  }, [demo, c, onHR]);

  const startPhase = useCallback((phase: PhaseId) => {
    Object.assign(c, { phase, running: false, elapsed: 0, inZone: 0, samples: [] });
    lastCue.current = phase === "cardio" ? "Warm‑up logged. Bring your heart rate up into your zone." : "";
    setCue(lastCue.current);
    rerender();
  }, [c]);

  const logPhase = useCallback(() => {
    if (c.elapsed < 10) return;
    const bpms = c.samples.map(s => s.bpm);
    const next = [...logRef.current, {
      date: today(), phase: c.phase, machine: machineRef.current, secs: Math.round(c.elapsed),
      inZone: Math.round(c.inZone), avg: average(bpms), peak: bpms.length ? Math.max(...bpms) : null,
    }];
    setLog(next); save(KEYS.cardio, next);
  }, [c]);

  const toggleRun = () => { c.running = !c.running; c.last = performance.now(); rerender(); };
  const pause = () => { c.running = false; };
  const resume = () => { c.running = true; c.last = performance.now(); rerender(); };
  const submitManual = (bpm: number) => onHR(bpm);

  return {
    phase: c.phase, running: c.running, elapsed: c.elapsed, inZone: c.inZone, samples: c.samples,
    bpm: c.bpm, fresh, z, cue, log,
    rest, max, setRest: setRestSaved, setMax: setMaxSaved, machine, setMachine,
    startPhase, logPhase, toggleRun, pause, resume, submitManual,
  };
}
export type Cardio = ReturnType<typeof useCardio>;
