import { useState, type FormEvent } from "react";
import type { Cardio } from "../hooks/useCardio";
import { useHeartRateMonitor } from "../hooks/useHeartRateMonitor";
import { mmss, shortDate } from "../lib/format";
import { HR_DEFAULT, MACHINES, MACHINE_TIPS, PHASES, average, zoneOf, type PhaseId } from "../lib/hr";
import { BackLink, Button, LogTable } from "./ui";

interface Props {
  cardio: Cardio;
  bandConnected: boolean;
  monitor: ReturnType<typeof useHeartRateMonitor>;
  onBack: () => void;
  onNext: () => void;
}

function stateText(c: Cardio, bandConnected: boolean, monitorConnected: boolean) {
  const P = PHASES[c.phase], tips = MACHINE_TIPS[c.machine], zs = c.fresh ? zoneOf(c.z, P, c.bpm) : null;
  if (!c.z) return "Enter resting and max HR to get zone guidance.";
  if (!c.fresh) {
    return monitorConnected ? "Waiting for your monitor…"
      : bandConnected ? "Waiting for a pulse. Rest a fingertip lightly on the band's heart sensor."
      : "No heart rate yet. Connect the band or a monitor, or type it in from the machine below.";
  }
  if (zs === "in") return P.lo ? "In your zone. Hold this pace." : "Nice and easy. Keep it here.";
  if (zs === "low") return `Below your zone. ${tips.up}`;
  return P.lo ? `Above your zone. ${tips.down}` : `Too hard for a ${P.name.toLowerCase()}. ${tips.down}`;
}

