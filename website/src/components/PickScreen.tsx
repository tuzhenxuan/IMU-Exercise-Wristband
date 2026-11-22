import { CATEGORIES, DOSE, EXERCISES, type Exercise } from "../data/program";
import { pad } from "../lib/format";
import type { CardioEntry, Log, Saved } from "../lib/log";
import { entries, entryLoad, isSaved, readyToProgress, sessionInfo, setsSummary, todaysEntry } from "../lib/log";
import type { Reserve } from "../lib/hr";
import { IS_DEMO } from "../hooks/useBand";
import { Move, MotionArc } from "./Figure";
import { Button } from "./ui";

function ExerciseRow({ ex, log, saved, onPick }: { ex: Exercise; log: Log; saved: Saved; onPick: (id: string) => void }) {
  const done = todaysEntry(log, ex.id);
  const [cls, text] = done && done.sets.length ? ["done", "Done today"]
                    : readyToProgress(ex, log)  ? ["up", "Add load"]
                    : isSaved(ex, saved)        ? ["saved", "Saved"]
                    :                             ["new", "Calibrate"];
  const last = entries(log, ex.id).slice(-1)[0];
  const sub = last ? `Last: ${setsSummary(ex, last)}${entryLoad(last) ? " @ " + entryLoad(last) : ""}`
            : ex.hold ? `Hold ${ex.hold}s` : `${DOSE.min}–${DOSE.max} reps`;
  return (
    <li>
      <button type="button" className="row" onClick={() => onPick(ex.id)}>
        <span className="row-fig"><Move ex={ex} /></span>
        <span className="row-name">{ex.name}<small>{sub}</small></span>
        <MotionArc ex={ex} saved={saved} />
        <span className={`tag ${cls}`}>{text}</span>
      </button>
    </li>
  );
}

interface Props {
  log: Log; saved: Saved; cardioLog: CardioEntry[]; z: Reserve | null;
  onPick: (id: string) => void; onStartWarm: () => void; onStartCool: () => void;
}

export function PickScreen({ log, saved, cardioLog, z, onPick, onStartWarm, onStartCool }: Props) {
  const s = sessionInfo(log, cardioLog);
  return (
    <section className="page" aria-labelledby="pick-title">
      <div className="page-head">
        <h1 id="pick-title">Today’s session</h1>
        <p className="lede">
          Session <b>{s.inBlock}</b> of {DOSE.block} in this program block ·{" "}
          {s.inBlock === DOSE.block ? "new exercises start next session" : `new exercises after session ${DOSE.block}`}
          <br />Each exercise: {DOSE.minSets}–{DOSE.maxSets} sets of {DOSE.min}–{DOSE.max} reps.
        </p>
        <div className="progress" role="img" aria-label={`Session ${s.inBlock} of ${DOSE.block}`}>
          {Array.from({ length: DOSE.block }, (_, i) => <i key={i} className={i < s.inBlock ? "on" : ""} />)}
        </div>
        <p className="demo-note">
          {IS_DEMO
            ? <>Demo mode: the band and heart rate are simulated. <a href="./">Use the real band</a></>
            : <>No band with you? <a href="?demo">Try demo mode</a> to see everything working.</>}
        </p>
      </div>

      <article className="card bookend">
        <div>
          <h2>Warm‑up &amp; cardio</h2>
          <p>3–5 min easy, then 15–30 min of moderate cardio on a treadmill, recumbent bike or elliptical at 40–60% of your heart‑rate reserve.</p>
          <p className="zone-summary">
            {z ? <>Your cardio zone: <b>{z.at(.4)}–{z.at(.6)} bpm</b> · warm‑up and cool‑down under {z.at(.4)} bpm</>
               : "Set your resting and max heart rate on the cardio screen to get your zone."}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onStartWarm}>Start warm‑up</Button>
      </article>

      <div className="part" id="strength">
        <h2>Strength training</h2>
        <p>Every major muscle group: quads, hamstrings, glutes, chest, back, shoulders, arms and core. 2 exercises per category, 1–2 sets of 10–20 reps each. Tap one to see how it’s done.</p>
      </div>

      <div className="plan">
        {CATEGORIES.map((c, i) => (
          <section className="card cat" key={c.id} aria-labelledby={`cat-${c.id}`}>
            <header>
              <span className="cat-num">{pad(i + 1)}</span>
              <div>
                <h3 id={`cat-${c.id}`}>{c.name}</h3>
                <p>{c.note}</p>
              </div>
            </header>
            <ol className="pick-list">
              {EXERCISES.filter(e => e.cat === c.id).map(e => <ExerciseRow key={e.id} ex={e} log={log} saved={saved} onPick={onPick} />)}
            </ol>
          </section>
        ))}
      </div>

      <article className="card bookend">
        <div>
          <h2>Cool‑down</h2>
          <p>3–5 min of easy, low‑intensity cardio.</p>
        </div>
        <Button variant="secondary" size="lg" onClick={onStartCool}>Start cool‑down</Button>
      </article>

      <a className="credits" href="CREDITS.md">Illustration credits</a>
    </section>
  );
}
