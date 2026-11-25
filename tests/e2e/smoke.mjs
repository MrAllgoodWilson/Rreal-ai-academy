// End-to-end smoke test (demo mode). Usage: BASE=http://localhost:3000 node tests/e2e/smoke.mjs
// Walks every core flow, runs axe-core accessibility scans, and saves screenshots to docs/screenshots.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Playwright may be installed globally (resolved via NODE_PATH), so load it with require.
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = path.join(ROOT, "docs/screenshots");
const AXE = require.resolve("axe-core/axe.min.js");
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, permissions: [] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (n, full = false) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: full });
const axe = async (label) => {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length })));
  const serious = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  ok(`axe ${label}: no serious/critical WCAG A/AA violations`, serious.length === 0, r.map((v) => `${v.id}(${v.impact}×${v.n})`).join(", ") || "clean");
};
const seen = (loc, timeout = 10000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const dismissCelebrations = async () => {
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1200); // let the spring/3D badge animation settle
    const b = page.getByRole("alertdialog").getByRole("button");
    if (!(await b.count())) break;
    await b.first().click();
  }
};

// 1. Landing
await page.goto(BASE, { waitUntil: "networkidle" });
ok("landing renders hero", await seen(page.getByRole("heading", { level: 1 })));
await page.waitForTimeout(800);
await shot("01-landing");
await shot("01-landing-full", true);
await axe("landing");

// 2. Sign up
const email = `learner${Date.now()}@example.com`;
await page.goto(`${BASE}/signup`);
await page.getByLabel("Your name").fill("Jordan Rivers");
await page.getByLabel("Username").fill("jordan_ai");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill("weak");
ok("password strength meter flags weak password", await seen(page.getByText(/needs at least 10 characters/)));
await page.getByLabel("Password", { exact: true }).fill("SuperSecret123");
await page.getByLabel(/I agree/).check();
await axe("signup");
await shot("02-signup");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/subscribe*");
ok("sign up → membership paywall", page.url().includes("/subscribe"));
await page.goto(`${BASE}/dashboard`);
await page.waitForURL("**/subscribe*");
ok("dashboard blocked until paid", page.url().includes("/subscribe"));
await page.waitForTimeout(600);
await shot("02b-subscribe");
await axe("subscribe");
await page.getByRole("button", { name: /Join for \$1\/month/ }).click();
await page.waitForURL("**/onboarding");
ok("payment → onboarding", page.url().endsWith("/onboarding"));

