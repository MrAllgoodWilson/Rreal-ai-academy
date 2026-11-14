// X-series orchestrator: separate OS processes hitting the real route handlers / Founders engine at the same instant,
// plus SIGKILL crash windows. Disposable Postgres 17 only (loopback + nonce marker). Stripe and auth are simulated.
// Usage (via the harness script, which supplies env without printing it): node tests/pgint-multiproc.mjs
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const need = (k) => { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v; };
const admin = new pg.Pool({ connectionString: need("HW_PG_ADMIN_URL"), max: 4 });
if (new URL(need("HW_PG_ADMIN_URL")).hostname !== "127.0.0.1") throw new Error("refusing non-loopback database");
{
  const { rows } = await admin.query("select nonce from public.hw_harness_marker limit 1");
  if (rows[0]?.nonce !== need("HW_NONCE")) throw new Error("harness marker mismatch; refusing to run");
}
const WHSEC = `whsec_${crypto.randomBytes(24).toString("hex")}`;
const LEGACY = "price_1UXevHK68Pw0CGHvMMNt6NeD";
const FOUNDERS = "price_HWLOCALFOUNDERS499";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hw-x-"));
const rid = (p) => `${p}_${crypto.randomBytes(8).toString("hex")}`;
const q = async (sql, args = []) => (await admin.query(sql, args)).rows;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, cond, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${detail}`}`); };

const newUser = async (tag) => {
  const r = crypto.randomBytes(5).toString("hex");
  return (await q("insert into auth.users(email, raw_user_meta_data) values ($1,$2) returning id", [`${tag}-${r}@pgint.test`, { username: `${tag}${r}` }]))[0].id;
};
const sub = (price, over = {}) => ({
  id: rid("sub"), status: "active", customer: rid("cus"), cancel_at_period_end: false,
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { app: "rreal-ai-academy" },
  items: { data: [{ price: { id: price, unit_amount: price === FOUNDERS ? 499 : 100, currency: "usd", recurring: { interval: "month" } } }] }, ...over,
});
/** Fixture shortcut: a binding as the authenticated checkout route + checkout.session.completed would have left it. */
const bind = (userId, subId, kind) => q(
  "insert into public.checkout_bindings(session_id,user_id,kind,price_id,livemode,stripe_subscription_id,bound_at) values ($1,$2,$3,$4,true,$5,now())",
  [rid("cs_live"), userId, kind, kind === "founders" ? FOUNDERS : LEGACY, subId]);

function launch(action, params, startAt) {
  const out = path.join(tmp, `${rid("w")}.json`);
  const child = spawn("npx", ["vitest", "run", "--config", "vitest.pgint.config.mts", "tests/webhook-worker.pgint.ts"], {
    env: { ...process.env, HW_WORKER_ACTION: action, HW_WORKER_PARAMS: JSON.stringify(params), HW_WORKER_OUT: out, HW_START_AT: String(startAt), HW_WHSEC: WHSEC },
    stdio: "ignore", detached: true,
  });
  const done = new Promise((r) => child.on("exit", (code, signal) => r({ code, signal })));
  return { out, child, done, result: () => (fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null) };
}
/** Launch all workers, wait until every one has loaded its modules, and only then let them go together. */
async function runTogether(jobs) {
  const startAt = Date.now() + 15000;
  const ws = jobs.map(([a, p]) => launch(a, p, startAt));
  const t = Date.now();
  while (!ws.every((w) => fs.existsSync(`${w.out}.ready`)) && Date.now() - t < 14000) await sleep(50);
  const ready = ws.filter((w) => fs.existsSync(`${w.out}.ready`)).length;
  await Promise.all(ws.map((w) => w.done));
  const results = ws.map((w) => w.result());
  const got = results.filter(Boolean);
  const overlap = got.length > 1 && Math.max(...got.map((r) => r.t0)) < Math.min(...got.map((r) => r.t1));
  return { results, ready, overlap, pids: new Set(got.map((r) => r.pid)).size };
}
const one = async (action, params) => (await runTogether([[action, params]])).results[0];
const deliver = (type, object, opts = {}) => ["deliver", { type, object, subs: opts.subs, id: opts.id ?? rid("evt"), created: opts.created ?? Math.floor(Date.now() / 1000) }];

