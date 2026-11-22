import { useCallback, useEffect, useRef, useState } from "react";
import { EXERCISES, type Exercise } from "./data/program";
import { CardioScreen } from "./components/CardioScreen";
import { DemoDialog } from "./components/DemoDialog";
import { Header } from "./components/Header";
import { PickScreen } from "./components/PickScreen";
import { Stage } from "./components/Stage";
import { IS_DEMO, useBand } from "./hooks/useBand";
import { useCardio } from "./hooks/useCardio";
import { useHeartRateMonitor } from "./hooks/useHeartRateMonitor";
import { addSet, isSaved, type Calibration, type Log, type Saved, type SetRecord } from "./lib/log";
import type { PhaseId } from "./lib/hr";
import { KEYS, load, save } from "./lib/storage";

type View = "pick" | "cardio" | "stage";

export default function App() {
  const [view, setView] = useState<View>("pick");
  const [ex, setEx] = useState<Exercise>(EXERCISES[0]);
  const [stageKey, setStageKey] = useState(0);
  const [saved, setSaved] = useState<Saved>(() => load(KEYS.cal, {}));
  const [log, setLog] = useState<Log>(() => load(KEYS.log, {}));
  const [loads, setLoads] = useState<Record<string, string>>(() => load(KEYS.loads, {}));
  const [demo, setDemo] = useState<{ ex: Exercise; startAfter: boolean } | null>(null);

  // the simulated band follows the current exercise and whether we're counting reps
  const demoCtx = useRef({ range: ex.demo, working: false });
  demoCtx.current = { range: ex.demo, working: view === "stage" };
  const band = useBand(useCallback(() => demoCtx.current, []));
  const cardio = useCardio(IS_DEMO, band.subscribe);
  const monitor = useHeartRateMonitor(cardio.submitManual);

  const goHome = useCallback(() => {
    cardio.pause();
    setView("pick");
    window.scrollTo(0, 0);
  }, [cardio]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const pick = (id: string) => {
    setEx(EXERCISES.find(e => e.id === id)!);
    setStageKey(k => k + 1);
    setView("stage");
  };

  const openCardio = (phase: PhaseId) => { cardio.startPhase(phase); setView("cardio"); };

  const nextPhase = () => {
    cardio.logPhase();
    if (cardio.phase === "warmup") { cardio.startPhase("cardio"); cardio.resume(); return; }
    const toStrength = cardio.phase === "cardio";
    goHome();
    if (toStrength) requestAnimationFrame(() => document.getElementById("strength")?.scrollIntoView());
  };

  const saveCal = (cal: Calibration) => {
    const next = { ...saved, [ex.id]: cal };
    setSaved(next); save(KEYS.cal, next);
  };
  const finishSet = (set: SetRecord) => {
    const nextLoads = { ...loads, [ex.id]: set.load };
    setLoads(nextLoads); save(KEYS.loads, nextLoads);
    const nextLog = addSet(log, ex.id, set);
    setLog(nextLog); save(KEYS.log, nextLog);
  };

  return (
    <>
      <Header band={band} onHome={goHome} />
      <main className="wrap">
        {view === "pick" && (
          <PickScreen
            log={log} saved={saved} cardioLog={cardio.log} z={cardio.z}
            onPick={id => setDemo({ ex: EXERCISES.find(e => e.id === id)!, startAfter: true })}
            onStartWarm={() => openCardio("warmup")} onStartCool={() => openCardio("cooldown")}
          />
        )}
        {view === "cardio" && (
          <CardioScreen cardio={cardio} bandConnected={band.connected} monitor={monitor} onBack={goHome} onNext={nextPhase} />
        )}
        {view === "stage" && (
          <Stage
            key={stageKey} ex={ex} saved={saved} log={log} initialLoad={loads[ex.id] || ""} band={band}
            onBack={goHome} onDemo={() => setDemo({ ex, startAfter: false })}
            onSaveCal={saveCal} onFinishSet={finishSet}
          />
        )}
      </main>
      <DemoDialog
        ex={demo?.ex ?? null} startAfter={demo?.startAfter ?? false} saved={demo ? isSaved(demo.ex, saved) : false}
        onClose={() => setDemo(null)}
        onGo={() => { if (demo?.startAfter) pick(demo.ex.id); }}
      />
    </>
  );
}
