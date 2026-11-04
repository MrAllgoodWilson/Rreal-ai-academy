import { NextResponse } from "next/server";
import { getMember } from "@/lib/server-auth";
import { CREDIT_PACKS, buyUrl } from "@/lib/credits";

export const dynamic = "force-dynamic";

/** Credit balances + personalised purchase links. */
export async function GET() {
  const who = await getMember();
  if ("error" in who) return who.error;
  if (who.demo) return NextResponse.json({ balances: { video: 0, course: 0 }, packs: CREDIT_PACKS.map((p) => ({ ...p, buy: p.url })), demo: true });
  const { data } = await who.member.sb.from("credit_balances").select("kind, balance");
  const balances = { video: 0, course: 0 } as Record<string, number>;
  for (const r of data ?? []) balances[r.kind] = r.balance;
  return NextResponse.json({ balances, packs: CREDIT_PACKS.map((p) => ({ ...p, buy: buyUrl(p, who.member.user.id, who.member.user.email) })) });
}
