import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verifyUnsubscribe } from "@/lib/nudges";

export const dynamic = "force-dynamic";

const page = (title: string, msg: string) =>
  new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#070912;color:#f4f6ff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px">
<main style="max-width:480px;text-align:center"><h1>${title}</h1><p style="color:#d6dcf5;line-height:1.6">${msg}</p>
<p><a href="/settings" style="color:#22d3ee">Manage reminders in Settings</a></p></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

/** One-click unsubscribe from reminder emails (signed link, no login). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") || "";
  const t = url.searchParams.get("t") || "";
  if (!/^[0-9a-f-]{36}$/.test(u) || !verifyUnsubscribe(u, t)) return page("Link expired", "This unsubscribe link isn't valid. You can turn reminders off in Settings.");
  const admin = getSupabaseAdmin();
  if (!admin) return page("Try again later", "We couldn't update your preference right now.");
  await admin.rpc("set_nudges", { p_user: u, p_enabled: false });
  return page("You're unsubscribed", "You won't get reminder emails anymore. Your progress is saved whenever you come back.");
}
