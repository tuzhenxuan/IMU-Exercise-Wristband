/* IMU Band — browser side
 * Session plan follows the CCCARE program: warm-up + cardio, 2 mobility exercises,
 * two exercises per functional category (squat/lunge, push, hinge, pull, carry, core),
 * stretches, cool-down. Picking an exercise opens a pop-up with an animated demo (figure.js).
 * Flow per exercise: calibrate A (start) and B (end) → save → do 1–2 sets of 10–20 reps.
 * Holds (carries, planks, wall sits, stretches) calibrate one position and time how long you stay in it.
 * Every set is logged with reps and load. After 20 reps on every set for two sessions in a row,
 * the app flags the exercise as ready for more load. New exercises come in every 12 sessions.
 * Data comes from the band over Yun Wi-Fi or USB serial ({pitch, roll} per sample).
 */

// ---------- program ----------
const DOSE = { minSets: 1, maxSets: 2, min: 10, max: 20, block: 12, tol: 12 };

const CATEGORIES = [
  { id: "mobility", name: "Mobility",      note: "Do both to start." },
  { id: "squat",    name: "Squat / Lunge", note: "Do both." },
  { id: "push",     name: "Push",          note: "Do both." },
  { id: "hinge",    name: "Hinge",         note: "Do both." },
  { id: "pull",     name: "Pull",          note: "Do both." },
  { id: "carry",    name: "Carry",         note: "Do both. Walk tall — the band times how long you stay upright." },
  { id: "core",     name: "Core",          note: "Do both." },
  { id: "stretch",  name: "Stretches",     note: "Hold each one." },
];

// a / b = start and end positions. hold = seconds to hold a (no b).
// demo = simulated start/end angles (only used with ?demo in the URL).
// fig = the drawing: poses a/b (see figure.js), where the band goes, equipment.
const EXERCISES = [
  // mobility
  { id: "rainbow",  cat: "mobility", name: "Arm Rainbows",        where: "upper arm, above the elbow",  axis: "roll",
    a: "Arm relaxed at your side",            b: "Arm swept up overhead",              demo: [-85, 80],
    tip: "Keep the elbow soft and move slowly through the whole arc.",
    fig: { view: "front", band: ["n.upper", .6], a: { t: 180, nl: [4, 0], na: [12, 8], fa: [12, 8] }, b: { na: [172, 176] } } },
  { id: "wallangel",cat: "mobility", name: "Wall Angels",         where: "upper arm, above the elbow",  axis: "roll",
    a: "Back on the wall, elbows at shoulder height", b: "Arms slid up the wall overhead", demo: [0, 70],
    tip: "Keep your head, upper back and hips touching the wall.",
    fig: { view: "front", props: "wallBack", band: ["n.upper", .6], a: { t: 180, nl: [4, 0], na: [90, 180] }, b: { na: [150, 172] } } },

  // squat / lunge
  { id: "squat",    cat: "squat",    name: "Squat",               where: "outside of the thigh",        axis: "pitch",
    a: "Standing tall",                       b: "Thighs parallel to floor",           demo: [-85, -5],
    tip: "Sit your hips back, chest up, knees tracking over your toes.", move: "img/moves/squat",
    fig: { band: ["n.thigh", .5], a: { t: 180, nl: [0, 0, 90], na: [20, 165] }, b: { t: 145, nl: [92, -28, 90], na: [55, 175] } } },
  { id: "legext",   cat: "squat",    name: "Seated Leg Extension",where: "front of the ankle",          axis: "pitch",
    a: "Knee bent 90°, foot down",            b: "Leg straight out",                   demo: [-75, 5],
    tip: "Straighten all the way, then lower slowly — don’t let the weight drop.", move: "img/moves/leg-extension" },

  // push
  { id: "press",    cat: "push",     name: "Shoulder Press",      where: "upper arm, above the elbow",  axis: "roll",
    a: "Hands at shoulder height",            b: "Arms straight overhead",             demo: [0, 75],
    tip: "Brace your core and don’t arch your lower back.", move: "img/moves/shoulder-press",
    fig: { view: "front", gear: "db", band: ["n.upper", .6], a: { t: 180, nl: [5, 0], na: [80, 178] }, b: { na: [166, 178] } } },
  { id: "lateral",  cat: "push",     name: "Lateral Raise",       where: "upper arm, above the elbow",  axis: "roll",
    a: "Arm relaxed at your side",            b: "Arm out at shoulder height",         demo: [-85, 0],
    tip: "Lead with your elbows and stop at shoulder height.", move: "img/moves/lateral-raise" },

  // hinge
  { id: "rdl",      cat: "hinge",    name: "Romanian Deadlift",   where: "chest, below the collarbone", axis: "pitch",
    a: "Standing tall",                       b: "Hips back, torso tipped forward",    demo: [80, 20],
    tip: "Push your hips back with a flat back — knees only slightly bent.",
    fig: { gear: "db", band: ["torso", .8], a: { t: 180, nl: [0, 0, 90], na: [0, 0] }, b: { t: 102, nl: [14, -2, 90], na: [0, 0] } } },
  { id: "bridge",   cat: "hinge",    name: "Glute Bridge",        where: "front of the thigh",          axis: "pitch",
    a: "Lying down, hips on the floor",       b: "Hips up, knees to shoulders in a line", demo: [40, 5],
    tip: "Squeeze your glutes at the top and don’t arch your lower back.",
    fig: { band: ["n.thigh", .5], a: { t: -90, nl: [135, 18, 90], na: [92, 90] }, b: { t: -68, nl: [100, 5, 90], na: [112, 90] } } },

  // pull
  { id: "curl",     cat: "pull",     name: "Arm Curl",            where: "inside of the wrist",         axis: "pitch",
    a: "Arm straight down",                   b: "Fist up at your shoulder",           demo: [-80, 55],
    tip: "Keep your elbow pinned to your side.", move: "img/moves/arm-curl",
    fig: { gear: "db", band: ["n.fore", .8], a: { t: 180, nl: [0, 0, 90], na: [0, 0] }, b: { na: [8, 158] } } },
  { id: "row",      cat: "pull",     name: "Bent‑Over Row",       where: "upper arm, above the elbow",  axis: "pitch",
    a: "Arm hanging straight down",           b: "Elbow pulled back past your side",   demo: [-85, -25],
    tip: "Flat back. Pull your elbow toward your hip.",
    fig: { gear: "db", band: ["n.upper", .6], a: { t: 112, nl: [20, -8, 90], na: [0, 0] }, b: { na: [-135, 0] } } },

  // carry
  { id: "farmer",   cat: "carry",    name: "Farmer’s Carry",      where: "chest, below the collarbone", axis: "pitch",
    a: "Standing tall, a weight in each hand",hold: 30,                                demo: [80, 80],
    tip: "Walk tall with your shoulders back — don’t lean forward.",
    fig: { gear: "db", band: ["torso", .8], a: { t: 180, nl: [18, 2], fl: [-16, -16], na: [0, 0] }, b: { nl: [-16, -16], fl: [18, 2] } } },
  { id: "suitcase", cat: "carry",    name: "Suitcase Carry",      where: "chest, below the collarbone", axis: "roll",
    a: "Standing tall, a weight in one hand", hold: 30,                                demo: [0, 0],
    tip: "Don’t let the weight pull you sideways.",
    fig: { view: "front", gear: "db1", band: ["torso", .75], a: { t: 180, nl: [3, 0], na: [4, 0], fa: [22, 14] } } },

  // core
  { id: "plank",    cat: "core",     name: "Plank",               where: "middle of the lower back",    axis: "pitch",
    a: "Head to heels in a straight line",    hold: 30,                                demo: [5, 5],
    tip: "Don’t let your hips sag or pike up.",
    fig: { band: ["torso", .2], anchor: "n.elbow", a: { t: 99, nl: [-81, -81, 0], na: [0, 90] } } },
  { id: "situp",    cat: "core",     name: "Sit‑Up",              where: "chest, below the collarbone", axis: "pitch",
    a: "Lying flat on your back",             b: "Chest up toward knees",              demo: [-5, 60],
    tip: "Curl up from your chest — don’t pull on your neck.", move: "img/moves/sit-up" },

  // stretches
  { id: "hamstring",cat: "stretch",  name: "Hamstring Stretch",   where: "chest, below the collarbone", axis: "pitch",
    a: "Hinged forward over a straight front leg", hold: 30,                           demo: [30, 30],
    tip: "Hinge at the hips with a flat back until you feel the stretch.",
    fig: { band: ["torso", .8], anchor: "f.ankle", a: { t: 122, nl: [38, 38, 165], fl: [22, -22, 90], na: [22, 28] } } },
  { id: "hipflexor",cat: "stretch",  name: "Hip Flexor Stretch",  where: "front of the back thigh",     axis: "pitch",
    a: "Half‑kneeling, hips pushed forward",  hold: 30,                                demo: [-60, -60],
    tip: "Tuck your pelvis under and shift forward gently.",
    fig: { band: ["f.thigh", .5], a: { t: 182, nl: [90, 0, 90], fl: [-14, -90, -90], na: [-30, 70] } } },
];