// 3. Onboarding
await page.getByRole("radio", { name: /Boost my career/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("radio", { name: /Regular/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await shot("03-onboarding-accessibility");
await page.getByRole("button", { name: /Start learning/ }).click();
await page.waitForURL("**/dashboard");
await page.waitForTimeout(1200);
ok("onboarding → dashboard", await seen(page.getByRole("heading", { name: /Jordan/ })));
await shot("04-dashboard-new");
await axe("dashboard");

// 4. Lesson with quizzes
await page.getByRole("link", { name: /Start lesson/ }).click();
await page.waitForURL("**/lesson/ai-in-plain-english");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
const cont = page.getByRole("button", { name: "Continue" });
ok("quiz gates progress until answered", await cont.isDisabled());
await page.getByRole("radio", { name: /Searching Google/ }).click();
await page.getByRole("button", { name: "Check answer" }).click();
ok("wrong answer shows feedback", await seen(page.getByText("Not quite")));
await page.getByRole("radio", { name: /Predicting the most likely/ }).click();
await page.getByRole("button", { name: "Check answer" }).click();
await shot("05-lesson-quiz");
await axe("lesson quiz");
await cont.click();
await page.getByRole("radio", { name: /Verify it with a reliable source/ }).click();
await page.getByRole("button", { name: "Check answer" }).click();
await page.getByRole("button", { name: "Finish lesson" }).click();
await page.getByRole("alertdialog").waitFor();
await page.waitForTimeout(1400);
ok("celebration dialog on completion", await seen(page.getByRole("alertdialog").getByText(/Lesson complete/)));
await shot("06-celebration");
await dismissCelebrations();
ok("first lesson awards First Steps badge", await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("rreal.v1.user.") && localStorage.getItem(k).includes("first-steps"))));

// 5. Sandbox
await page.goto(`${BASE}/sandbox`);
await page.getByLabel("Your prompt").fill("write about dogs");
const low = Number((await page.locator("#pqs-summary .font-display").innerText()).match(/\d+/)[0]);
await page.getByLabel("Your prompt").fill('You are a viral video strategist. Write 10 hooks for a 30-second TikTok about budget meal prep for busy college students. Max 12 words each, numbered list, for example: "I ate for $20 a week."');
await page.waitForTimeout(400);
const high = Number((await page.locator("#pqs-summary .font-display").innerText()).match(/\d+/)[0]);
ok("Prompt Quality Score rises with a better prompt", high > low + 40, `${low} → ${high}`);
await page.getByRole("button", { name: /Run prompt/ }).click();
await page.getByText(/Simulated output|AI output/).first().waitFor();
await page.waitForTimeout(600);
ok("sandbox returns output", await seen(page.getByRole("heading", { name: /AI output/ })));
await shot("07-sandbox");
await axe("sandbox");

// 6. Coach
await page.goto(`${BASE}/coach`);
await page.getByLabel("Message the coach").fill("How do I write a good hook for my bakery?");
await page.getByRole("button", { name: "Send message" }).click();
await page.getByText(/Hooks win in the first two seconds/).first().waitFor({ timeout: 15000 });
ok("coach answers questions", true);
await page.getByRole("radio", { name: /Quiz me/ }).click();
await page.getByText(/Say or type A, B, C or D/).first().waitFor({ timeout: 15000 });
ok("coach quiz mode asks a question", true);
await shot("08-coach");
await axe("coach");

// 7. Studio
await page.goto(`${BASE}/studio`);
await page.getByLabel("Niche / topic").fill("budget meal prep");
await page.getByLabel("Audience").fill("busy college students");
await page.getByRole("button", { name: /Generate hooks/ }).click();
await page.getByRole("radio").first().click();
await page.getByRole("button", { name: /Write the script/ }).click();
await page.getByRole("button", { name: /Preview video/ }).click();
await page.getByRole("button", { name: /Play preview/ }).click();
await page.waitForTimeout(2600);
ok("studio renders 9:16 preview", await seen(page.getByRole("img", { name: /Vertical TikTok preview/ })));
await shot("09-studio-preview");
await page.getByRole("button", { name: /Pause/ }).click();
await page.getByRole("button", { name: /Schedule posts/ }).click();
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export to calendar/ }).click()]);
ok("studio exports .ics", dl.suggestedFilename().endsWith(".ics"));

