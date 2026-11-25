import { NextResponse } from "next/server";
import { serverFlags } from "@/lib/config";

export const dynamic = "force-dynamic";

async function bindings() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const e = env as unknown as Record<string, unknown>;
    return { workersAi: Boolean(e.AI), cloudflareEmail: Boolean(e.EMAIL) };
  } catch {
    return { workersAi: false, cloudflareEmail: false };
  }
}

export async function GET() {
  const flags = serverFlags();
  const b = await bindings();
  const ai = flags.claude ? "claude" : b.workersAi ? (process.env.AI_GATEWAY_ID && process.env.AI_GATEWAY_MODEL ? "cloudflare-gateway" : "cloudflare") : "offline";
  return NextResponse.json({
    ok: true,
    demo: !process.env.NEXT_PUBLIC_SUPABASE_URL,
    integrations: { ...flags, ...b },
    active: { ai, voice: flags.elevenlabs ? "elevenlabs" : b.workersAi ? "cloudflare" : "device", email: flags.resend ? "resend" : b.cloudflareEmail ? "cloudflare" : "off" },
    time: new Date().toISOString(),
  });
}