// Known empty Founders pilot (harness-owned database).
await q("truncate founders.founders_audit_trail, founders.founders_processed_events, founders.founders_identity_signals, founders.founders_cost_reservations, founders.founders_cost_ledger, founders.founders_enrollments, founders.founders_eligibilities, founders.founders_offers cascade");
await q("update founders.founders_pilot_counter set total_ever_admitted = 0 where id = 'portfolio_cap'");
await q("insert into founders.founders_offers (id, company_id, merchant_context, deliverables, beta_terms_version, terms_hash) values ('offer_rreal_x','rreal','rreal-founders-beta','[]'::jsonb,'x-v1',$1)", [crypto.createHash("sha256").update("x").digest("hex")]);
await q("drop table if exists public.hw_stall; create table public.hw_stall(name text primary key)");
await q(`create or replace function public.hw_stall_fn() returns trigger language plpgsql as $$
  begin if exists (select 1 from public.hw_stall where name = tg_argv[0]) then perform pg_sleep(25); end if; return new; end $$`);
await q("grant select on public.hw_stall to founders_app, service_role");
await q("drop trigger if exists hw_stall_enr on founders.founders_enrollments; create trigger hw_stall_enr before insert on founders.founders_enrollments for each row execute function public.hw_stall_fn('enrollment')");
await q("drop trigger if exists hw_stall_sub on public.subscriptions; create trigger hw_stall_sub before insert on public.subscriptions for each row execute function public.hw_stall_fn('mirror')");

// ── X1: 8 processes, 8 different events for ONE subscription that has no mirror row yet (first-insert race).
{
  const u = await newUser("x1"); const s = sub(LEGACY); await bind(u, s.id, "legacy_monthly");
  const jobs = [100, 200, 300, 400, 500, 600, 700].map((t, i) => deliver("customer.subscription.updated", { ...s, status: i % 2 ? "past_due" : "active" }, { created: t }));
  jobs.push(deliver("customer.subscription.deleted", { ...s, status: "canceled" }, { created: 50 }));
  const r = await runTogether(jobs);
  const rows = await q("select status, last_event_created from public.subscriptions where stripe_subscription_id=$1", [s.id]);
  check("X1 8 workers ready, 8 distinct processes, executions overlap", r.ready === 8 && r.pids === 8 && r.overlap, JSON.stringify({ ready: r.ready, pids: r.pids, overlap: r.overlap }));
  check("X1 every delivery answered 200", r.results.every((x) => x?.status === 200), JSON.stringify(r.results.map((x) => x?.status)));
  check("X1 exactly one mirror row, terminal cancel won", rows.length === 1 && rows[0].status === "canceled", JSON.stringify(rows));
  // X1b: a brand-new process delivering a newer 'active' cannot resurrect it (no in-process state involved).
  const late = await one(...deliver("customer.subscription.updated", { ...s, status: "active" }, { created: 9000 }));
  const after = await q("select status from public.subscriptions where stripe_subscription_id=$1", [s.id]);
  check("X1b new process cannot resurrect canceled", late?.status === 200 && after[0].status === "canceled", JSON.stringify({ late, after }));
}

// ── X2: Founders cap through the app wiring: 4 admitted, then 8 simultaneous qualifications → exactly 5 ever.
{
  for (let i = 0; i < 4; i++) { const r = await one("qualify", { accountId: await newUser("x2a") }); if (!r?.ok) check("X2 setup admit", false, JSON.stringify(r)); }
  const admittedBefore = Number((await q("select total_ever_admitted n from founders.founders_pilot_counter where id='portfolio_cap'"))[0].n);
  const ids = []; for (let i = 0; i < 8; i++) ids.push(await newUser("x2b"));
  const r = await runTogether(ids.map((accountId) => ["qualify", { accountId }]));
  const okCount = r.results.filter((x) => x?.ok === true).length;
  const counter = Number((await q("select total_ever_admitted n from founders.founders_pilot_counter where id='portfolio_cap'"))[0].n);
  const elig = Number((await q("select count(*) n from founders.founders_eligibilities where eligibility_status in ('eligible','enrolled')"))[0].n);
  check("X2 four were admitted first (non-vacuous)", admittedBefore === 4, String(admittedBefore));
  check("X2 8 processes overlapped", r.ready === 8 && r.pids === 8 && r.overlap, JSON.stringify({ ready: r.ready, pids: r.pids, overlap: r.overlap }));
  check("X2 exactly one of eight admitted", okCount === 1, JSON.stringify(r.results));
  check("X2 exactly five ever", counter === 5 && elig === 5, JSON.stringify({ counter, elig }));
}