/** Heart rate over this phase, with the target band shaded. */
function Trace({ c }: { c: Cardio }) {
  const P = PHASES[c.phase], z = c.z, W = 600, H = 170;
  const lo = z ? z.rest - 5 : 50, hi = z ? z.max : 190;
  const x = (t: number) => (t / Math.max(P.max, c.elapsed)) * W, y = (b: number) => H - ((b - lo) / (hi - lo)) * H;
  const a = z ? y(z.at(P.hi)) : 0, b = z ? y(P.lo ? z.at(P.lo) : lo) : 0;
  return (
    <svg className="hr-trace" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Heart rate this phase">
      {z && <rect className="band" x="0" y={a.toFixed(1)} width={W} height={(b - a).toFixed(1)} />}
      <line className="min" x1={x(P.min).toFixed(1)} x2={x(P.min).toFixed(1)} y1="0" y2={H} />
      {c.samples.length > 0 && <polyline points={c.samples.map(p => `${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(" ")} />}
    </svg>
  );
}

export function CardioScreen({ cardio: c, bandConnected, monitor, onBack, onNext }: Props) {
  const [typed, setTyped] = useState("");
  const P = PHASES[c.phase], z = c.z;
  const order: PhaseId[] = c.phase === "cooldown" ? ["cooldown"] : ["warmup", "cardio"];
  const zs = c.fresh ? zoneOf(z, P, c.bpm) : null;
  const typical = Number(c.rest) === HR_DEFAULT.rest && Number(c.max) === HR_DEFAULT.max;
  const bpms = c.samples.map(s => s.bpm);
  const mark = z && c.fresh && c.bpm != null ? Math.max(0, Math.min(1, (c.bpm - z.rest) / (z.max - z.rest))) : null;
  const rows = c.log.slice(-8).reverse();

  const submit = (e: FormEvent) => { e.preventDefault(); c.submitManual(Number(typed)); setTyped(""); };

  return (
    <section className="stage cardio" aria-labelledby="phase-name">
      <div className="stage-left">
        <div className="stage-nav"><BackLink onClick={onBack}>Session</BackLink></div>
        <p className="eyebrow">Cardio</p>
        <h2 id="phase-name">{P.name}</h2>
        <p className="placement">{P.how}</p>

        <ol className="phase-steps">
          {order.map(k => (
            <li key={k} className={k === c.phase ? "on" : order.indexOf(k) < order.indexOf(c.phase) ? "done" : ""}>
              <b>{PHASES[k].name}</b><span>{PHASES[k].min / 60}–{PHASES[k].max / 60} min</span>
            </li>
          ))}
          {c.phase !== "cooldown" && <li><b>Strength</b><span>after cardio</span></li>}
        </ol>

        <div className="machines" role="radiogroup" aria-label="Machine">
          {MACHINES.map(m => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === c.machine} onClick={() => c.setMachine(m.id)}>{m.label}</button>
          ))}
        </div>

        <div className="count">
          <span className="clock">{mmss(c.elapsed)}</span>
          <span className="count-lbl">of {P.min / 60}–{P.max / 60} min</span>
        </div>
        <div className="timebar">
          <i style={{ width: `${Math.min(100, c.elapsed / P.max * 100)}%` }} />
          <b style={{ left: `${P.min / P.max * 100}%` }} />
        </div>

        <div className="actions">
          <Button variant="primary" size="lg" onClick={c.toggleRun}>{c.running ? "Pause" : c.elapsed ? "Resume" : "Start"}</Button>
          <Button size="lg" onClick={onNext}>
            {c.phase === "warmup" ? "Start cardio →" : c.phase === "cardio" ? "Done — on to strength" : "Finish session"}
          </Button>
        </div>
        <p className="cue" role="status" aria-live="polite">{c.cue}</p>

        <div className="hrr">
          <label>Resting HR
            <input type="number" inputMode="numeric" min={30} max={130} placeholder="—" value={c.rest} onChange={e => c.setRest(e.target.value)} />
          </label>
          <label>Max HR
            <input type="number" inputMode="numeric" min={80} max={230} placeholder="—" value={c.max} onChange={e => c.setMax(e.target.value)} />
          </label>
          <output>{z ? <>Cardio zone <b>{z.at(.4)}–{z.at(.6)} bpm</b></> : "Enter both to see your target zone."}</output>
        </div>
        <p className="fine">
          {typical
            ? "These are typical starting values. Change them to your own from your graded exercise test (your CEP or R.KIN has them)."
            : "From your graded exercise test. Your CEP or R.KIN can give you these numbers."}
        </p>

        {rows.length > 0 && (
          <div className="log">
            <h3>Cardio log</h3>
            <LogTable
              head={["Date", "Phase", "Time", "In zone", "Avg HR"]} numericFrom={2}
              rows={rows.map(e => [shortDate(e.date), PHASES[e.phase].name, mmss(e.secs), mmss(e.inZone), e.avg ?? "—"])}
            />
          </div>
        )}
      </div>

      <div className="stage-right">
        <div className="hr-now">
          <span className={`hr-value ${c.fresh ? "" : "empty"}`}>{c.fresh ? c.bpm : "--"}</span>
          <span className="count-lbl">bpm</span>
        </div>
        <p className={`hr-state ${zs || ""}`} role="status" aria-live="polite">{stateText(c, bandConnected, monitor.connected)}</p>

        <div className="hrbar">
          {[0, 1, 2].map(i => <i key={i} className={`seg ${i === 1 ? "zone" : i === 0 ? "easy" : "high"} ${(P.lo === 0 ? i === 0 : i === 1) ? "target" : ""}`} />)}
          {mark != null && <b style={{ left: `${mark * 100}%` }} />}
        </div>
        <div className="hrbar-lbl">
          <span>{z ? z.rest : "Rest"}</span><span>{z ? `${z.at(.4)}–${z.at(.6)}` : "40–60%"}</span><span>{z ? z.max : "Max"}</span>
        </div>

        <Trace c={c} />

        <dl className="readout">
          <div><dt>In zone</dt><dd>{mmss(c.inZone)}</dd></div>
          <div><dt>Average</dt><dd>{average(bpms) ?? "—"}</dd></div>
          <div><dt>Peak</dt><dd>{bpms.length ? Math.max(...bpms) : "—"}</dd></div>
        </dl>

        <div className="hr-src">
          <Button onClick={() => void monitor.toggle()}>{monitor.connected ? "Disconnect monitor" : "Connect heart‑rate monitor"}</Button>
          <span className="fine" role="status">{monitor.status}</span>
          <form className="hr-manual" onSubmit={submit}>
            <label>Or type it from the machine
              <input type="number" inputMode="numeric" min={30} max={230} placeholder="bpm" value={typed} onChange={e => setTyped(e.target.value)} />
            </label>
            <Button type="submit">Log</Button>
          </form>
        </div>
      </div>
    </section>
  );
}
