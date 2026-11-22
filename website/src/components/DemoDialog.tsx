import { useEffect, useRef } from "react";
import { DOSE, categoryName, type Exercise } from "../data/program";
import { useFigureClock } from "../hooks/useFigureClock";
import { figurePhase } from "../lib/figure";
import { FigureSvg, Move } from "./Figure";
import { Button } from "./ui";

interface Props {
  ex: Exercise | null;
  startAfter: boolean;
  saved: boolean;
  onClose: () => void;
  onGo: () => void;
}

/** Pop-up with the movement animated and how-to steps. */
export function DemoDialog({ ex, startAfter, saved, onClose, onGo }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const clock = useFigureClock(!!ex && !ex.move);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ex && !d.open) d.showModal();
    if (!ex && d.open) d.close();
  }, [ex]);

  const k = figurePhase(clock);
  const t = (clock % 3200) / 3200;
  const atB = ex?.move ? t >= 0.45 && t < 0.95 : k >= 0.5;

  return (
    <dialog
      ref={ref} className="demo" aria-labelledby="demoName"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) ref.current?.close(); }}
    >
      {ex && (
        <>
          <button type="button" className="demo-close" aria-label="Close" onClick={() => ref.current?.close()}>×</button>
          <div className="demo-figwrap">
            <div className="demo-fig">{ex.move ? <Move ex={ex} /> : <FigureSvg ex={ex} k={k} />}</div>
            <p className="demo-phase">{ex.hold ? `Hold ${ex.hold}s` : atB ? "B · End" : "A · Start"}</p>
          </div>
          <div className="demo-body">
            <p className="eyebrow">{categoryName(ex.cat)}</p>
            <h2 id="demoName">{ex.name}</h2>
            <p className="demo-dose">
              {ex.hold ? `${DOSE.minSets}–${DOSE.maxSets} holds of ${ex.hold}s` : `${DOSE.minSets}–${DOSE.maxSets} sets of ${DOSE.min}–${DOSE.max} reps`}
            </p>
            <ol className="demo-steps">
              <li>Strap the band on the <b>{ex.where}</b>{ex.move ? "" : " — the green mark on the figure"}.</li>
              <li><b>Start:</b> {ex.a.toLowerCase()}.</li>
              {ex.hold
                ? <li>Hold it for <b>{ex.hold} seconds</b>. The clock only runs while you stay in position.</li>
                : <>
                    <li><b>Move to:</b> {ex.b!.toLowerCase()}.</li>
                    <li>Come back to the start — that’s one rep.</li>
                  </>}
              <li className="tip">{ex.tip}</li>
            </ol>
            <Button variant="primary" size="lg" onClick={() => { ref.current?.close(); onGo(); }}>
              {startAfter ? (saved ? "Start exercise" : "Start — calibrate first") : "Back to exercise"}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