// The pilot is now full (5 ever). Use one admitted, not-yet-enrolled account for the Founders event tests.
const founderAccounts = (await q("select immutable_account_id id from founders.founders_eligibilities where eligibility_status='eligible' order by created_at")).map((r) => r.id);

// ── X3: same Founders event delivered by 6 processes at once → one enrollment, one audit row, one mirror row.
{
  const u = founderAccounts[0]; const s = sub(FOUNDERS); await bind(u, s.id, "founders");
  const evt = rid("evt");
  const r = await runTogether(Array.from({ length: 6 }, () => deliver("customer.subscription.created", s, { id: evt, created: 1000 })));
  const enr = await q("select provider_subscription_id from founders.founders_enrollments where immutable_account_id=$1", [u]);
  const audit = await q("select count(*) n from founders.founders_audit_trail where event_id=$1", [evt]);
  const mirror = await q("select status from public.subscriptions where stripe_subscription_id=$1", [s.id]);
  const ev = await q("select status from public.webhook_events where id=$1", [evt]);
  check("X3 6 processes overlapped", r.ready === 6 && r.pids === 6 && r.overlap, JSON.stringify({ ready: r.ready, pids: r.pids, overlap: r.overlap }));
  check("X3 no delivery reported a false failure state (200 or retryable 500 only)", r.results.every((x) => x?.status === 200 || x?.status === 500), JSON.stringify(r.results.map((x) => x?.status)));
  check("X3 at least one delivery succeeded", r.results.some((x) => x?.status === 200));
  check("X3 exactly one enrollment + one audit entry + one active mirror row; event processed",
    enr.length === 1 && enr[0].provider_subscription_id === s.id && Number(audit[0].n) === 1 && mirror.length === 1 && mirror[0].status === "active" && ev[0]?.status === "processed",
    JSON.stringify({ enr, audit, mirror, ev }));
}

/** Kill a worker (SIGKILL, whole process group) once a backend is observed inside the stall, then end that backend. */
async function killInStall(job, stallName) {
  await q("insert into public.hw_stall values ($1) on conflict do nothing", [stallName]);
  const w = launch(job[0], job[1], Date.now() + 9000);
  let reached = false;
  for (let i = 0; i < 400 && !reached; i++) {
    reached = (await q("select 1 from pg_stat_activity where wait_event = 'PgSleep' and datname = current_database()")).length > 0;
    if (!reached) await sleep(100);
  }
  let killed = false;
  if (reached) { try { process.kill(-w.child.pid, "SIGKILL"); killed = true; } catch { /* already gone */ } }
  const exit = await w.done;
  await q("delete from public.hw_stall where name = $1", [stallName]);
  await q("select pg_terminate_backend(pid) from pg_stat_activity where wait_event = 'PgSleep' and datname = current_database()");
  await sleep(500);
  return { reached, killed, exit, wroteResult: !!w.result() };
}

// ── X4: SIGKILL while the Founders engine transaction is open (before anything committed) → retry converges once.
{
  const u = founderAccounts[1]; const s = sub(FOUNDERS); await bind(u, s.id, "founders");
  const evt = rid("evt"); const job = deliver("customer.subscription.created", s, { id: evt, created: 2000 });
  const k = await killInStall(job, "enrollment");
  const mid = { enr: (await q("select 1 from founders.founders_enrollments where immutable_account_id=$1", [u])).length, mirror: (await q("select 1 from public.subscriptions where stripe_subscription_id=$1", [s.id])).length, ev: (await q("select status from public.webhook_events where id=$1", [evt]))[0]?.status };
  check("X4 fault window reached and worker SIGKILLed before it could answer", k.reached && k.killed && !k.wroteResult && k.exit.signal === "SIGKILL", JSON.stringify(k));
  check("X4 after the crash: nothing granted, event still retryable", mid.enr === 0 && mid.mirror === 0 && mid.ev === "processing", JSON.stringify(mid));
  const retry = await one(...job);
  const fin = { enr: (await q("select 1 from founders.founders_enrollments where immutable_account_id=$1", [u])).length, audit: Number((await q("select count(*) n from founders.founders_audit_trail where event_id=$1", [evt]))[0].n), mirror: await q("select status from public.subscriptions where stripe_subscription_id=$1", [s.id]), ev: (await q("select status, attempts from public.webhook_events where id=$1", [evt]))[0] };
  check("X4 provider retry converges exactly once", retry?.status === 200 && fin.enr === 1 && fin.audit === 1 && fin.mirror.length === 1 && fin.mirror[0].status === "active" && fin.ev.status === "processed" && fin.ev.attempts === 2, JSON.stringify({ retry, fin }));
}

