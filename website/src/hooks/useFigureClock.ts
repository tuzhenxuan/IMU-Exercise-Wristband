import { useEffect, useState } from "react";

/** Animation clock (ms) for the looping figure demos. Idle (no re-renders) when `active` is false. */
export function useFigureClock(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = (t: number) => { setNow(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}
