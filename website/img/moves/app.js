/* IMU Band — browser side
 * Flow: pick an exercise → calibrate A (start) and B (end) → save → count reps.
 * Saved calibrations are kept per exercise, so picking it again goes straight to reps.
 * Data comes from the band over Yun Wi-Fi or USB serial ({pitch, roll} per sample).
 */

// ---------- exercises ----------
// demo = simulated start/end angles (only used with ?demo in the URL).
const EXERCISES = [
  { id: "legext",  name: "Seated Leg Extension", where: "front of the ankle",          axis: "pitch",
    a: "Knee bent 90°, foot down",   b: "Leg straight out",           demo: [-75, 5],
    move: "img/moves/leg-extension" },
  { id: "curl",    name: "Arm Curl",             where: "inside of the wrist",         axis: "pitch",
    a: "Arm straight down",          b: "Fist up at your shoulder",   demo: [-80, 55],
    move: "img/moves/arm-curl" },
  { id: "squat",   name: "Squat",                where: "outside of the thigh",        axis: "pitch",
    a: "Standing tall",              b: "Thighs parallel to floor",   demo: [-85, -5],
    move: "img/moves/squat" },
  { id: "situp",   name: "Sit‑Up",               where: "chest, below the collarbone", axis: "pitch",
    a: "Lying flat on your back",    b: "Chest up toward knees",      demo: [-5, 60],
    move: "img/moves/sit-up" },
  { id: "lateral", name: "Lateral Raise",        where: "upper arm, above the elbow",  axis: "roll",
    a: "Arm relaxed at your side",   b: "Arm out at shoulder height", demo: [-85, 0],
    move: "img/moves/lateral-raise" },
  { id: "press",   name: "Shoulder Press",       where: "upper arm, above the elbow",  axis: "roll",
    a: "Hands at shoulder height",   b: "Arms straight overhead",     demo: [0, 75],
    move: "img/moves/shoulder-press" },
];

const SAMPLES_PER_CAPTURE = 30;   // same as the progress-check sketch
// A rep = get most of the way from A to B, then come back to A.
const REACH_B = 0.85;   // 85% of the way to B counts as reaching B
const NEAR_A  = 0.15;   // within 15% of the range from A counts as back at A
const $ = (id) => document.getElementById(id);

const state = {
  view: "pick",           // pick | calib | work
  ex: EXERCISES[0],
  saved: loadCal(),       // { [exId]: { start, final } }
  draft: {},              // calibration in progress
  angle: 0,
  capturing: null,        // { which, buf: [] }
  reps: 0, partials: 0, history: [],
  phase: "idle",          // idle | atStart | moving
  peak: 0,
};

// ---------- storage ----------
function loadCal() { try { return JSON.parse(localStorage.getItem("imuband.cal")) || {}; } catch { return {}; } }
function saveCal() { try { localStorage.setItem("imuband.cal", JSON.stringify(state.saved)); } catch {} }
const isSaved = (id) => { const c = state.saved[id]; return c && c.start != null && c.final != null; };

// ---------- screens ----------
function show(view) {
  state.view = view;
  $("pickScreen").hidden = view !== "pick";
  $("stage").hidden = view === "pick";
  $("calibView").hidden = view !== "calib";
  $("workView").hidden = view !== "work";
  if (view === "pick") renderPick();
  drawZones();
}

function renderPick() {
  $("exercises").innerHTML = EXERCISES.map((e, i) => `
    <li><button data-id="${e.id}">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <span class="move"><img src="${e.move}-a.png" alt=""><img class="b" src="${e.move}-b.png" alt=""></span>
      <span class="name">${e.name}</span>
      ${motionArc(e)}
      <span class="tag ${isSaved(e.id) ? "saved" : "new"}">${isSaved(e.id) ? "Saved" : "Calibrate"}</span>
    </button></li>`).join("");
}

