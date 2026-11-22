import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", e => list.push(e.message));
  page.on("console", m => { if (m.type() === "error") list.push(m.text()); });
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

const HOME = "Today’s session";
const WARM = "Start warm‑up";

test("home lists the whole program and fits the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: HOME })).toBeVisible();
  for (const name of ["Mobility", "Squat / Lunge", "Push", "Hinge", "Pull", "Carry", "Core", "Stretches"])
    await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.locator(".row")).toHaveCount(16);
  await expect(page.getByText("Session 1 of 12")).toBeVisible();
  await noHorizontalScroll(page);
});

test("demo dialog opens for an exercise, closes with Escape and the close button", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Arm Curl" })).toBeVisible();
  await expect(dialog.getByText("Keep your elbow pinned to your side.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /Plank/ }).click();
  await expect(page.getByRole("dialog").getByText("Hold it for")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("without a band, calibrating tells you to connect", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start — calibrate first" }).click();
  await expect(page.getByText("Band not connected.")).toBeVisible();
  await page.locator("#capStart").click();
  await expect(page.getByText("Connect the band first")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save calibration" })).toBeDisabled();
});

test("demo mode: calibrate, count reps, log a set, and keep it after reload", async ({ page }) => {
  await page.goto("/?demo");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start — calibrate first" }).click();

  await page.locator("#capStart").click();
  await expect(page.locator("#capStart small")).toHaveText(/-?\d+(\.\d)?°/, { timeout: 15_000 });
  await page.locator("#capFinal").click();
  await expect(page.locator("#capFinal small")).toHaveText(/-?\d+(\.\d)?°/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Save calibration" }).click();

  await expect(page.getByText("Set 1 of 1–2")).toBeVisible();
  await expect(async () => {
    expect(Number(await page.locator(".reps").textContent())).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 30_000 });

  await page.getByRole("textbox", { name: /Load/ }).fill("15 lb");
  await page.getByRole("button", { name: "Finish set" }).click();
  await expect(page.getByText(/Set 1 logged/)).toBeVisible();
  await expect(page.getByText("Exercise log")).toBeVisible();
  await expect(page.locator(".log-table td").last()).toHaveText("15 lb");

  await page.reload();
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start exercise" }).click();
  await expect(page.getByText("Exercise log")).toBeVisible();
  await expect(page.getByText("Set 2 of 1–2")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Load/ })).toHaveValue("15 lb");
});

test("finishing a set with no reps does not log anything", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("imuband.cal", JSON.stringify({ curl: { start: 0, final: 60 } })));
  await page.goto("/");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start exercise" }).click();
  await page.getByRole("button", { name: "Finish set" }).click();
  await expect(page.getByText("No reps yet.")).toBeVisible();
  await expect(page.getByText("Exercise log")).toHaveCount(0);
});

test("saved data from the previous version of the app still loads", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("imuband.cal", JSON.stringify({ squat: { start: -80, final: -5 }, plank: { start: 5, final: null } }));
    localStorage.setItem("imuband.log", JSON.stringify({ squat: [{ date: "2026-01-02", sets: [{ reps: 12, partials: 1, load: "bar" }] }] }));
  });
  await page.goto("/");
  const squat = page.locator(".row", { hasText: "Squat" }).first();
  await expect(squat).toContainText("Last: 12 @ bar");
  await expect(squat).toContainText("Saved");
  await expect(page.locator(".row", { hasText: "Plank" })).toContainText("Saved");
});

test("a ready-to-progress exercise is flagged", async ({ page }) => {
  await page.addInitScript(() => {
    const d = (date: string) => ({ date, sets: [{ reps: 20, load: "10 lb" }, { reps: 20, load: "10 lb" }] });
    localStorage.setItem("imuband.cal", JSON.stringify({ curl: { start: 0, final: 60 } }));
    localStorage.setItem("imuband.log", JSON.stringify({ curl: [d("2026-01-02"), d("2026-01-04")] }));
  });
  await page.goto("/");
  await expect(page.locator(".row", { hasText: "Arm Curl" })).toContainText("Add load");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start exercise" }).click();
  await expect(page.getByText(/Time to increase the load/)).toBeVisible();
});

test("cardio: zone from heart-rate reserve, manual heart rate, machine tips, timer, persistence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your cardio zone: 114–136 bpm")).toBeVisible();
  await page.getByRole("button", { name: WARM }).click();
  await expect(page.getByRole("heading", { name: "Warm‑up" })).toBeVisible();
  await expect(page.getByText("No heart rate yet.")).toBeVisible();

  await page.getByLabel("Resting HR").fill("60");
  await page.getByLabel("Max HR").fill("180");
  await expect(page.getByText("Cardio zone 108–132 bpm")).toBeVisible();

  await page.getByRole("spinbutton", { name: /type it/ }).fill("90");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.locator(".hr-value")).toHaveText("90");
  await expect(page.locator(".hr-state")).toContainText("Nice and easy");

  await page.getByRole("spinbutton", { name: /type it/ }).fill("170");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.locator(".hr-state")).toContainText("Too hard for a warm‑up");

  await page.getByRole("radio", { name: "Recumbent bike" }).click();
  await expect(page.getByRole("radio", { name: "Recumbent bike" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".hr-state")).toContainText("pedal slower");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.locator(".clock")).not.toHaveText("0:00", { timeout: 5000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: WARM }).click();
  await expect(page.getByLabel("Resting HR")).toHaveValue("60");
  await expect(page.getByRole("radio", { name: "Recumbent bike" })).toHaveAttribute("aria-checked", "true");
});

