/* The CCCARE program: warm-up + cardio, mobility, one pair of exercises per functional category,
 * stretches, cool-down. Exercise data is unchanged from the original app. */

export const DOSE = { minSets: 1, maxSets: 2, min: 10, max: 20, block: 12, tol: 12 } as const;

export type CategoryId = "mobility" | "squat" | "push" | "hinge" | "pull" | "carry" | "core" | "stretch";
export interface Category { id: CategoryId; name: string; note: string }

export const CATEGORIES: Category[] = [
  { id: "mobility", name: "Mobility",      note: "Do both to start." },
  { id: "squat",    name: "Squat / Lunge", note: "Do both." },
  { id: "push",     name: "Push",          note: "Do both." },
  { id: "hinge",    name: "Hinge",         note: "Do both." },
  { id: "pull",     name: "Pull",          note: "Do both." },
  { id: "carry",    name: "Carry",         note: "Do both. Walk tall — the band times how long you stay upright." },
  { id: "core",     name: "Core",          note: "Do both." },
  { id: "stretch",  name: "Stretches",     note: "Hold each one." },
];

/** Segment angles in degrees: t torso, nl/fl near/far leg, na/fa near/far arm. */
export interface Pose { t?: number; nl?: number[]; fl?: number[]; na?: number[]; fa?: number[] }
export interface Fig {
  view?: "front";
  props?: "wallBack" | "wall";
  gear?: "db" | "db1";
  band: [string, number];
  anchor?: string;
  a: Pose;
  b?: Pose;
}

export interface Exercise {
  id: string;
  cat: CategoryId;
  name: string;
  where: string;            // where the band is strapped
  axis: "pitch" | "roll";
  a: string;                // start position
  b?: string;               // end position (absent for holds)
  hold?: number;            // seconds to hold a
  demo: [number, number];   // simulated start/end angles (only used with ?demo)
  tip: string;
  move?: string;            // path prefix of the original drawings
  fig?: Fig;                // generated figure when there is no drawing
}

export const EXERCISES: Exercise[] = [
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

/** Bodyweight only: no load field. */
export const NO_LOAD: ReadonlySet<CategoryId> = new Set<CategoryId>(["mobility", "stretch"]);

export const categoryName = (id: CategoryId) => CATEGORIES.find(c => c.id === id)!.name;