// Small diagram of the movement: the arc from A (hollow dot) to B (solid dot),
// using the saved calibration if there is one, otherwise a typical range.
function motionArc(e) {
  const c = state.saved[e.id];
  const [a, b] = c && c.start != null ? [c.start, c.final] : e.demo;
  const cx = 60, cy = 58, r = 46;
  const p = (ang) => { const th = (90 - Math.max(-90, Math.min(90, ang))) * Math.PI / 180; return [cx + r * Math.cos(th), cy - r * Math.sin(th)]; };
  const seg = (x, y) => { const [lo, hi] = [Math.min(x, y), Math.max(x, y)]; const [x1, y1] = p(lo), [x2, y2] = p(hi); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const [ax, ay] = p(a), [bx, by] = p(b);
  return `<svg class="arc" viewBox="0 0 120 66" aria-hidden="true">
    <path class="t" d="${seg(-90, 90)}"/><path class="m" d="${seg(a, b)}"/>
    <circle class="h" cx="${cx}" cy="${cy}" r="4"/>
    <circle class="a" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6"/>
    <circle class="b" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6"/></svg>`;
}

function pick(id) {
  state.ex = EXERCISES.find(e => e.id === id);
  sim?.setRange(state.ex.demo);
  $("exName").textContent = state.ex.name;
  $("placement").innerHTML = `Strap on the ${state.ex.where}`;
  $("poseA").src = $("prevA").src = state.ex.move + "-a.png";
  $("poseB").src = $("prevB").src = state.ex.move + "-b.png";
  $("startHow").textContent = state.ex.a;
  $("finalHow").textContent = state.ex.b;
  if (isSaved(id)) startWork(); else startCalib();
}

function startCalib() {
  state.draft = {};
  renderCalib();
  cue("");
  show("calib");
}

function startWork() {
  resetSet();
  cue("");
  show("work");
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
  if (!c || c.start == null || c.final == null) return null;
  const rom = Math.abs(c.final - c.start), dir = Math.sign(c.final - c.start) || 1;
  return { start: c.start, final: c.final, rom, dir };
}
function progress(a, z) { return z.rom ? ((a - z.start) * z.dir) / z.rom : 0; }

function drawZones() {
  const z = state.view === "pick" ? null : zones();
  if (!z) { ["zoneStart", "zoneFinal", "fill"].forEach(id => $(id).setAttribute("d", "")); return; }
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
      if (state.peak >= REACH_B) { state.reps++; state.history.push(pct); bump(); cue("Good rep."); }
      else if (state.peak > 0.3) { state.partials++; cue(`Short rep — ${Math.round(pct * 100)}%. Go further.`); }
      state.phase = "atStart";
      renderCounts();
    }
  }
}
function cue(t) { if ($("cue").textContent !== t) $("cue").textContent = t; }
function bump() { const el = $("reps"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

// Rep tracker: one bar per rep, filled to the range reached; shows the latest 15.
function renderTracker() {
  const start = Math.max(0, state.history.length - 15);
  let html = "";
  state.history.slice(start).forEach((pct, k) => {
    html += `<div class="slot done"><div class="bar"><i style="height:${Math.min(100, Math.round(pct * 100))}%"></i></div><small>${start + k + 1}</small></div>`;
  });
  html += `<div class="slot next"><div class="bar"></div><small>${state.history.length + 1}</small></div>`;
  $("tracker").innerHTML = html;
}
function renderCounts() { $("reps").textContent = state.reps; $("partials").textContent = state.partials; renderTracker(); }
function resetSet() {
  Object.assign(state, { reps: 0, partials: 0, history: [], phase: "idle", peak: 0 });
  renderCounts();
}

// ---------- incoming samples ----------
let sampleTimes = [];
function onSample(s) {
  const a = Number(s[state.ex.axis]);
  if (!Number.isFinite(a)) return;
  state.angle = a;
  const now = performance.now(); sampleTimes.push(now);
  sampleTimes = sampleTimes.filter(t => now - t < 1000);

  if (state.capturing) {
    const c = state.capturing; c.buf.push(a);
    $(c.which === "start" ? "startVal" : "finalVal").textContent = `Reading ${c.buf.length}/${SAMPLES_PER_CAPTURE}`;
    if (c.buf.length >= SAMPLES_PER_CAPTURE) finishCapture();
    return;
  }
  if (state.view === "work") step(a);
}

// ---------- capture A / B ----------
function capture(which) {
  if (!source) return;
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
  $("saveBtn").disabled = d.start == null || d.final == null;
}
function saveCalibration() {
  const d = state.draft; if (d.start == null || d.final == null) return;
  state.saved[state.ex.id] = { start: d.start, final: d.final };
  saveCal();
  startWork();
}

// ---------- UI events ----------
$("exercises").addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) pick(b.dataset.id); });
$("backBtn").onclick = () => show("pick");
$("homeBtn").onclick = () => show("pick");
$("capStart").onclick = () => capture("start");
$("capFinal").onclick = () => capture("final");
$("saveBtn").onclick = saveCalibration;
$("resetSet").onclick = resetSet;
$("recalBtn").onclick = startCalib;

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
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
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
function demoSource() {
  let [lo, hi] = state.ex.demo, t = 0, depth = 1, prevPhase = 0;
  const id = setInterval(() => {
    t += 0.05;
    const phase = (Math.sin(t * 1.6 - Math.PI / 2) + 1) / 2;
    if (prevPhase > 0.02 && phase <= 0.02) depth = Math.random() < 0.2 ? 0.55 + Math.random() * 0.2 : 1 + Math.random() * 0.08;
    prevPhase = phase;
    const hold = api.holdAt === "start" ? 0 : api.holdAt === "final" ? 1
               : state.view !== "work" || t < 3 ? 0 : phase * depth;
    onSample({ pitch: lo + (hi - lo) * hold + (Math.random() - 0.5) * 1.6, roll: lo + (hi - lo) * hold });
  }, 50);
  const api = { holdAt: null, stop() { clearInterval(id); }, setRange(r) { [lo, hi] = r; t = 0; }, release() { api.holdAt = null; t = 0; } };
  return api;
}
if (new URLSearchParams(location.search).has("demo")) connect("demo");

// ---------- render loop: spring-damped needle ----------
let pos = 0, vel = 0;

function frame() {
  vel += (clampA(state.angle) - pos) * 0.12; vel *= 0.72; pos += vel;
  $("needle").setAttribute("transform", `rotate(${pos.toFixed(2)} ${CX} ${CY})`);
  // live fill: from A to wherever the limb is now
  const zf = state.view === "pick" ? null : zones();
  $("fill").setAttribute("d", zf && source ? arc(zf.start, pos) : "");

  // Until data arrives, show the start→end drawing instead of an empty dial.
  const receiving = !!source && sampleTimes.some(t => performance.now() - t < 1000);
  if ($("live").hidden === receiving) { $("live").hidden = !receiving; $("preview").hidden = receiving; }

  if (source) {
    $("angle").textContent = `${state.angle.toFixed(1)}°`;
    const z = zones();
    $("romPct").textContent = z ? `${Math.round(Math.max(0, progress(state.angle, z)) * 100)}%` : "—";
    if (sampleTimes.some(t => performance.now() - t < 1000)) {
      linkState(mode, "Connected"); LINKS[mode] && $(LINKS[mode].el).classList.add("live");
    }
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
drawTicks(); show("pick"); requestAnimationFrame(frame);
