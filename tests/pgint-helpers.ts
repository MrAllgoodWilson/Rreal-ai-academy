/**
 * Helpers for the real-Postgres route proofs (tests/*.pgint.ts, run with vitest.pgint.config.mts).
 *
 * What is REAL here: Postgres 17, the app's SQL migrations, PostgREST, supabase-js, the Stripe SDK's webhook
 * signature verification, the Founders library on its Postgres store, and the Next route handlers themselves.
 * What is SIMULATED: Stripe itself (events are built and signed locally; the API client is a fixture) and auth
 * (a locally signed JWT stands in for a Supabase session). Nothing here talks to Stripe or to any hosted project.
 */
import crypto from "node:crypto";
import http from "node:http";
import { Pool } from "pg";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`pgint: missing env ${k} (run via the harness script; values are never printed)`);
  return v;
};

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...payload }));
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** Refuses to touch anything but the harness-owned disposable database (loopback URL + nonce marker). */
export async function assertDisposableTarget(pool: Pool): Promise<void> {
  const url = new URL(need("HW_PG_ADMIN_URL"));
  if (url.hostname !== "127.0.0.1") throw new Error("pgint: refusing non-loopback database");
  const { rows } = await pool.query("select nonce from public.hw_harness_marker limit 1");
  if (!rows[0] || rows[0].nonce !== need("HW_NONCE")) throw new Error("pgint: harness marker missing or wrong; refusing to run");
}

export const REST_PROXY_PORT = Number(process.env.HW_REST_PROXY_PORT || 0);

/** supabase-js calls `${url}/rest/v1/...`; PostgREST serves at `/`. This in-process proxy strips the prefix. */
export async function startRestProxy(upstream: string): Promise<{ url: string; close: () => Promise<void> }> {
  const target = new URL(upstream);
  const server = http.createServer((req, res) => {
    const path = (req.url || "/").replace(/^\/rest\/v1/, "") || "/";
    const fwd = http.request({ hostname: target.hostname, port: target.port, path, method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    });
    fwd.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(fwd);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  return { url: `http://127.0.0.1:${addr.port}`, close: () => new Promise((r) => server.close(() => r())) };
}

export function userClient(restUrl: string, user: { id: string; email: string }): SupabaseClient {
  const secret = need("HW_JWT_SECRET");
  const anon = signJwt({ role: "anon" }, secret);
  const token = signJwt({ role: "authenticated", sub: user.id }, secret);
  const c = createClient(restUrl, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  (c.auth as unknown as { getUser: unknown }).getUser = async () => ({ data: { user: { id: user.id, email: user.email, created_at: new Date().toISOString() } }, error: null });
  return c;
}

export async function createUser(pool: Pool, tag: string): Promise<{ id: string; email: string }> {
  const r = crypto.randomBytes(5).toString("hex");
  const email = `${tag}-${r}@pgint.test`;
  const { rows } = await pool.query("insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id", [email, { username: `${tag}${r}` }]);
  return { id: rows[0].id as string, email };
}

export const rid = (p: string) => `${p}_${crypto.randomBytes(8).toString("hex")}`;

export interface SubFixture {
  id: string; status: string; customer: string; cancel_at_period_end: boolean; current_period_end: number;
  metadata: Record<string, string>;
  items: { data: { price: { id: string; unit_amount: number; currency: string; recurring: { interval: string } } }[] };
}
export function subFixture(priceId: string, over: Partial<SubFixture> & { amount?: number } = {}): SubFixture {
  const { amount, ...rest } = over;
  return {
    id: rid("sub"), status: "active", customer: rid("cus"), cancel_at_period_end: false,
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { app: "rreal-ai-academy" },
    items: { data: [{ price: { id: priceId, unit_amount: amount ?? 499, currency: "usd", recurring: { interval: "month" } } }] },
    ...rest,
  };
}

/** Builds a Stripe-shaped event and signs it with the SDK's own test-header generator (real signature scheme). */
export function signedEvent(secret: string, type: string, object: unknown, opts: { id?: string; created?: number; livemode?: boolean } = {}): { id: string; request: Request } {
  const id = opts.id ?? rid("evt");
  const payload = JSON.stringify({ id, object: "event", type, livemode: opts.livemode ?? true, created: opts.created ?? Math.floor(Date.now() / 1000), data: { object } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { id, request: new Request("http://127.0.0.1/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload }) };
}

/** Fixture Stripe API client: records calls, serves subscriptions from a map. No network. */
export function fakeStripe() {
  const subs = new Map<string, SubFixture>();
  const calls = { retrieve: 0, create: 0, expire: 0 };
  const client = {
    subscriptions: { retrieve: async (id: string) => { calls.retrieve++; const s = subs.get(id); if (!s) throw new Error("No such subscription"); return s; } },
    checkout: { sessions: {
      create: async () => { calls.create++; const id = rid("cs_live"); return { id, url: `https://checkout.invalid/${id}` }; },
      expire: async () => { calls.expire++; return {}; },
    } },
  };
  return { client, subs, calls };
}
