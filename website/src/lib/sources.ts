/** Ways to get {pitch, roll, bpm?} samples from the band: Wi-Fi polling, USB serial, or a simulation. */
export interface Sample { pitch?: number; roll?: number; bpm?: number | null }
export interface Source { stop(): void | Promise<void> }

/** Wi-Fi: poll the Arduino sketch's HTTP server (returns {"pitch":..,"roll":..}). */
export function wifiSource(host: string, onSample: (s: Sample) => void, onFail: () => void): Source {
  let on = true, fails = 0;
  (async function loop() {
    while (on) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      try {
        const r = await fetch(`http://${host}/`, { signal: ctl.signal, cache: "no-store" });
        onSample(await r.json());
        fails = 0;
      } catch {
        if (++fails === 3) onFail();
      }
      clearTimeout(t);
      await new Promise(r => setTimeout(r, 40));
    }
  })();
  return { stop() { on = false; } };
}

/** USB: Web Serial (Chrome / Edge). The sketch prints one JSON line per sample. */
export async function serialSource(onSample: (s: Sample) => void): Promise<Source> {
  if (!("serial" in navigator)) throw new Error("USB needs Chrome or Edge.");
  let port: SerialPort;
  try { port = await navigator.serial.requestPort(); }
  catch { throw new Error("No port picked."); }
  try { await port.open({ baudRate: 115200 }); }
  catch (err) {
    // Already open in this page (e.g. after a reconnect) is fine; anything else means another program has it.
    if ((err as Error).name !== "InvalidStateError")
      throw new Error("Port is busy. Close the Arduino Serial Monitor/Plotter and other tabs using it, then try again.");
  }
  const reader = port.readable!.pipeThrough(new TextDecoderStream()).getReader();
  let on = true, buf = "";
  (async () => {
    while (on) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) { try { onSample(JSON.parse(l)); } catch { /* partial or noisy line: skip */ } }
    }
  })();
  return { async stop() { on = false; try { await reader.cancel(); await port.close(); } catch { /* already closed */ } } };
}

export interface DemoContext { range: [number, number]; working: boolean }
export interface DemoSource extends Source {
  holdAt: "start" | "final" | null;
  reset(): void;
  release(): void;
}

/** Demo (?demo): a simulated limb moving between two angles, with the odd short rep.
 *  For holds (start == end) it sits in position and now and then drifts out. */
export function demoSource(getContext: () => DemoContext, onSample: (s: Sample) => void): DemoSource {
  let t = 0, depth = 1, prevPhase = 0;
  const id = setInterval(() => {
    const { range: [lo, hi], working } = getContext();
    t += 0.05;
    const phase = (Math.sin(t * 1.6 - Math.PI / 2) + 1) / 2;
    if (prevPhase > 0.02 && phase <= 0.02) depth = Math.random() < 0.2 ? 0.55 + Math.random() * 0.2 : 1 + Math.random() * 0.08;
    prevPhase = phase;
    const hold = api.holdAt === "start" ? 0 : api.holdAt === "final" ? 1
               : !working || t < 3 ? 0 : phase * depth;
    const drift = lo === hi && working && t % 14 > 12 ? 20 : 0;
    onSample({ pitch: lo + (hi - lo) * hold + drift + (Math.random() - 0.5) * 1.6, roll: lo + (hi - lo) * hold + drift });
  }, 50);
  const api: DemoSource = {
    holdAt: null,
    stop() { clearInterval(id); },
    reset() { t = 0; },
    release() { api.holdAt = null; t = 0; },
  };
  return api;
}