const NO_LOAD = new Set(["mobility", "stretch"]);   // bodyweight only, no load field

const SAMPLES_PER_CAPTURE = 30;   // same as the progress-check sketch
// A rep = get most of the way from A to B, then come back to A.
const REACH_B = 0.85;   // 85% of the way to B counts as reaching B
const NEAR_A  = 0.15;   // within 15% of the range from A counts as back at A
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

// ---------- storage ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const state = {
  view: "pick",           // pick | calib | work
  ex: EXERCISES[0],
  saved: store.get("imuband.cal", {}),    // { [exId]: { start, final } }
  log:   store.get("imuband.log", {}),    // { [exId]: [{ date, sets: [{ reps, partials, load } | { secs, breaks, load }] }] }
  loads: store.get("imuband.loads", {}),  // last load typed per exercise
  draft: {},              // calibration in progress
  angle: 0,
  capturing: null,        // { which, buf: [] }
  reps: 0, partials: 0, history: [],
  phase: "idle",          // idle | atStart | moving
  peak: 0,
  held: 0, inZone: false, // holds
};

const isSaved = (ex) => { const c = state.saved[ex.id]; return !!c && c.start != null && (ex.hold || c.final != null); };

// ---------- log ----------
const today = () => new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD, local time
function entries(id) { return (state.log[id] || []).filter(e => e.sets.length); }
function todaysEntry(id, create) {
  if (!state.log[id]) { if (!create) return null; state.log[id] = []; }
  let e = state.log[id].find(x => x.date === today());
  if (!e && create) { e = { date: today(), sets: [] }; state.log[id].push(e); }
  return e;
}
function setsSummary(ex, e) { return e.sets.map(s => ex.hold ? `${s.secs}s` : s.reps).join(" · "); }
function entryLoad(e) { const l = e.sets.map(s => s.load).filter(Boolean); return l.length ? l[l.length - 1] : ""; }

// Session number = distinct days with anything logged (today counts even before the first set).
function sessionInfo() {
  const days = new Set();
  for (const id in state.log) for (const e of state.log[id]) if (e.sets.length) days.add(e.date);
  for (const e of store.get("imuband.cardio", [])) days.add(e.date);
  const n = days.size + (days.has(today()) ? 0 : 1);
  return { n, inBlock: ((n - 1) % DOSE.block) + 1 };
}

// Ready for more load: 20 reps on every set, two sessions in a row.
function readyToProgress(ex) {
  if (ex.hold || NO_LOAD.has(ex.cat)) return false;
  const list = entries(ex.id);
  return list.length >= 2 && list.slice(-2).every(e => e.sets.every(s => s.reps >= DOSE.max));
}

// ---------- screens ----------
function show(view) {
  state.view = view;
  $("pickScreen").hidden = view !== "pick";
  $("cardioScreen").hidden = view !== "cardio";
  $("stage").hidden = view !== "calib" && view !== "work";
  $("calibView").hidden = view !== "calib";
  $("workView").hidden = view !== "work";
  $("logWrap").hidden = view !== "work" || !entries(state.ex.id).length;
  if (view === "pick") renderPick();
  window.scrollTo(0, 0);
  drawZones();
}

function renderPick() {
  const s = sessionInfo();
  $("sessionInfo").innerHTML = `Session <b>${s.inBlock}</b> of ${DOSE.block} in this program block · ` +
    (s.inBlock === DOSE.block ? "new exercises start next session" : `new exercises after session ${DOSE.block}`) +
    `<br>Each exercise: ${DOSE.minSets}–${DOSE.maxSets} sets of ${DOSE.min}–${DOSE.max} reps.`;

  $("plan").innerHTML = CATEGORIES.map((c, i) => `
    <section class="cat">
      <header><span class="num">${pad(i + 1)}</span><h2>${c.name}</h2><p>${c.note}</p></header>
      <ol class="pick-list">${EXERCISES.filter(e => e.cat === c.id).map(row).join("")}</ol>
    </section>`).join("");
}

