/** Half-circle dial geometry (−90° … +90°), shared by the live dial and the list thumbnails. */
export const CX = 300, CY = 310, R = 240;
export const clampAngle = (a: number) => Math.max(-90, Math.min(90, a));

function point(a: number, r: number, cx: number, cy: number): [number, number] {
  const th = (90 - clampAngle(a)) * Math.PI / 180;
  return [cx + r * Math.cos(th), cy - r * Math.sin(th)];
}

export function arcPath(a1: number, a2: number, r = R, cx = CX, cy = CY): string {
  const [lo, hi] = [clampAngle(Math.min(a1, a2)), clampAngle(Math.max(a1, a2))];
  const [x1, y1] = point(lo, r, cx, cy), [x2, y2] = point(hi, r, cx, cy);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export const dialPoint = (a: number, r = R) => point(a, r, CX, CY);

export const TICKS = Array.from({ length: 37 }, (_, i) => {
  const a = -90 + i * 5, major = a % 30 === 0;
  const [x1, y1] = dialPoint(a, R + 18), [x2, y2] = dialPoint(a, R + (major ? 32 : 24));
  return { a, major, x1, y1, x2, y2 };
});