test("cardio demo run: warm-up, then cardio, then back to strength, with the phase logged", async ({ page }) => {
  await page.goto("/?demo");
  await page.getByRole("button", { name: WARM }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".clock")).not.toHaveText("0:00", { timeout: 15_000 });
  await page.waitForTimeout(10_000);   // the log ignores phases shorter than 10 s
  await page.getByRole("button", { name: "Start cardio →" }).click();
  await expect(page.getByRole("heading", { name: "Cardio", level: 2 })).toBeVisible();
  await expect(page.getByText("Warm‑up logged.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cardio log" })).toBeVisible();
  await page.getByRole("button", { name: "Done — on to strength" }).click();
  await expect(page.getByRole("heading", { name: "Strength training" })).toBeVisible();
});

test("brand link and back button return home from every screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start cool‑down" }).click();
  await expect(page.getByRole("heading", { name: "Cool‑down", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: /^Session$/ }).click();
  await expect(page.getByRole("heading", { name: HOME })).toBeVisible();
  await page.getByRole("button", { name: /Plank/ }).click();
  await page.getByRole("button", { name: "Start — calibrate first" }).click();
  await page.getByRole("button", { name: "IMU Exercise Band Tracker" }).click();
  await expect(page.getByRole("heading", { name: HOME })).toBeVisible();
});

test("keyboard: an exercise row is focusable and Enter opens the demo", async ({ page }) => {
  await page.goto("/");
  await page.locator(".row").first().focus();
  await expect(page.locator(".row").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("every screen fits the viewport", async ({ page }) => {
  await page.goto("/?demo");
  await page.getByRole("button", { name: WARM }).click();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: /^Session$/ }).click();
  await page.getByRole("button", { name: /Squat/ }).first().click();
  await page.getByRole("button", { name: /Start/ }).last().click();
  await noHorizontalScroll(page);
});

test("between sets: rest stopwatch, band ignored, next set starts only on button press", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("imuband.cal", JSON.stringify({ curl: { start: -80, final: 55 } })));
  await page.goto("/?demo");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start exercise" }).click();
  const reps = page.locator(".reps");
  const counted = async () => expect(async () => {
    expect(Number(await reps.textContent())).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 40_000 });

  await counted();
  await page.getByRole("button", { name: "Finish set" }).click();

  // rest screen: stopwatch runs, no rep counter, no way to count until started
  const rest = page.getByRole("group", { name: "Rest between sets" });
  await expect(rest).toBeVisible();
  await expect(page.getByText(/Set 1 logged. Rest as long as you need/)).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("0:00");
  await expect(page.getByRole("timer")).not.toHaveText("0:00", { timeout: 5000 });
  await expect(reps).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish set" })).toHaveCount(0);
  await page.waitForTimeout(6000);   // the simulated band keeps moving; nothing may be counted
  await expect(reps).toHaveCount(0);

  await rest.getByRole("button", { name: "Start set 2" }).click();
  await expect(rest).toHaveCount(0);
  await expect(page.getByText("Set 2 of 1–2")).toBeVisible();
  await expect(reps).toHaveText("0");

  // after the last set there is no rest screen
  await counted();
  await page.getByRole("button", { name: "Finish set" }).click();
  await expect(page.getByText("Both sets logged. On to the next exercise.")).toBeVisible();
  await expect(rest).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish set" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Do another set" })).toBeVisible();
});

test("after two sets today, 'Do another set' enables finishing an extra set", async ({ page }) => {
  await page.addInitScript(() => {
    const today = new Date().toLocaleDateString("en-CA");
    localStorage.setItem("imuband.cal", JSON.stringify({ curl: { start: 0, final: 60 } }));
    localStorage.setItem("imuband.log", JSON.stringify({ curl: [{ date: today, sets: [{ reps: 12, load: "" }, { reps: 11, load: "" }] }] }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Arm Curl/ }).click();
  await page.getByRole("button", { name: "Start exercise" }).click();
  await expect(page.getByText("2 sets done today")).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish set" })).toHaveCount(0);

  await page.getByRole("button", { name: "Do another set" }).click();
  await expect(page.getByText("Extra set 3")).toBeVisible();
  await page.getByRole("button", { name: "Finish set" }).click();
  await expect(page.getByText("No reps yet.")).toBeVisible();   // enabled: nothing counted, so nothing logged

  await expect(page.getByRole("button", { name: "Do another set" })).toHaveCount(0);
});
