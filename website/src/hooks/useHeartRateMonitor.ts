import { useCallback, useRef, useState } from "react";

/** Bluetooth heart-rate monitor (chest strap / watch broadcasting the standard Heart Rate service). */
export function useHeartRateMonitor(onHR: (bpm: number) => void) {
  const device = useRef<BluetoothDevice | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const onHRRef = useRef(onHR);
  onHRRef.current = onHR;

  const toggle = useCallback(async () => {
    if (device.current) { device.current.gatt?.disconnect(); return; }
    try {
      if (!navigator.bluetooth) throw new Error("Bluetooth heart‑rate monitors need Chrome or Edge.");
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      setStatus("Connecting…");
      const server = await dev.gatt!.connect();
      const ch = await (await server.getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
      ch.addEventListener("characteristicvaluechanged", (e) => {
        const v = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        onHRRef.current(v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1));   // flag bit 0: 16-bit value
      });
      await ch.startNotifications();
      device.current = dev; setConnected(true);
      setStatus(`Connected: ${dev.name || "heart‑rate monitor"}`);
      dev.addEventListener("gattserverdisconnected", () => {
        device.current = null; setConnected(false); setStatus("Monitor disconnected.");
      });
    } catch (err) {
      if ((err as Error).name !== "NotFoundError") setStatus(String((err as Error).message || err));
    }
  }, []);

  return { connected, status, toggle };
}
