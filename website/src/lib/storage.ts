/** localStorage with the same keys as the original app, so saved calibrations and logs carry over. */
export const KEYS = {
  cal: "imuband.cal",
  log: "imuband.log",
  loads: "imuband.loads",
  hr: "imuband.hr",
  cardio: "imuband.cardio",
} as const;

export function load<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? fallback; } catch { return fallback; }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: keep going without persistence */ }
}