// 8. Pricing, catalog, playbooks, creator, connections, Spanish
await page.goto(`${BASE}/pricing`);
ok("pricing shows $1/month", await seen(page.getByText("$1", { exact: false })));
await shot("10-pricing");
await page.goto(`${BASE}/learn`);
ok("catalog lists standalone courses", await seen(page.getByRole("heading", { name: /Build a Website with AI — No Code/ })));
await page.waitForTimeout(800);
await shot("10b-catalog", true);
await axe("catalog");
await page.getByRole("radio", { name: "Expert" }).click();
ok("level filter works", await seen(page.getByRole("heading", { name: /AI Agents & Coding Agents for Pros/ })));
await page.goto(`${BASE}/learn/c-website-nocode`);
ok("course page lists lessons", await seen(page.getByText("Plan Your Site with AI")));
await page.goto(`${BASE}/playbooks`);
ok("playbooks page", await seen(page.getByRole("heading", { name: /Faceless TikTok/ })));
await page.goto(`${BASE}/playbooks/pb-website-code`);
ok("playbook lists required subscriptions", await seen(page.getByRole("heading", { name: /Accounts & subscriptions you need/ })));
ok("playbook names GitHub + Vercel", (await seen(page.getByText("GitHub", { exact: true }))) && (await seen(page.getByText("Vercel", { exact: true }))));
await page.getByRole("checkbox", { name: "Mark step 1 done" }).click();
ok("playbook steps can be checked off", await seen(page.getByText("1/5 steps done")));
await page.waitForTimeout(500);
await shot("10c-playbook");
await axe("playbook");
await page.goto(`${BASE}/create`);
await page.getByLabel("What do you want to learn or create?").fill("Teach me to make Christmas flyers for my nail salon");
await page.getByRole("button", { name: /Build my course/ }).click();
ok("course creator responds (needs ANTHROPIC_API_KEY for real generation)", await seen(page.getByRole("alert").or(page.getByText("Course ready")), 90000));
await shot("10d-create");
await axe("create");
await page.goto(`${BASE}/connections`);
ok("connections & plugins page", await seen(page.getByRole("heading", { name: /Plugins/ })));
await shot("10e-connections");
await axe("connections");
await page.goto(`${BASE}/settings`);
ok("voice picker offers premium voices", await seen(page.getByText("Rachel")));
await page.getByRole("radio", { name: "male", exact: true }).click();
ok("voice gender filter", (await seen(page.getByText("Adam"))) && !(await page.getByText("Rachel").isVisible()));
await page.getByRole("radio", { name: "Español" }).click();
ok("Spanish UI", await seen(page.getByRole("link", { name: "Panel" }).or(page.getByRole("link", { name: "Cursos" }))));
await page.goto(`${BASE}/dashboard`);
ok("dashboard in Spanish", await seen(page.getByText(/Buenos días|Buenas tardes|Buenas noches/)));
await shot("10f-dashboard-es");
await page.evaluate(() => localStorage.setItem("rreal.v1.lang", "en"));

// 9. Certificates: mark Foundations complete (simulates finishing the track), claim, verify
await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.startsWith("rreal.v1.user."));
  const blob = JSON.parse(localStorage.getItem(key));
  for (const id of ["ai-in-plain-english", "what-ai-can-and-cant-do", "first-prompt", "iterate-and-fix", "real-framework", "zero-few-shot", "chain-of-thought", "build-email-assistant"]) blob.progress.completed[id] = { at: new Date().toISOString(), score: 100, perfect: true };
  localStorage.setItem(key, JSON.stringify(blob));
});
await page.goto(`${BASE}/certificates`);
await page.getByRole("button", { name: "Claim certificate" }).first().click();
await page.getByRole("alertdialog").waitFor();
await dismissCelebrations();
await page.locator("#certificate-print svg").first().waitFor();
await page.waitForTimeout(4000); // let confetti settle for a clean screenshot
ok("certificate rendered with QR", (await page.locator("#certificate-print svg").count()) >= 2);
await shot("11-certificate");
const linkedin = await page.getByRole("link", { name: /Add to LinkedIn/ }).getAttribute("href");
ok("LinkedIn add-to-profile link", linkedin.startsWith("https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME"));
const verifyHref = await page.getByRole("link", { name: /Verification page/ }).getAttribute("href");
await page.goto(`${BASE}${verifyHref}`);
ok("public verification page validates credential", await seen(page.getByRole("heading", { name: "Verified credential" })));
ok("verification shows recipient", await seen(page.getByText("Jordan Rivers")));
await shot("12-verify-valid");
await axe("verify");
const token = verifyHref.split("/verify/")[1];
const [body, sig] = token.split(".");
const forged = JSON.parse(Buffer.from(body, "base64url").toString());
forged.n = "Someone Else";
await page.goto(`${BASE}/verify/${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`);
ok("tampered credential is rejected", await seen(page.getByRole("heading", { name: "Could not verify" })));
await shot("13-verify-tampered");

