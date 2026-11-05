import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { projectWalletEnabled } from "@/lib/project-wallet-policy";
export async function GET() {
  const who = await getMember();
  if ("error" in who) return who.error;
  if (!projectWalletEnabled() || who.demo) return NextResponse.json({ error: "Project wallet is not available yet.", code: "unavailable" }, { status: 503 });
  const { data, error } = await who.member.sb.from("project_wallet_accounts").select("funding_kind,available_credits,reserved_credits").eq("user_id", who.member.user.id);
  if (error) return NextResponse.json({ error: "Could not confirm your project balance." }, { status: 503 });
  return NextResponse.json({ featureAllowances: (data ?? []).map((b) => ({ source: b.funding_kind, availableUnits: b.available_credits, reservedUnits: b.reserved_credits })) }, { headers: { "cache-control": "private, no-store" } });
}