function row(e) {
  const done = todaysEntry(e.id);
  const [cls, text] = done && done.sets.length ? ["done", "Done today"]
                    : readyToProgress(e)       ? ["up", "Add load"]
                    : isSaved(e)               ? ["saved", "Saved"]
                    :                            ["new", "Calibrate"];
  const last = entries(e.id).slice(-1)[0];
  const sub = last ? `Last: ${setsSummary(e, last)}${entryLoad(last) ? " @ " + esc(entryLoad(last)) : ""}`
            : e.hold ? `Hold ${e.hold}s` : `${DOSE.min}–${DOSE.max} reps`;
  const thumb = pic(e, "both");
  return `<li><button data-id="${e.id}">${thumb}
      <span class="name">${e.name}<small>${sub}</small></span>
      ${motionArc(e)}
      <span class="tag ${cls}">${text}</span>
    </button></li>`;
}

// Picture of the movement: the original drawings (start/end crossfade) where we have them,
// otherwise the generated figure. k = 0 start, 1 end; "both" = crossfading start ↔ end.
function pic(e, k) {
  if (e.move) return k === "both"
    ? `<span class="move"><img src="${e.move}-a.png" alt=""><img class="b" src="${e.move}-b.png" alt=""></span>`
    : `<img class="still" src="${e.move}-${k ? "b" : "a"}.png" alt="">`;
  if (k === "both") return `<span class="move">${FIG.svg(e, 0)}${e.fig.b ? FIG.svg(e, 1, "b") : ""}</span>`;
  return FIG.svg(e, k);
}

