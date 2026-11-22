import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DOSE, NO_LOAD, categoryName, type Exercise } from "../data/program";
import type { Band } from "../hooks/useBand";
import { useFigureClock } from "../hooks/useFigureClock";
import { SetEngine, zonesFor } from "../lib/engine";
import { mmss, shortDate } from "../lib/format";
import { figurePhase } from "../lib/figure";
import { entries, entryLoad, isSaved, readyToProgress, setsSummary, todaysEntry, type Calibration, type Log, type Saved, type SetRecord } from "../lib/log";
import { Move, FigureSvg, Still } from "./Figure";
import { LiveDial } from "./LiveDial";
import { BackLink, Button, LogTable } from "./ui";

const SAMPLES_PER_CAPTURE = 30;   // same as the progress-check sketch

type Which = "start" | "final";
interface Draft { start?: number; final?: number }

interface Props {
  ex: Exercise; saved: Saved; log: Log; initialLoad: string; band: Band;
  onBack: () => void; onDemo: () => void;
  onSaveCal: (cal: Calibration) => void;
  onFinishSet: (set: SetRecord) => void;
}

export function Stage({ ex, saved, log, initialLoad, band, onBack, onDemo, onSaveCal, onFinishSet }: Props) {
  const [mode, setMode] = useState<"calib" | "work">(() => (isSaved(ex, saved) ? "work" : "calib"));
  const [draft, setDraft] = useState<Draft>({});
  const [capText, setCapText] = useState<Record<Which, string>>({ start: "", final: "" });
  const [busy, setBusy] = useState<Which | null>(null);
  const [cue, setCue] = useState(() => (!isSaved(ex, saved) && ex.hold ? "Get into position, then press A to record it." : ""));
  const [load, setLoad] = useState(initialLoad);
  const [hit, setHit] = useState(false);
  const [bumpKey, setBumpKey] = useState(0);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);   // set while resting between sets
  const [restSecs, setRestSecs] = useState(0);
  const [extra, setExtra] = useState(false);   // the person chose to log sets beyond the prescribed ones
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const engine = useRef(new SetEngine()).current;
  const angleRef = useRef(0);
  const lastT = useRef(0);
  const capture = useRef<{ which: Which; buf: number[] } | null>(null);
  const pending = useRef(false);
  // After a set is logged, keep the confirmation on screen instead of letting the next sample's cue replace it
  const quietUntil = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // latest values for the sample handler, which outlives each render
  const latest = useRef({ mode, draft, saved, resting: false });
  const resting = restStartedAt != null;
  latest.current = { mode, draft, saved, resting };

  const zones = zonesFor(ex, mode === "calib" ? draft : saved[ex.id]);

  const finishCapture = useCallback(() => {
    const cap = capture.current!;
    capture.current = null; pending.current = false;
    band.sim.current?.release();
    const mean = Math.round(cap.buf.reduce((x, y) => x + y, 0) / cap.buf.length * 10) / 10;
    setDraft(d => ({ ...d, [cap.which]: mean }));
    setCapText(t => ({ ...t, [cap.which]: `${mean}°` }));
    setBusy(null);
  }, [band.sim]);

  const handleSample = useCallback((s: { pitch?: number; roll?: number }) => {
    const a = Number(s[ex.axis]);
    if (!Number.isFinite(a)) return;
    angleRef.current = a;
    const now = performance.now();
    const dt = lastT.current ? Math.min(0.25, (now - lastT.current) / 1000) : 0;
    lastT.current = now;

    const cap = capture.current;
    if (cap) {
      cap.buf.push(a);
      setCapText(t => ({ ...t, [cap.which]: `Reading ${cap.buf.length}/${SAMPLES_PER_CAPTURE}` }));
      if (cap.buf.length >= SAMPLES_PER_CAPTURE) finishCapture();
      return;
    }
    if (latest.current.mode !== "work" || latest.current.resting) return;
    const z = zonesFor(ex, latest.current.saved[ex.id]);
    if (!z) return;
    const r = ex.hold ? engine.stepHold(a, dt, z, ex.hold) : engine.step(a, z);
    setHit(h => (h === r.hit ? h : r.hit));
    if (r.cue != null && now >= quietUntil.current) setCue(r.cue);
    if (r.bump) setBumpKey(k => k + 1);
    rerender();
  }, [ex, engine, finishCapture]);

  useEffect(() => band.subscribe(handleSample), [band, handleSample]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // rest stopwatch, counting up from the moment the set was logged
  useEffect(() => {
    if (restStartedAt == null) return;
    const tick = () => setRestSecs(Math.floor((performance.now() - restStartedAt) / 1000));
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restStartedAt]);
  useEffect(() => { band.sim.current?.reset(); }, [band.sim, ex]);

  const resetSet = () => { engine.reset(); rerender(); };

  const startCapture = (which: Which) => {
    if (!band.connected) { setCue("Connect the band first (Wi‑Fi or USB, top right)."); return; }
    if (pending.current) return;
    pending.current = true;
    let n = 3;
    setBusy(which);
    if (band.sim.current) band.sim.current.holdAt = which;
    setCue("");
    const tick = () => {
      if (n > 0) { setCapText(t => ({ ...t, [which]: `Hold still… ${n}` })); n--; timer.current = setTimeout(tick, 700); }
      else capture.current = { which, buf: [] };
    };
    tick();
  };

  const startCalib = () => {
    setDraft({}); setCapText({ start: "", final: "" }); setBusy(null);
    setCue(ex.hold ? "Get into position, then press A to record it." : "");
    setMode("calib");
  };

  const canSave = draft.start != null && (!!ex.hold || draft.final != null);
  const saveCalibration = () => {
    if (!canSave) return;
    onSaveCal({ start: draft.start!, final: ex.hold ? null : draft.final! });
    resetSet(); setCue(""); setMode("work");
  };

  const todays = todaysEntry(log, ex.id);
  const done = todays ? todays.sets.length : 0;
  // after the prescribed sets, the next one is an extra set the person chose to do
  const startNextSet = () => {
    if (done >= DOSE.maxSets) setExtra(true);
    resetSet();
    quietUntil.current = 0;
    setRestStartedAt(null);
    setCue("");
  };
  const finishSet = () => {
    const val = ex.hold ? Math.floor(engine.held) : engine.reps;
    if (!val) { setCue(ex.hold ? "Hold the position first." : "No reps yet."); return; }
    const l = NO_LOAD.has(ex.cat) ? "" : load.trim();
    onFinishSet(ex.hold ? { secs: val, breaks: engine.partials, load: l } : { reps: val, partials: engine.partials, load: l });
    const n = done + 1;
    resetSet();
    quietUntil.current = performance.now() + 4000;
    // rest after every set: the band is ignored until the person starts the next one
    setRestStartedAt(performance.now()); setRestSecs(0);
    setCue(n >= DOSE.maxSets
      ? `${extra ? "Extra set" : "Both sets"} logged. Rest as long as you need, then do another set if you want one.`
      : `Set ${n} logged. Rest as long as you need, then start set ${n + 1}.`);
  };

  const logRows = entries(log, ex.id).slice(-6).reverse();
  const receiving = band.receiving;
  const k = figurePhase(useFigureClock(!receiving && !ex.move));

  return (
    <section className="stage" aria-labelledby="ex-name">
      <div className="stage-left">
        <div className="stage-nav">
          <BackLink onClick={onBack}>Session</BackLink>
          <Button variant="ghost" onClick={onDemo}>▶ Watch demo</Button>
        </div>
        <p className="eyebrow">{categoryName(ex.cat)}</p>
        <h2 id="ex-name">{ex.name}</h2>
        <p className="placement">Strap on the {ex.where}</p>

        {!receiving && (
          <div className="prompt" role="status">
            <p>
              <b>{band.connected ? "Waiting for the band…" : "Band not connected."}</b>{" "}
              {band.connected
                ? (band.mode === "wifi" ? "Check the band is on and on the same Wi‑Fi as this computer." : "Check the USB cable, and that the sketch was uploaded with USE_YUN set to 0 (USB mode).")
                : "Connect it to calibrate and count your reps."}
            </p>
            <div className="prompt-btns">
              <Button variant="primary" onClick={() => void band.connect("wifi")}>Connect Wi‑Fi</Button>
              <Button onClick={() => void band.connect("usb")}>Connect USB</Button>
            </div>
          </div>
        )}

        {mode === "calib" ? (
          <div className="calib">
            {(["start", "final"] as const).filter(w => w === "start" || !ex.hold).map(w => (
              <button
                key={w} type="button" id={w === "start" ? "capStart" : "capFinal"}
                className={`step ${draft[w] != null ? "done" : ""} ${busy === w ? "busy" : ""}`}
                onClick={() => startCapture(w)}
              >
                <b>{w === "start" ? "A" : "B"}</b>
                <span className="pose"><Still ex={ex} k={w === "start" ? 0 : 1} /></span>
                <span className="step-text">
                  <em>{w === "start" ? ex.a : ex.b}</em>
                  {(capText[w] || draft[w] != null) && <small>{capText[w]}</small>}
                </span>
              </button>
            ))}
            <Button variant="primary" size="lg" className="save-cal" disabled={!canSave} onClick={saveCalibration}>Save calibration</Button>
          </div>
        ) : (
          <div className="work">
            <div className="dose">
              <span className="set-label">
                {extra ? `Extra set ${done + 1}` : done >= DOSE.maxSets ? `${done} sets done today` : `Set ${done + 1} of ${DOSE.minSets}–${DOSE.maxSets}`}
              </span>
              <span className="target">{ex.hold ? `Hold ${ex.hold}s` : `${DOSE.min}–${DOSE.max} reps`}</span>
              {!NO_LOAD.has(ex.cat) && (
                <label className="load">Load
                  <input
                    value={load} onChange={e => setLoad(e.target.value)} spellCheck={false}
                    placeholder={ex.cat === "carry" ? "e.g. 20 lb each" : "e.g. 15 lb"}
                  />
                </label>
              )}
            </div>
            {resting ? (
              <div className="rest" role="group" aria-label="Rest between sets">
                <p className="rest-label">Rest</p>
                <span className="clock" role="timer" aria-live="off">{mmss(restSecs)}</span>
                <Button variant="primary" size="lg" onClick={startNextSet}>
                  {done >= DOSE.maxSets ? "Do another set" : `Start set ${done + 1}`}
                </Button>
              </div>
            ) : (
              <>
                <div className="count">
                  <span key={bumpKey} className={`reps ${bumpKey ? "bump" : ""}`} aria-live="off">{ex.hold ? Math.floor(engine.held) : engine.reps}</span>
                  <span className="count-lbl">{ex.hold ? "Seconds" : "Reps"}</span>
                </div>
                <Tracker ex={ex} history={engine.history} held={engine.held} />
                <div className="actions">
                  {done >= DOSE.maxSets && !extra ? (
                    <Button variant="primary" size="lg" onClick={() => { setExtra(true); setCue(""); }}>Do another set</Button>
                  ) : (
                    <Button variant="primary" size="lg" onClick={finishSet}>Finish set</Button>
                  )}
                  <Button size="lg" onClick={() => { resetSet(); setCue(""); }}>Reset</Button>
                  <Button size="lg" onClick={startCalib}>Recalibrate</Button>
                </div>
              </>
            )}
            {readyToProgress(ex, log) && (
              <p className="note">{DOSE.max} reps on every set, two sessions in a row. Time to increase the load — check with your CEP or R.KIN.</p>
            )}
          </div>
        )}

        <p className="cue" role="status" aria-live="polite">{cue}</p>

        {mode === "work" && logRows.length > 0 && (
          <div className="log">
            <h3>Exercise log</h3>
            <LogTable
              head={["Date", "Sets", "Load"]}
              rows={logRows.map(e => [shortDate(e.date), setsSummary(ex, e), entryLoad(e) || "—"])}
            />
          </div>
        )}
      </div>

      <div className="stage-right">
        {receiving ? (
          <LiveDial zones={zones} hit={hit} angleRef={angleRef} connected={band.connected} isHold={!!ex.hold} partials={engine.partials} />
        ) : (
          <div className="preview" aria-hidden="true">
            {ex.move ? <Move ex={ex} /> : <FigureSvg ex={ex} k={k} />}
          </div>
        )}
      </div>
    </section>
  );
}

function Tracker({ ex, history, held }: { ex: Exercise; history: number[]; held: number }) {
  if (ex.hold) {
    return (
      <div className="tracker" aria-label="Progress this set">
        <div className="holdbar"><i style={{ width: `${Math.min(100, held / ex.hold * 100)}%` }} /><span>{ex.hold}s</span></div>
      </div>
    );
  }
  // One bar per rep, filled to the range reached. Empty slots run out to 20, with 10 and 20 marked.
  const n = history.length, total = Math.max(DOSE.max, n + 1);
  return (
    <div className="tracker" aria-label="Progress this set">
      {Array.from({ length: total }, (_, i) => {
        const mark = i + 1 === DOSE.min || i + 1 === DOSE.max ? " mark" : "";
        const state = i < n ? "done" : i === n ? "next" : "todo";
        return (
          <div key={i} className={`slot ${state}${mark}`}>
            <div className="bar">{i < n && <i style={{ height: `${Math.min(100, Math.round(history[i] * 100))}%` }} />}</div>
            <small>{i + 1}</small>
          </div>
        );
      })}
    </div>
  );
}
