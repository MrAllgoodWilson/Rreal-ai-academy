// End-to-end check for the "Claude.ai Complete Guide" course (demo mode).
// Usage: BASE=http://localhost:3000 [SHOTS=/some/dir] node tests/e2e/claude-course.mjs
// Signs up a throwaway learner, opens the catalog and course page, then plays ALL lessons in order:
// answers every quiz, passes every prompt lab (offline grader), finishes each lesson, and runs axe-core
// (WCAG A/AA, serious/critical must be zero) on each lesson's quiz and lab state. Finishes with a phone-size pass.
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "claude-course-shots-"));
fs.mkdirSync(SHOTS, { recursive: true });
const COURSE = "c-claude-mastery";
const GOOD_PROMPT = `You are a helpful assistant for my small business. Write a clear plan for a made-up weekly task for my team, using placeholders like [NAME] and [DATE]. Format it as a table with 5 rows, under 150 words, for example: "Item - reason". Avoid jargon, do not invent facts, and list what I must verify.`;

const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });
const seen = (loc, timeout = 10000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const axe = async (label, pg = page) => {
  await pg.waitForTimeout(1300); // let entrance animations finish; mid-fade colours give false contrast failures
  await pg.addScriptTag({ path: AXE });
  const r = await pg.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.map((v) => ({
    id: v.id, impact: v.impact, n: v.nodes.length,
    nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), text: (n.html || "").replace(/\s+/g, " ").slice(0, 90), data: (n.any[0] && n.any[0].data) ? { fg: n.any[0].data.fgColor, bg: n.any[0].data.bgColor, ratio: n.any[0].data.contrastRatio, size: n.any[0].data.fontSize } : null })),
  })));
  const serious = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  ok(`axe ${label}`, serious.length === 0, serious.map((v) => `${v.id}(${v.impact}×${v.n})`).join(", ") || "clean");
  if (serious.length && process.env.DEBUG_AXE) for (const v of serious) for (const n of v.nodes) console.log("   ·", v.id, n.target, JSON.stringify(n.data), n.text);
};
const dismissCelebrations = async () => {
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(900);
    const b = page.getByRole("alertdialog").getByRole("button");
    if (!(await b.count())) break;
    // The celebration animates in; click through it without waiting for "stable".
    await b.first().click({ force: true, timeout: 4000 }).catch(() => b.first().evaluate((el) => el.click()).catch(() => {}));
  }
};

// Sign up, "pay" (demo-mode local trial), skip through onboarding.
await page.goto(`${BASE}/signup`);
await page.getByLabel("Your name").fill("Casey Tester");
await page.getByLabel("Username").fill(`casey_${Date.now() % 100000}`);
await page.getByLabel("Email").fill(`casey${Date.now()}@example.com`);
await page.getByLabel("Password", { exact: true }).fill("SuperSecret123");
await page.getByLabel(/I agree/).check();
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/subscribe*");
await page.getByRole("button", { name: /Join for/ }).click();
await page.waitForURL("**/onboarding");
await page.getByRole("radio", { name: /Boost my career/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("radio", { name: /Regular/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: /Start learning/ }).click();
await page.waitForURL("**/dashboard");

// Catalog and course page.
await page.goto(`${BASE}/learn`);
ok("catalog lists the new course", await seen(page.getByRole("heading", { name: /Claude\.ai Complete Guide/ })));
await axe("catalog with new course");
await page.goto(`${BASE}/learn/${COURSE}`);
ok("course page shows the course title", await seen(page.getByRole("heading", { name: /Claude\.ai Complete Guide/ })));
const lessonLinks = await page.locator('a[href^="/lesson/cm-"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
ok("course page links 24 lessons", lessonLinks.length === 24, `${lessonLinks.length} links`);
await page.screenshot({ path: path.join(SHOTS, "course-page.png"), fullPage: true });
await axe("course page");

// Play every lesson in order.
const ids = lessonLinks.map((h) => h.split("/").pop());
let played = 0;
for (const id of ids) {
  await page.goto(`${BASE}/lesson/${id}`);
  const title = await page.getByRole("heading", { level: 1 }).first().innerText().catch(() => "");
  let axedQuiz = false, axedLab = false, finished = false;
  for (let guard = 0; guard < 20 && !finished; guard++) {
    const radios = page.getByRole("radio");
    const lab = page.locator("#prompt-input");
    if (await radios.count() && await page.getByRole("button", { name: "Check answer" }).count()) {
      if (!axedQuiz) { await axe(`${id} quiz`); axedQuiz = true; }
      let right = false;
      const n = await radios.count();
      for (let i = 0; i < n && !right; i++) {
        await radios.nth(i).click();
        await page.getByRole("button", { name: "Check answer" }).click();
        right = await seen(page.getByText("Correct!"), 1500);
      }
      if (!right) { ok(`${id}: a quiz option is correct`, false); break; }
    } else if (await lab.count()) {
      await lab.fill(GOOD_PROMPT);
      if (!axedLab) { await axe(`${id} lab`); axedLab = true; }
      const passedLab = await seen(page.getByText("✓ Lab passed"), 6000);
      if (!passedLab) { ok(`${id}: lab passes with a good prompt`, false); break; }
    }
    const finish = page.getByRole("button", { name: "Finish lesson" });
    if (await finish.count() && await finish.isEnabled()) {
      await finish.click();
      await page.getByRole("alertdialog").waitFor({ timeout: 8000 }).catch(() => {});
      await dismissCelebrations();
      finished = true;
      break;
    }
    const cont = page.getByRole("button", { name: "Continue" });
    if (await cont.count() && await cont.isEnabled()) await cont.click();
    else await page.waitForTimeout(300);
  }
  if (finished) played++;
  ok(`${id} (${title.slice(0, 48)}): played to completion`, finished && axedQuiz && axedLab);
}
ok("all 24 lessons completed", played === 24, `${played}/24`);

// Completion state.
await page.goto(`${BASE}/learn/${COURSE}`);
await page.waitForTimeout(800);
const body = await page.locator("body").innerText();
ok("course page shows full progress", /100%|24\s*\/\s*24|24 of 24/.test(body));
await page.screenshot({ path: path.join(SHOTS, "course-complete.png"), fullPage: true });

// Phone-size pass with the SAME signed-in learner: real lesson content must render, not overflow, and pass axe.
const state = await ctx.storageState();
const phone = await browser.newContext({ ...devices["iPhone 13"], storageState: state });
const mp = await phone.newPage();
for (const id of ["cm-welcome", "cm-models", "cm-playbook"]) {
  await mp.goto(`${BASE}/lesson/${id}`);
  const h1 = await mp.getByRole("heading", { level: 1 }).first().innerText({ timeout: 10000 }).catch(() => "");
  ok(`phone: ${id} shows its real lesson content`, h1.length > 5 && !/Join for/.test(await mp.locator("body").innerText()), h1.slice(0, 50));
  await mp.waitForTimeout(1300);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(`phone: ${id} has no horizontal overflow`, !overflow);
  await axe(`phone ${id}`, mp);
  await mp.screenshot({ path: path.join(SHOTS, `phone-${id}.png`), fullPage: true });
}
await phone.close();

ok("no page errors or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOTS}`);
if (failed.length) { console.log("FAILED:\n" + failed.map((f) => ` - ${f.name} ${f.extra}`).join("\n")); process.exit(1); }
