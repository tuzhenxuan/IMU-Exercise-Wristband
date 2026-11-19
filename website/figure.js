/* Exercise figures: a simple jointed body drawn as SVG.
 * A pose is a set of segment angles in degrees, measured from straight down,
 * positive = toward the figure's front (screen right in side view, outward in front view).
 *   t  = torso (hip → neck)            nl / fl = near / far leg  [thigh, shin, foot?]
 *   na / fa = near / far arm [upper, forearm]
 * The far limbs default to the near ones. In front view the far side is mirrored.
 * figureSVG(ex, k) draws the pose k of the way from fig.a to fig.b (0..1), standing on the floor,
 * with the IMU band highlighted where it should be strapped.
 */
const FIG = (() => {
  const LEN = { torso: 64, neck: 15, thigh: 50, shin: 48, foot: 14, upper: 36, fore: 34 };
  const SIZE = 264, FLOOR = 250, HEAD = 12;
  const dir = (a) => [Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
  const add = (p, a, len) => { const [x, y] = dir(a); return [p[0] + x * len, p[1] + y * len]; };
  const lerp = (a, b, k) => a + (b - a) * k;

  function lerpPose(A, B, k) {
    const P = {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[key] ?? B[key], b = B[key] ?? A[key];
      P[key] = Array.isArray(a) ? a.map((v, i) => v == null || b[i] == null ? (v ?? b[i]) : lerp(v, b[i], k)) : lerp(a, b, k);
    }
    return P;
  }

  function joints(fig, P) {
    const front = fig.view === "front";
    const hip = [0, 0], neck = add(hip, P.t, LEN.torso), head = add(neck, P.t, LEN.neck), sh = add(hip, P.t, LEN.torso - 6);
    const [tx, ty] = dir(P.t), perp = [-ty, tx];   // screen-right when the torso is upright
    const J = { hip, neck, head, sh };
    for (const [k, s] of [["n", 1], ["f", -1]]) {
      const leg = P[k + "l"] || P.nl, arm = P[k + "a"] || P.na;
      const ang = (a) => front && s < 0 ? -a : a;
      const off = (p, w) => front ? [p[0] + perp[0] * w * s, p[1] + perp[1] * w * s] : p;
      const h = off(hip, 10), shj = off(sh, 19);
      const knee = add(h, ang(leg[0]), LEN.thigh), ankle = add(knee, ang(leg[1]), LEN.shin);
      const toe = front ? add(ankle, ang(70), 8) : add(ankle, leg[2] ?? leg[1] + 90, LEN.foot);
      const elbow = add(shj, ang(arm[0]), LEN.upper), hand = add(elbow, ang(arm[1]), LEN.fore);
      J[k] = { hip: h, sh: shj, knee, ankle, toe, elbow, hand };
    }
    return J;
  }

  const get = (J, path) => path.split(".").reduce((o, k) => o[k], J);
  const SEGS = { torso: ["hip", "neck"], thigh: ["hip", "knee"], shin: ["knee", "ankle"], upper: ["sh", "elbow"], fore: ["elbow", "hand"] };
  function points(J) {
    const pts = [[J.hip, 8], [J.neck, 8], [J.head, HEAD]];
    for (const s of ["n", "f"]) for (const k in J[s]) pts.push([J[s][k], 5]);
    return pts;
  }

  // Fixed horizontal placement per exercise, so the anchor joint (usually the feet) never slides.
  function place(ex) {
    const f = ex.fig;
    if (f._x != null) return;
    let lo = Infinity, hi = -Infinity;
    for (const P of [f.a, lerpPose(f.a, f.b || f.a, 1)]) {
      const J = joints(f, P), ax = get(J, f.anchor || "n.ankle")[0];
      for (const [[x], r] of points(J)) { lo = Math.min(lo, x - ax - r); hi = Math.max(hi, x - ax + r); }
    }
    f._x = SIZE / 2 - (lo + hi) / 2;
  }

  const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const n1 = (v) => v.toFixed(1);
  const line = (p, q, w, cls = "") => `<line class="${cls}" x1="${n1(p[0])}" y1="${n1(p[1])}" x2="${n1(q[0])}" y2="${n1(q[1])}" stroke-width="${w}"/>`;

  function svg(ex, k = 0, cls = "") {
    const f = ex.fig, front = f.view === "front";
    place(ex);
    const P = lerpPose(f.a, f.b || f.a, ease(Math.max(0, Math.min(1, k))));
    const J = joints(f, P);
    const dx = f._x - get(J, f.anchor || "n.ankle")[0];
    const dy = FLOOR - Math.max(...points(J).map(([[, y], r]) => y + r));

    let back = `<line class="prop" x1="8" y1="${FLOOR}" x2="${SIZE - 8}" y2="${FLOOR}" stroke-width="2"/>`;
    if (f.props === "wallBack") back = `<rect class="wall" x="52" y="14" width="136" height="${FLOOR - 14}" rx="4"/>` + back;
    if (f.props === "wall") {
      const A = joints(f, f.a), wx = f._x + A.n.hand[0] - get(A, f.anchor || "n.ankle")[0] + 9;
      back += `<line class="prop" x1="${n1(wx)}" y1="20" x2="${n1(wx)}" y2="${FLOOR}" stroke-width="5"/>`;
    }

    const limb = (s, c) => line(J[s].hip, J[s].knee, 10, c) + line(J[s].knee, J[s].ankle, 10, c) + line(J[s].ankle, J[s].toe, 8, c);
    const arm = (s, c) => line(J[s].sh, J[s].elbow, 9, c) + line(J[s].elbow, J[s].hand, 8, c);
    const bell = (s, c = "") => {
      if (!(f.gear === "db" || (f.gear === "db1" && s === "n"))) return "";
      const [x, y] = J[s].hand;
      return front ? `<rect class="gear ${c}" x="${n1(x - 11)}" y="${n1(y - 4)}" width="22" height="8" rx="3"/>`
                   : `<circle class="gear ${c}" cx="${n1(x)}" cy="${n1(y + 2)}" r="8"/>`;
    };

    let body = "";
    if (front) {
      const { n, f: l } = J;
      body += limb("f", "") + limb("n", "");
      body += `<polygon class="trunk" points="${[l.hip, n.hip, n.sh, l.sh].map(p => p.map(n1).join(",")).join(" ")}"/>`;
      body += line(J.sh, J.neck, 8) + arm("f", "") + arm("n", "") + bell("f") + bell("n");
    } else {
      body += limb("f", "far") + arm("f", "far") + bell("f", "far");
      body += line(J.hip, J.neck, 16) + limb("n", "") + arm("n", "") + bell("n");
    }
    body += `<circle class="head" cx="${n1(J.head[0])}" cy="${n1(J.head[1])}" r="${HEAD}"/>`;

    // the band
    const [side, seg] = f.band[0].includes(".") ? f.band[0].split(".") : [null, f.band[0]];
    const [ja, jb] = SEGS[seg].map(j => side ? J[side][j] : J[j]);
    const p = [lerp(ja[0], jb[0], f.band[1]), lerp(ja[1], jb[1], f.band[1])];
    const L = Math.hypot(jb[0] - ja[0], jb[1] - ja[1]), u = [(jb[0] - ja[0]) / L, (jb[1] - ja[1]) / L];
    const band = front && seg === "torso"
      ? line(J.f.hip.map((v, i) => lerp(v, J.f.sh[i], f.band[1])), J.n.hip.map((v, i) => lerp(v, J.n.sh[i], f.band[1])), 8, "band")
      : line([p[0] - u[0] * 5, p[1] - u[1] * 5], [p[0] + u[0] * 5, p[1] + u[1] * 5], seg === "torso" ? 22 : 16, "band");

    return `<svg class="fig ${cls}" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${back}<g transform="translate(${n1(dx)} ${n1(dy)})">${body}${band}</g></svg>`;
  }

  // Loop timing for demos: hold at A, move to B, hold at B, come back.
  function phase(ms, period = 3600) {
    const x = (ms % period) / period;
    if (x < 0.15) return 0;
    if (x < 0.5) return (x - 0.15) / 0.35;
    if (x < 0.65) return 1;
    return 1 - (x - 0.65) / 0.35;
  }

  return { svg, phase };
})();