// 10. Badges, leaderboard
await page.goto(`${BASE}/achievements`);
await page.waitForTimeout(800);
await shot("14-badges");
await page.goto(`${BASE}/leaderboard`);
await page.waitForTimeout(800);
ok("leaderboard shows the learner", await seen(page.getByText("Jordan Rivers (you)")));
await shot("15-leaderboard");

// 11. Accessibility modes
await page.goto(`${BASE}/dashboard`);
await page.getByRole("heading", { name: /Jordan/ }).waitFor();
await page.waitForTimeout(800);
await page.keyboard.press("Alt+a");
await page.getByRole("dialog", { name: "Accessibility" }).waitFor();
await page.getByRole("switch", { name: "High contrast" }).click();
await page.getByRole("radio", { name: /130%/ }).click();
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
ok("high-contrast mode applies", (await page.evaluate(() => document.documentElement.dataset.contrast)) === "high");
await shot("16-dashboard-high-contrast");
await page.evaluate(() => { const k = "rreal.v1.prefs"; const p = JSON.parse(localStorage.getItem(k)); p.contrast = "normal"; p.fontScale = 1; localStorage.setItem(k, JSON.stringify(p)); });

// 12. Sign out → forgot username → forgot password → reset → sign in with new password
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: "Account menu" }).click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL(BASE + "/");
await page.goto(`${BASE}/forgot-username`);
await page.getByLabel("Account email").fill(email);
await page.getByRole("button", { name: /Email my username/ }).click();
ok("forgot username (demo reveals)", await seen(page.getByText(/Your username is: jordan_ai/)));
await page.goto(`${BASE}/forgot-password`);
await page.getByLabel("Account email").fill(email);
await page.getByRole("button", { name: /Send reset link/ }).click();
await page.getByRole("link", { name: "Open your reset link" }).click();
await page.waitForURL("**/reset-password?demo=*");
await page.waitForTimeout(800); // page transition
await page.getByLabel("New password", { exact: true }).fill("BrandNewPass456");
await page.getByLabel("Confirm new password").fill("BrandNewPass456");
await page.getByRole("button", { name: "Update password" }).click();
ok("password reset succeeds", await seen(page.getByText("Password updated")));
await page.goto(`${BASE}/login`);
await page.waitForTimeout(600);
await page.getByLabel("Email or username").fill("jordan_ai");
await page.getByLabel("Password", { exact: true }).fill("SuperSecret123");
await page.getByRole("button", { name: "Sign in" }).click();
ok("old password rejected", await seen(page.getByText(/don't match/)));
await page.getByLabel("Password", { exact: true }).fill("BrandNewPass456");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard");
ok("sign in with username + new password", true);
await page.waitForTimeout(1000);
await shot("17-dashboard-progress");

// 13. Mobile
const m = await browser.newContext({ ...devices["iPhone 13"], storageState: await ctx.storageState() });
const mp = await m.newPage();
for (const route of ["/", "/pricing", "/accessibility", "/dashboard", "/learn", "/learn/foundations", "/lesson/what-ai-can-and-cant-do", "/coach", "/sandbox", "/studio", "/certificates", "/leaderboard", "/settings"]) {
  await mp.goto(BASE + route, { waitUntil: "networkidle" });
  await mp.waitForTimeout(400);
  const clipped = await mp.evaluate(() => {
    const w = window.innerWidth;
    return [...document.querySelectorAll("h1,h2,h3,p,a,button,li,input,label")]
      .filter((el) => !el.closest(".overflow-x-auto") && el.getClientRects().length)
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > w + 1 || r.left < -1; })
      .map((el) => `${el.tagName.toLowerCase()}:"${(el.textContent || "").trim().slice(0, 30)}"`);
  });
  ok(`phone layout fits viewport ${route}`, clipped.length === 0 && (await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), clipped.slice(0, 4).join(", "));
}
await mp.goto(BASE, { waitUntil: "networkidle" });
await mp.waitForTimeout(800);
await mp.screenshot({ path: path.join(SHOTS, "18-mobile-landing.png") });

ok("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
