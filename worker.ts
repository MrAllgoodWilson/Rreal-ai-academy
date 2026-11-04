// Custom Worker entry: OpenNext's fetch handler + a daily Cron Trigger for friendly learner nudges.
// Built by `opennextjs-cloudflare build` (which creates .open-next/worker.js) and deployed by wrangler (main = worker.ts).
// @ts-expect-error -- generated at build time
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string };

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    if (!env.CRON_SECRET) return;
    const site = env.NEXT_PUBLIC_SITE_URL || "https://rrealaiacademy.app";
    const req = new Request(`${site}/api/cron/nudges`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};
