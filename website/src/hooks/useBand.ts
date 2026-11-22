import { useCallback, useEffect, useRef, useState } from "react";
import { demoSource, serialSource, wifiSource, type DemoContext, type DemoSource, type Sample, type Source } from "../lib/sources";

export type LinkMode = "wifi" | "usb";
export type Mode = LinkMode | "demo";

export const IS_DEMO = new URLSearchParams(location.search).has("demo");
const DEFAULT_HOST = "arduino.local:5555";

type Listener = (s: Sample) => void;

/** Owns the connection to the band (Wi-Fi, USB or demo) and fans samples out to subscribers. */
export function useBand(getDemoContext: () => DemoContext) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [host, setHost] = useState(DEFAULT_HOST);
  const [linkText, setLinkText] = useState<Record<LinkMode, string>>({ wifi: "", usb: "" });
  const [live, setLive] = useState(false);          // "connected" light on the active link
  const [receiving, setReceiving] = useState(false); // samples arrived in the last second

  const source = useRef<Source | null>(null);
  const sim = useRef<DemoSource | null>(null);
  const modeRef = useRef<Mode | null>(null);
  const listeners = useRef(new Set<Listener>());
  const lastSampleAt = useRef(0);
  const demoContext = useRef(getDemoContext);
  demoContext.current = getDemoContext;

  const setText = useCallback((m: Mode | null, text: string) => {
    if (m === "wifi" || m === "usb") setLinkText(t => ({ ...t, [m]: text }));
  }, []);

  const emit = useCallback((s: Sample) => {
    lastSampleAt.current = performance.now();
    listeners.current.forEach(fn => fn(s));
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const disconnect = useCallback(() => {
    void source.current?.stop();
    setText(modeRef.current, "");
    source.current = null; sim.current = null; modeRef.current = null;
    lastSampleAt.current = 0;
    setMode(null); setLive(false); setReceiving(false);
  }, [setText]);

  const connect = useCallback(async (m: Mode) => {
    if (source.current) disconnect();
    modeRef.current = m; setMode(m);
    try {
      let src: Source;
      if (m === "demo") src = sim.current = demoSource(() => demoContext.current(), emit);
      else if (m === "wifi") src = wifiSource(host.trim(), emit, () => { setText("wifi", "No reply. Same Wi‑Fi?"); setLive(false); });
      else src = await serialSource(emit);
      source.current = src;
      setText(m, "Connecting…"); setLive(true);
    } catch (err) {
      source.current = null; modeRef.current = null; setMode(null); setLive(false);
      setText(m, String((err as Error).message || err));
    }
  }, [disconnect, emit, host, setText]);

  // "receiving" is derived from sample recency, checked a few times a second.
  useEffect(() => {
    const id = setInterval(() => {
      const r = !!source.current && performance.now() - lastSampleAt.current < 1000;
      setReceiving(prev => (prev === r ? prev : r));
    }, 200);
    return () => clearInterval(id);
  }, []);

  // First good sample after (re)connecting: mark the link live.
  useEffect(() => {
    if (receiving && mode) { setText(mode, "Connected"); setLive(true); }
  }, [receiving, mode, setText]);

  useEffect(() => {
    if (IS_DEMO) void connect("demo");
    return () => { void source.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mode, host, setHost, linkText, live, receiving,
    connected: mode !== null,
    connect, disconnect, subscribe,
    toggle: (m: LinkMode) => (source.current && modeRef.current === m ? disconnect() : void connect(m)),
    sim,
  };
}
export type Band = ReturnType<typeof useBand>;