// Small diagram of the movement: the arc from A (hollow dot) to B (solid dot),
// using the saved calibration if there is one, otherwise a typical range.
// Holds show the band you need to stay inside.
function motionArc(e) {
  const c = state.saved[e.id];
  let [a, b] = c && c.start != null ? [c.start, e.hold ? c.start : c.final] : e.demo;
  const cx = 60, cy = 58, r = 46;
  const p = (ang) => { const th = (90 - Math.max(-90, Math.min(90, ang))) * Math.PI / 180; return [cx + r * Math.cos(th), cy - r * Math.sin(th)]; };
  const seg = (x, y) => { const [lo, hi] = [Math.min(x, y), Math.max(x, y)]; const [x1, y1] = p(lo), [x2, y2] = p(hi); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const [ax, ay] = p(a), [bx, by] = p(b);
  const move = e.hold ? seg(a - DOSE.tol, a + DOSE.tol) : seg(a, b);
  return `<svg class="arc" viewBox="0 0 120 66" aria-hidden="true">
    <path class="t" d="${seg(-90, 90)}"/><path class="m" d="${move}"/>
    <circle class="h" cx="${cx}" cy="${cy}" r="4"/>
    ${e.hold ? "" : `<circle class="a" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6"/>`}
    <circle class="b" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6"/></svg>`;
}

function pick(id) {
  const ex = state.ex = EXERCISES.find(e => e.id === id);
  sim?.setRange(ex.demo);
  $("exCat").textContent = CATEGORIES.find(c => c.id === ex.cat).name;
  $("exName").textContent = ex.name;
  $("placement").textContent = `Strap on the ${ex.where}`;

  $("poseA").innerHTML = pic(ex, 0);
  $("poseB").innerHTML = pic(ex, 1);
  $("preview").innerHTML = ex.move ? pic(ex, "both") : "";

  $("capFinal").hidden = !!ex.hold;
  $("startHow").textContent = ex.a;
  $("finalHow").textContent = ex.b || "";
  $("countLbl").textContent = ex.hold ? "Seconds" : "Reps";
  $("dtRange").textContent = ex.hold ? "Off by" : "Range";
  $("dtShort").textContent = ex.hold ? "Breaks" : "Short";
  $("loadWrap").hidden = NO_LOAD.has(ex.cat);
  $("load").value = state.loads[id] || "";
  $("load").placeholder = ex.cat === "carry" ? "e.g. 20 lb each" : "e.g. 15 lb";

  if (isSaved(ex)) startWork(); else startCalib();
}

function startCalib() {
  state.draft = {};
  renderCalib();
  cue(state.ex.hold ? "Get into position, then press A to record it." : "");
  show("calib");
}

function startWork() {
  resetSet();
  renderDose(); renderLog();
  cue("");
  show("work");
}

// ---------- dose + log on the work screen ----------
function renderDose() {
  const ex = state.ex, e = todaysEntry(ex.id), done = e ? e.sets.length : 0;
  $("setLbl").textContent = done >= DOSE.maxSets ? `${done} sets done today` : `Set ${done + 1} of ${DOSE.minSets}–${DOSE.maxSets}`;
  $("target").textContent = ex.hold ? `Hold ${ex.hold}s` : `${DOSE.min}–${DOSE.max} reps`;
  $("finishSet").disabled = done >= DOSE.maxSets;
  $("progressNote").hidden = !readyToProgress(ex);
  $("progressNote").textContent = `${DOSE.max} reps on every set, two sessions in a row. Time to increase the load — check with your CEP or R.KIN.`;
}

function renderLog() {
  const ex = state.ex, list = entries(ex.id).slice(-6).reverse();
  $("logBody").innerHTML = list.map(e => {
    const d = new Date(e.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `<tr><td>${d}</td><td>${setsSummary(ex, e)}</td><td>${esc(entryLoad(e) || "—")}</td></tr>`;
  }).join("");
  $("logWrap").hidden = !list.length;
}

function finishSet() {
  const ex = state.ex;
  const val = ex.hold ? Math.floor(state.held) : state.reps;
  if (!val) return cue(ex.hold ? "Hold the position first." : "No reps yet.");
  const load = NO_LOAD.has(ex.cat) ? "" : $("load").value.trim();
  state.loads[ex.id] = load; store.set("imuband.loads", state.loads);
  todaysEntry(ex.id, true).sets.push(ex.hold ? { secs: val, breaks: state.partials, load } : { reps: val, partials: state.partials, load });
  store.set("imuband.log", state.log);
  const n = todaysEntry(ex.id).sets.length;
  resetSet(); renderDose(); renderLog();
  cue(n >= DOSE.maxSets ? "Both sets logged. On to the next exercise." : `Set ${n} logged. Rest, then do one more set if you can.`);
}

// ---------- dial geometry ----------
const CX = 300, CY = 310, R = 240;
const clampA = (a) => Math.max(-90, Math.min(90, a));
function pt(a, r = R) {
  const th = (90 - clampA(a)) * Math.PI / 180;
  return [CX + r * Math.cos(th), CY - r * Math.sin(th)];
}
function arc(a1, a2, r = R) {
  const [lo, hi] = [clampA(Math.min(a1, a2)), clampA(Math.max(a1, a2))];
  const [x1, y1] = pt(lo, r), [x2, y2] = pt(hi, r);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function drawTicks() {
  let s = "";
  for (let a = -90; a <= 90; a += 5) {
    const major = a % 30 === 0;
    const [x1, y1] = pt(a, R + 18), [x2, y2] = pt(a, R + (major ? 32 : 24));
    s += `<line class="${major ? "major" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  $("ticks").innerHTML = s;
  $("track").setAttribute("d", arc(-90, 90));
}

// ---------- calibration zones ----------
function zones() {
  const c = state.view === "calib" ? state.draft : state.saved[state.ex.id];
  if (!c || c.start == null) return null;
  if (state.ex.hold) return { start: c.start, final: c.start, rom: 0, dir: 1, hold: true };
  if (c.final == null) return null;
  const rom = Math.abs(c.final - c.start), dir = Math.sign(c.final - c.start) || 1;
  return { start: c.start, final: c.final, rom, dir };
}
function progress(a, z) { return z.rom ? ((a - z.start) * z.dir) / z.rom : 0; }

function drawZones() {
  const z = state.view === "calib" || state.view === "work" ? zones() : null;
  if (!z) { ["zoneStart", "zoneFinal", "fill"].forEach(id => $(id).setAttribute("d", "")); return; }
  if (z.hold) {
    $("zoneStart").setAttribute("d", "");
    $("zoneFinal").setAttribute("d", arc(z.start - DOSE.tol, z.start + DOSE.tol));
    return;
  }
  const at = (p) => z.start + z.dir * z.rom * p;   // angle at a fraction of the way from A to B
  $("zoneStart").setAttribute("d", arc(at(-NEAR_A), at(NEAR_A)));
  $("zoneFinal").setAttribute("d", arc(at(REACH_B), at(1) + z.dir * 8));
}

// ---------- rep logic ----------
function step(a) {
  const z = zones(); if (!z) return;
  const p = progress(a, z);
  const inStart = Math.abs(p) <= NEAR_A;
  const inFinal = p >= REACH_B;
  $("zoneFinal").classList.toggle("hit", inFinal);

  if (state.phase === "idle") {
    cue(inStart ? "Ready." : "Move to the start position.");
    if (inStart) state.phase = "atStart";
    return;
  }
  if (state.phase === "atStart" && !inStart) { state.phase = "moving"; state.peak = 0; }
  if (state.phase === "moving") {
    state.peak = Math.max(state.peak, p);
    if (inStart) {
      const pct = Math.min(1.2, state.peak);
      if (state.peak >= REACH_B) {
        state.reps++; state.history.push(pct); bump();
        cue(state.reps === DOSE.min ? `${DOSE.min} reps — you’re in range. Keep going toward ${DOSE.max} if your form holds.`
          : state.reps === DOSE.max ? `${DOSE.max} reps. Finish the set.`
          : state.reps > DOSE.max ? "Past the top of the range — finish the set." : "Good rep.");
      }
      else if (state.peak > 0.3) { state.partials++; cue(`Short rep — ${Math.round(pct * 100)}%. Go further.`); }
      state.phase = "atStart";
      renderCounts();
    }
  }
}

// Holds: the clock runs while you stay within ±tol° of the calibrated position.
function stepHold(a, dt) {
  const z = zones(); if (!z) return;
  const inZone = Math.abs(a - z.start) <= DOSE.tol;
  $("zoneFinal").classList.toggle("hit", inZone);
  const target = state.ex.hold, before = state.held;
  if (inZone) state.held += dt;
  else if (state.inZone && state.held > 0) { state.partials++; $("partials").textContent = state.partials; }
  state.inZone = inZone;

  if (before < target && state.held >= target) bump();
  const secs = Math.floor(state.held);
  if ($("reps").textContent !== String(secs)) $("reps").textContent = secs;
  const bar = $("tracker").querySelector(".holdbar i");
  if (bar) bar.style.width = `${Math.min(100, state.held / target * 100)}%`;

  cue(!inZone ? (state.held > 0 ? "Back into position." : "Get into position.")
    : state.held >= target ? "Target reached. Finish the set." : "Holding — stay steady.");
}

function cue(t) { if ($("cue").textContent !== t) $("cue").textContent = t; }
function bump() { const el = $("reps"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

// Tracker: one bar per rep, filled to the range reached. Empty slots run out to 20,
// with 10 and 20 marked so the 10–20 rep range is visible. Holds get a single timer bar.
function renderTracker() {
  if (state.ex.hold) {
    $("tracker").innerHTML = `<div class="holdbar"><i style="width:${Math.min(100, state.held / state.ex.hold * 100)}%"></i><span>${state.ex.hold}s</span></div>`;
    return;
  }
  const n = state.history.length, total = Math.max(DOSE.max, n + 1);
  let html = "";
  for (let i = 0; i < total; i++) {
    const mark = i + 1 === DOSE.min || i + 1 === DOSE.max ? " mark" : "";
    if (i < n) html += `<div class="slot done${mark}"><div class="bar"><i style="height:${Math.min(100, Math.round(state.history[i] * 100))}%"></i></div><small>${i + 1}</small></div>`;
    else html += `<div class="slot ${i === n ? "next" : "todo"}${mark}"><div class="bar"></div><small>${i + 1}</small></div>`;
  }
  $("tracker").innerHTML = html;
}
function renderCounts() {
  $("reps").textContent = state.ex.hold ? Math.floor(state.held) : state.reps;
  $("partials").textContent = state.partials; renderTracker();
}
function resetSet() {
  Object.assign(state, { reps: 0, partials: 0, history: [], phase: "idle", peak: 0, held: 0, inZone: false });
  renderCounts();
}

// ---------- incoming samples ----------
let sampleTimes = [], lastT = 0;
function onSample(s) {
  const a = Number(s[state.ex.axis]);
  if (!Number.isFinite(a)) return;
  state.angle = a;
  const now = performance.now(); sampleTimes.push(now);
  sampleTimes = sampleTimes.filter(t => now - t < 1000);
  const dt = lastT ? Math.min(0.25, (now - lastT) / 1000) : 0; lastT = now;

  if (state.capturing) {
    const c = state.capturing; c.buf.push(a);
    $(c.which === "start" ? "startVal" : "finalVal").textContent = `Reading ${c.buf.length}/${SAMPLES_PER_CAPTURE}`;
    if (c.buf.length >= SAMPLES_PER_CAPTURE) finishCapture();
    return;
  }
  if (state.view === "work") state.ex.hold ? stepHold(a, dt) : step(a);
}

// ---------- capture A / B ----------
function capture(which) {
  if (!source) return cue("Connect the band first (Wi‑Fi or USB, top right).");
  if (state.capturing) return;
  let n = 3;
  const btn = $(which === "start" ? "capStart" : "capFinal");
  const label = $(which === "start" ? "startVal" : "finalVal");
  btn.classList.add("busy");
  if (sim) sim.holdAt = which;
  cue("");
  const tick = () => {
    if (n > 0) { label.textContent = `Hold still… ${n}`; n--; setTimeout(tick, 700); }
    else state.capturing = { which, buf: [] };
  };
  tick();
}
function finishCapture() {
  const { which, buf } = state.capturing; state.capturing = null;
  if (sim) sim.release();
  state.draft[which] = Math.round(buf.reduce((x, y) => x + y, 0) / buf.length * 10) / 10;
  renderCalib(); drawZones();
}
function renderCalib() {
  const d = state.draft;
  $("startVal").textContent = d.start != null ? `${d.start}°` : "";
  $("finalVal").textContent = d.final != null ? `${d.final}°` : "";
  $("capStart").classList.toggle("done", d.start != null); $("capStart").classList.remove("busy");
  $("capFinal").classList.toggle("done", d.final != null); $("capFinal").classList.remove("busy");
  $("saveBtn").disabled = d.start == null || (!state.ex.hold && d.final == null);
}
function saveCalibration() {
  const d = state.draft; if (d.start == null || (!state.ex.hold && d.final == null)) return;
  state.saved[state.ex.id] = { start: d.start, final: state.ex.hold ? null : d.final };
  store.set("imuband.cal", state.saved);
  startWork();
}

// ---------- UI events ----------
$("plan").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-id]"); if (b) openDemo(b.dataset.id, true); });

// ---------- demo pop-up: the movement animated, with how-to steps ----------
let demoEx = null, demoGoes = false;
function openDemo(id, thenStart) {
  const ex = demoEx = EXERCISES.find(e => e.id === id);
  demoGoes = thenStart;
  $("demoCat").textContent = CATEGORIES.find(c => c.id === ex.cat).name;
  $("demoName").textContent = ex.name;
  const steps = [
    `Strap the band on the <b>${ex.where}</b>${ex.move ? "" : " — the blue mark on the figure"}.`,
    `<b>Start:</b> ${ex.a.toLowerCase()}.`,
    ...(ex.hold
      ? [`Hold it for <b>${ex.hold} seconds</b>. The clock only runs while you stay in position.`]
      : [`<b>Move to:</b> ${ex.b.toLowerCase()}.`, `Come back to the start — that’s one rep.`]),
    ex.tip,
  ];
  $("demoSteps").innerHTML = steps.map(s => `<li>${s}</li>`).join("");
  $("demoDose").textContent = ex.hold ? `${DOSE.minSets}–${DOSE.maxSets} holds of ${ex.hold}s`
                                      : `${DOSE.minSets}–${DOSE.maxSets} sets of ${DOSE.min}–${DOSE.max} reps`;
  $("demoGo").textContent = thenStart ? (isSaved(ex) ? "Start exercise" : "Start — calibrate first") : "Back to exercise";
  $("demoFig").innerHTML = ex.move ? pic(ex, "both") : "";
  $("demo").showModal();
}
$("demoGo").onclick = () => { $("demo").close(); if (demoGoes) pick(demoEx.id); };
$("demoClose").onclick = () => $("demo").close();
$("demo").addEventListener("click", (ev) => { if (ev.target === $("demo")) $("demo").close(); });
$("demoBtn").onclick = () => openDemo(state.ex.id, false);
$("backBtn").onclick = () => show("pick");
$("homeBtn").onclick = () => show("pick");
$("capStart").onclick = () => capture("start");
$("capFinal").onclick = () => capture("final");
$("saveBtn").onclick = saveCalibration;
$("finishSet").onclick = finishSet;
$("resetSet").onclick = () => { resetSet(); cue(""); };
$("recalBtn").onclick = startCalib;

// ---------- cardio: warm-up → cardio → (strength) → cool-down, guided by heart rate ----------
// Intensity uses heart-rate reserve (Karvonen): target = rest + % × (max − rest).
// Warm-up and cool-down stay easy (under 40% HRR); cardio aims for 40–60% HRR.
const PHASES = {
  warmup:   { name: "Warm‑up",   min: 3 * 60,  max: 5 * 60,  lo: 0,   hi: 0.4, how: "Easy pace, 3–5 minutes. Let your heart rate climb slowly." },
  cardio:   { name: "Cardio",    min: 15 * 60, max: 30 * 60, lo: 0.4, hi: 0.6, how: "Moderate pace, 15–30 minutes at 40–60% of your heart‑rate reserve." },
  cooldown: { name: "Cool‑down", min: 3 * 60,  max: 5 * 60,  lo: 0,   hi: 0.4, how: "Easy pace, 3–5 minutes. Let your heart rate come down." },
};
const MACHINE_TIPS = {
  treadmill:  { up: "Raise the speed or incline a little.",     down: "Lower the speed or incline." },
  bike:       { up: "Add a little resistance or pedal faster.", down: "Lower the resistance or pedal slower." },
  elliptical: { up: "Add resistance or lengthen your stride.",  down: "Lower the resistance or slow your stride." },
};
const hrSaved = store.get("imuband.hr", {});
const cardio = {
  phase: "warmup", machine: hrSaved.machine || "treadmill",
  running: false, elapsed: 0, inZone: 0, last: 0,
  bpm: null, bpmAt: 0, samples: [],     // samples: [{ t: elapsed seconds, bpm }]
  log: store.get("imuband.cardio", []), // [{ date, phase, machine, secs, inZone, avg, peak }]
};
// Until the person enters their own numbers, start from typical values so the zone shows right away.
const HR_DEFAULT = { rest: 70, max: 180 };
$("hrRest").value = hrSaved.rest || HR_DEFAULT.rest; $("hrMax").value = hrSaved.max || HR_DEFAULT.max;
function renderHRNote() {
  const typical = Number($("hrRest").value) === HR_DEFAULT.rest && Number($("hrMax").value) === HR_DEFAULT.max;
  $("hrNote").textContent = typical
    ? "These are typical starting values. Change them to your own from your graded exercise test (your CEP or R.KIN has them)."
    : "From your graded exercise test. Your CEP or R.KIN can give you these numbers.";
}
renderHRNote();

function hrr() {
  const rest = Number($("hrRest").value), max = Number($("hrMax").value);
  return rest && max && max > rest + 20 ? { rest, max, at: (p) => Math.round(rest + p * (max - rest)) } : null;
}
function saveHR() { store.set("imuband.hr", { rest: $("hrRest").value, max: $("hrMax").value, machine: cardio.machine }); }
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const hrFresh = () => cardio.bpm != null && performance.now() - cardio.bpmAt < 90000;

function renderZone() {
  const z = hrr(), P = PHASES[cardio.phase];
  $("hrZone").innerHTML = z ? `Cardio zone <b>${z.at(.4)}–${z.at(.6)} bpm</b>` : "Enter both to see your target zone.";
  $("zoneSummary").innerHTML = z ? `Your cardio zone: <b>${z.at(.4)}–${z.at(.6)} bpm</b> · warm‑up and cool‑down under ${z.at(.4)} bpm`
                                 : "Set your resting and max heart rate on the cardio screen to get your zone.";
  // bar: rest → max, split at 40% and 60%
  const segs = $("hrBar").querySelectorAll(".seg");
  segs.forEach((s, i) => s.classList.toggle("target", P.lo === 0 ? i === 0 : i === 1));
  $("lblRest").textContent = z ? `${z.rest}` : "Rest"; $("lblMax").textContent = z ? `${z.max}` : "Max";
  $("lblZone").textContent = z ? `${z.at(.4)}–${z.at(.6)}` : "40–60%";
}

function zoneOf(bpm) {
  const z = hrr(); if (!z || bpm == null) return null;
  const P = PHASES[cardio.phase], lo = P.lo ? z.at(P.lo) : 0, hi = z.at(P.hi);
  return bpm < lo ? "low" : bpm > hi ? "high" : "in";
}

function renderCardio() {
  const P = PHASES[cardio.phase], z = hrr();
  $("phaseName").textContent = P.name;
  $("phaseHow").textContent = P.how;
  const order = cardio.phase === "cooldown" ? ["cooldown"] : ["warmup", "cardio"];
  $("phaseSteps").innerHTML = order.map(k => `<li class="${k === cardio.phase ? "on" : order.indexOf(k) < order.indexOf(cardio.phase) ? "done" : ""}">
      <b>${PHASES[k].name}</b><span>${PHASES[k].min / 60}–${PHASES[k].max / 60} min</span></li>`).join("") +
    (cardio.phase === "cooldown" ? "" : `<li><b>Strength</b><span>after cardio</span></li>`);
  document.querySelectorAll(".machines button").forEach(b => b.setAttribute("aria-checked", b.dataset.m === cardio.machine));

  $("clock").textContent = mmss(cardio.elapsed);
  $("clockOf").textContent = `of ${P.min / 60}–${P.max / 60} min`;
  $("timeFill").style.width = `${Math.min(100, cardio.elapsed / P.max * 100)}%`;
  $("timeMin").style.left = `${P.min / P.max * 100}%`;
  $("runBtn").textContent = cardio.running ? "Pause" : cardio.elapsed ? "Resume" : "Start";
  $("nextPhase").textContent = cardio.phase === "warmup" ? "Start cardio →" : cardio.phase === "cardio" ? "Done — on to strength" : "Finish session";

  // heart rate
  const fresh = hrFresh();
  $("hrNow").textContent = fresh ? cardio.bpm : "--";
  $("hrNow").classList.toggle("empty", !fresh);
  const zs = fresh ? zoneOf(cardio.bpm) : null, tips = MACHINE_TIPS[cardio.machine];
  $("hrState").className = `hr-state ${zs || ""}`;
  $("hrState").textContent = !z ? "Enter resting and max HR to get zone guidance."
    : !fresh ? (hrm ? "Waiting for your monitor…" : "No heart rate yet. Connect a monitor or type it in from the machine below.")
    : zs === "in" ? (P.lo ? "In your zone. Hold this pace." : "Nice and easy. Keep it here.")
    : zs === "low" ? `Below your zone. ${tips.up}`
    : P.lo ? `Above your zone. ${tips.down}` : `Too hard for a ${P.name.toLowerCase()}. ${tips.down}`;
  if (z && fresh) {
    const p = Math.max(0, Math.min(1, (cardio.bpm - z.rest) / (z.max - z.rest)));
    $("hrMark").style.left = `${p * 100}%`; $("hrMark").hidden = false;
  } else $("hrMark").hidden = true;

  const bpms = cardio.samples.map(s => s.bpm);
  $("inZone").textContent = mmss(cardio.inZone);
  $("hrAvg").textContent = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : "—";
  $("hrPeak").textContent = bpms.length ? Math.max(...bpms) : "—";
  renderTrace();
}

// Heart rate over this phase, with the target band shaded.
function renderTrace() {
  const P = PHASES[cardio.phase], z = hrr(), W = 600, H = 170;
  const lo = z ? z.rest - 5 : 50, hi = z ? z.max : 190;
  const x = (t) => (t / Math.max(P.max, cardio.elapsed)) * W, y = (b) => H - ((b - lo) / (hi - lo)) * H;
  let s = "";
  if (z) {
    const a = y(z.at(P.hi)), b = y(P.lo ? z.at(P.lo) : lo);
    s += `<rect class="band" x="0" y="${a.toFixed(1)}" width="${W}" height="${(b - a).toFixed(1)}"/>`;
  }
  s += `<line class="min" x1="${x(P.min).toFixed(1)}" x2="${x(P.min).toFixed(1)}" y1="0" y2="${H}"/>`;
  if (cardio.samples.length) s += `<polyline points="${cardio.samples.map(p => `${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(" ")}"/>`;
  $("hrTrace").innerHTML = s;
}

function onHR(bpm) {
  if (!(bpm > 30 && bpm < 240)) return;
  cardio.bpm = Math.round(bpm); cardio.bpmAt = performance.now();
  const last = cardio.samples[cardio.samples.length - 1];
  if (cardio.running && (!last || cardio.elapsed - last.t >= 2)) cardio.samples.push({ t: cardio.elapsed, bpm: cardio.bpm });
  if (state.view === "cardio") renderCardio();
}

// timer
let lastCue = "";
setInterval(() => {
  const now = performance.now(), dt = cardio.last ? (now - cardio.last) / 1000 : 0; cardio.last = now;
  if (!cardio.running) return;
  const P = PHASES[cardio.phase], before = cardio.elapsed;
  cardio.elapsed += dt;
  if (hrFresh() && zoneOf(cardio.bpm) === "in") cardio.inZone += dt;
  const crossed = (t) => before < t && cardio.elapsed >= t;
  const next = cardio.phase === "warmup" ? "start cardio" : cardio.phase === "cardio" ? "move on to strength" : "finish";
  if (crossed(P.min)) lastCue = `${P.min / 60} minutes done. You can ${next} any time before ${P.max / 60} min.`;
  if (crossed(P.max)) lastCue = `${P.max / 60} minutes — time to ${next}.`;
  $("cardioCue").textContent = lastCue;
  if (state.view === "cardio") renderCardio();
}, 250);

function logPhase() {
  if (cardio.elapsed < 10) return;
  const bpms = cardio.samples.map(s => s.bpm);
  cardio.log.push({ date: today(), phase: cardio.phase, machine: cardio.machine, secs: Math.round(cardio.elapsed),
    inZone: Math.round(cardio.inZone), avg: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
    peak: bpms.length ? Math.max(...bpms) : null });
  store.set("imuband.cardio", cardio.log);
}
function renderCardioLog() {
  const rows = cardio.log.slice(-8).reverse();
  $("cardioLogWrap").hidden = !rows.length;
  $("cardioLog").innerHTML = rows.map(e => `<tr><td>${new Date(e.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
    <td>${PHASES[e.phase].name}</td><td>${mmss(e.secs)}</td><td>${mmss(e.inZone)}</td><td>${e.avg ?? "—"}</td></tr>`).join("");
}
function startPhase(phase) {
  Object.assign(cardio, { phase, running: false, elapsed: 0, inZone: 0, samples: [] });
  lastCue = phase === "cardio" ? "Warm‑up logged. Bring your heart rate up into your zone." : "";
  $("cardioCue").textContent = lastCue;
  renderZone(); renderCardio(); renderCardioLog();
}
function openCardio(phase) { startPhase(phase); show("cardio"); }

$("startWarm").onclick = () => openCardio("warmup");
$("startCool").onclick = () => openCardio("cooldown");
$("cardioBack").onclick = () => { cardio.running = false; show("pick"); };
$("runBtn").onclick = () => { cardio.running = !cardio.running; cardio.last = performance.now(); renderCardio(); };
$("nextPhase").onclick = () => {
  logPhase();
  if (cardio.phase === "warmup") { startPhase("cardio"); cardio.running = true; cardio.last = performance.now(); renderCardio(); }
  else {
    const toStrength = cardio.phase === "cardio";
    cardio.running = false; show("pick");
    if (toStrength) $("strength").scrollIntoView();
  }
};
document.querySelector(".machines").onclick = (ev) => {
  const b = ev.target.closest("button[data-m]"); if (!b) return;
  cardio.machine = b.dataset.m; saveHR(); renderCardio();
};
$("hrRest").oninput = $("hrMax").oninput = () => { saveHR(); renderHRNote(); renderZone(); renderCardio(); };
$("hrManual").onsubmit = (ev) => { ev.preventDefault(); onHR(Number($("hrType").value)); $("hrType").value = ""; };

// Bluetooth heart-rate monitor (chest strap / watch broadcasting the standard Heart Rate service).
let hrm = null;
$("hrmBtn").onclick = async () => {
  if (hrm) { hrm.gatt.disconnect(); return; }
  try {
    if (!navigator.bluetooth) throw new Error("Bluetooth heart‑rate monitors need Chrome or Edge.");
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
    $("hrmState").textContent = "Connecting…";
    const ch = await (await (await dev.gatt.connect()).getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
    ch.addEventListener("characteristicvaluechanged", (e) => {
      const v = e.target.value;
      onHR(v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1));   // flag bit 0: 16-bit value
    });
    await ch.startNotifications();
    hrm = dev;
    $("hrmState").textContent = `Connected: ${dev.name || "heart‑rate monitor"}`;
    $("hrmBtn").textContent = "Disconnect monitor";
    dev.addEventListener("gattserverdisconnected", () => {
      hrm = null; $("hrmState").textContent = "Monitor disconnected."; $("hrmBtn").textContent = "Connect heart‑rate monitor";
    });
  } catch (err) {
    if (err.name !== "NotFoundError") $("hrmState").textContent = String(err.message || err);
  }
};

// Demo (?demo): a simulated heart rate that follows the phase.
if (new URLSearchParams(location.search).has("demo")) {
  if (!$("hrRest").value) { $("hrRest").value = 65; $("hrMax").value = 175; }
  let hrSim = 72;
  setInterval(() => {
    const z = hrr(); if (!z) return;
    const goal = !cardio.running ? z.at(0.1) : cardio.phase === "cardio" ? z.at(0.5) + 12 * Math.sin(cardio.elapsed / 40) : z.at(0.3);
    hrSim += (goal - hrSim) * 0.08 + (Math.random() - 0.5) * 2;
    onHR(hrSim);
  }, 1000);
}
renderZone();

// ---------- data sources: Wi-Fi (Yun) or USB, one at a time ----------
let mode = null, source = null, sim = null;
const LINKS = { wifi: { el: "wifiLink", btn: "wifiBtn", idle: "Connect" },
                usb:  { el: "usbLink",  btn: "usbBtn",  idle: "Choose port" } };

function linkState(m, text) { const L = LINKS[m]; if (L) $(L.el).querySelector(".state span").textContent = text; }
function setStatus(live) {
  for (const m in LINKS) {
    const on = live && m === mode;
    $(LINKS[m].el).classList.toggle("live", on);
    $(LINKS[m].btn).textContent = on ? "Disconnect" : LINKS[m].idle;
  }
}
async function connect(m) {
  if (source) disconnect();
  mode = m;
  try {
    if (m === "demo") source = sim = demoSource();
    if (m === "wifi") source = wifiSource($("host").value.trim());
    if (m === "usb")  source = await serialSource();
    linkState(m, "Connecting…"); setStatus(true);
  } catch (err) {
    source = null; setStatus(false); linkState(m, String(err.message || err));
  }
}
function disconnect() { source?.stop(); linkState(mode, ""); source = sim = null; setStatus(false); mode = null; }
$("wifiBtn").onclick = () => (source && mode === "wifi") ? disconnect() : connect("wifi");
$("usbBtn").onclick  = () => (source && mode === "usb")  ? disconnect() : connect("usb");
document.querySelectorAll("[data-connect]").forEach(b => b.onclick = () => connect(b.dataset.connect));

// Home: point to demo mode (or back to the real band).
const DEMO = new URLSearchParams(location.search).has("demo");
$("demoNote").innerHTML = DEMO
  ? `Demo mode: the band and heart rate are simulated. <a href="./">Use the real band</a>`
  : `No band with you? <a href="?demo">Try demo mode</a> to see everything working.`;

// Wi-Fi: poll the Yun sketch's HTTP server (returns {"pitch":..,"roll":..})
function wifiSource(host) {
  let on = true, fails = 0;
  (async function loop() {
    while (on) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500);
      try {
        const r = await fetch(`http://${host}/`, { signal: ctl.signal, cache: "no-store" });
        onSample(await r.json()); fails = 0;
      } catch {
        if (++fails === 3) { linkState("wifi", "No reply. Same Wi‑Fi?"); $("wifiLink").classList.remove("live"); }
      }
      clearTimeout(t);
      await new Promise(r => setTimeout(r, 40));
    }
  })();
  return { stop() { on = false; } };
}

// USB: Web Serial (Chrome / Edge). The sketch prints one JSON line per sample.
async function serialSource() {
  if (!("serial" in navigator)) throw new Error("USB needs Chrome or Edge.");
  let port;
  try { port = await navigator.serial.requestPort(); }
  catch { throw new Error("No port picked."); }
  try { await port.open({ baudRate: 115200 }); }
  catch (err) {
    // Already open in this page (e.g. after a reconnect) is fine; anything else means another program has it.
    if (err.name !== "InvalidStateError")
      throw new Error("Port is busy. Close the Arduino Serial Monitor/Plotter and other tabs using it, then try again.");
  }
  const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
  let on = true, buf = "";
  (async () => {
    while (on) {
      const { value, done } = await reader.read(); if (done) break;
      buf += value; const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) { try { onSample(JSON.parse(l)); } catch {} }
    }
  })();
  return { async stop() { on = false; try { await reader.cancel(); await port.close(); } catch {} } };
}

// Demo (?demo): a simulated limb moving between two angles, with the odd short rep.
// For holds (start == end) it sits in position and now and then drifts out.
function demoSource() {
  let [lo, hi] = state.ex.demo, t = 0, depth = 1, prevPhase = 0;
  const id = setInterval(() => {
    t += 0.05;
    const phase = (Math.sin(t * 1.6 - Math.PI / 2) + 1) / 2;
    if (prevPhase > 0.02 && phase <= 0.02) depth = Math.random() < 0.2 ? 0.55 + Math.random() * 0.2 : 1 + Math.random() * 0.08;
    prevPhase = phase;
    const hold = api.holdAt === "start" ? 0 : api.holdAt === "final" ? 1
               : state.view !== "work" || t < 3 ? 0 : phase * depth;
    const drift = lo === hi && state.view === "work" && t % 14 > 12 ? 20 : 0;
    onSample({ pitch: lo + (hi - lo) * hold + drift + (Math.random() - 0.5) * 1.6, roll: lo + (hi - lo) * hold + drift });
  }, 50);
  const api = { holdAt: null, stop() { clearInterval(id); }, setRange(r) { [lo, hi] = r; t = 0; }, release() { api.holdAt = null; t = 0; } };
  return api;
}
if (new URLSearchParams(location.search).has("demo")) connect("demo");

// ---------- render loop: spring-damped needle ----------
let pos = 0, vel = 0;

function frame(now) {
  // animated figures: the demo pop-up and the preview beside the exercise
  const k = FIG.phase(now || 0);
  if ($("demo").open && demoEx) {
    if (!demoEx.move) $("demoFig").innerHTML = FIG.svg(demoEx, k);
    const atB = demoEx.move ? ((now || 0) % 3200) / 3200 >= 0.45 && ((now || 0) % 3200) / 3200 < 0.95 : k >= 0.5;
    $("demoPhase").textContent = demoEx.hold ? `Hold ${demoEx.hold}s` : atB ? "B · End" : "A · Start";
  }
  if ((state.view === "calib" || state.view === "work") && !$("preview").hidden && !state.ex.move) $("preview").innerHTML = FIG.svg(state.ex, k);

  vel += (clampA(state.angle) - pos) * 0.12; vel *= 0.72; pos += vel;
  $("needle").setAttribute("transform", `rotate(${pos.toFixed(2)} ${CX} ${CY})`);
  // live fill: from A to wherever the limb is now
  const zf = state.view === "calib" || state.view === "work" ? zones() : null;
  $("fill").setAttribute("d", zf && source ? arc(zf.start, pos) : "");

  // Until data arrives, show the start→end drawing instead of an empty dial.
  const receiving = !!source && sampleTimes.some(t => performance.now() - t < 1000);
  if ($("live").hidden === receiving) { $("live").hidden = !receiving; $("preview").hidden = receiving; }
  // Tell people why nothing is moving: no band yet, or connected but no data.
  $("bandPrompt").hidden = receiving;
  if (!receiving) {
    $("bandPromptTitle").textContent = source ? "Waiting for the band…" : "Band not connected.";
    $("bandPromptText").textContent = source
      ? (mode === "wifi" ? "Check the band is on and on the same Wi‑Fi as this computer." : "Check the USB cable, and that the sketch was uploaded with USE_YUN set to 0 (USB mode).")
      : "Connect it to calibrate and count your reps.";
  }

  if (source) {
    $("angle").textContent = `${state.angle.toFixed(1)}°`;
    const z = zones();
    $("romPct").textContent = !z ? "—" : z.hold ? `${Math.abs(state.angle - z.start).toFixed(0)}°`
                            : `${Math.round(Math.max(0, progress(state.angle, z)) * 100)}%`;
    if (receiving) { linkState(mode, "Connected"); LINKS[mode] && $(LINKS[mode].el).classList.add("live"); }
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
drawTicks(); show("pick"); requestAnimationFrame(frame);