// ── X5: SIGKILL after the engine committed but while the membership mirror write is in flight → retry converges once.
{
  const u = founderAccounts[2]; const s = sub(FOUNDERS); await bind(u, s.id, "founders");
  const evt = rid("evt"); const job = deliver("customer.subscription.created", s, { id: evt, created: 3000 });
  const k = await killInStall(job, "mirror");
  const mid = { enr: (await q("select 1 from founders.founders_enrollments where immutable_account_id=$1", [u])).length, mirror: (await q("select 1 from public.subscriptions where stripe_subscription_id=$1", [s.id])).length, ev: (await q("select status from public.webhook_events where id=$1", [evt]))[0]?.status };
  check("X5 fault window reached and worker SIGKILLed", k.reached && k.killed && !k.wroteResult && k.exit.signal === "SIGKILL", JSON.stringify(k));
  check("X5 split state after the crash is the recoverable one: enrolled, mirror missing, event NOT complete", mid.enr === 1 && mid.mirror === 0 && mid.ev === "processing", JSON.stringify(mid));
  const retry = await one(...job);
  const fin = { enr: (await q("select 1 from founders.founders_enrollments where immutable_account_id=$1", [u])).length, audit: Number((await q("select count(*) n from founders.founders_audit_trail where event_id=$1", [evt]))[0].n), mirror: await q("select status from public.subscriptions where stripe_subscription_id=$1", [s.id]), ev: (await q("select status from public.webhook_events where id=$1", [evt]))[0] };
  check("X5 provider retry converges exactly once", retry?.status === 200 && fin.enr === 1 && fin.audit === 1 && fin.mirror.length === 1 && fin.mirror[0].status === "active" && fin.ev.status === "processed", JSON.stringify({ retry, fin }));
}

// ── X6: cancel vs renewal for the same Founders subscription at the same instant, equal timestamps → forfeited, canceled.
{
  const u = founderAccounts[0];
  const s = (await q("select provider_subscription_id id from founders.founders_enrollments where immutable_account_id=$1", [u]))[0];
  const base = sub(FOUNDERS, { id: s.id });
  const r = await runTogether([
    deliver("customer.subscription.updated", { ...base, status: "active" }, { created: 5000 }),
    deliver("customer.subscription.deleted", { ...base, status: "canceled" }, { created: 5000 }),
    deliver("customer.subscription.updated", { ...base, status: "active" }, { created: 5000 }),
    deliver("customer.subscription.updated", { ...base, status: "active" }, { created: 4999 }),
  ]);
  // Deliveries that lost a race may have answered 500 (retryable). Redeliver everything once, as the provider would.
  const mirror = await q("select status from public.subscriptions where stripe_subscription_id=$1", [s.id]);
  const elig = await q("select eligibility_status from founders.founders_eligibilities where immutable_account_id=$1", [u]);
  const enr = await q("select subscription_status from founders.founders_enrollments where immutable_account_id=$1", [u]);
  check("X6 4 processes overlapped", r.ready === 4 && r.pids === 4 && r.overlap, JSON.stringify({ ready: r.ready, pids: r.pids, overlap: r.overlap }));
  check("X6 cancellation wins the tie everywhere: mirror canceled, enrollment canceled, rate forfeited",
    mirror[0]?.status === "canceled" && enr[0]?.subscription_status === "canceled" && elig[0]?.eligibility_status === "forfeited",
    JSON.stringify({ mirror, enr, elig, statuses: r.results.map((x) => x?.status) }));
}

await q("drop trigger if exists hw_stall_enr on founders.founders_enrollments; drop trigger if exists hw_stall_sub on public.subscriptions; drop function if exists public.hw_stall_fn(); drop table if exists public.hw_stall");
console.log(`RESULT pass=${pass} fail=${fail}`);
await admin.end();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
