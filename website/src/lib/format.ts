export const pad = (n: number) => String(n).padStart(2, "0");
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** YYYY-MM-DD in local time. */
export const today = () => new Date().toLocaleDateString("en-CA");
export const shortDate = (iso: string) => new Date(iso + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
