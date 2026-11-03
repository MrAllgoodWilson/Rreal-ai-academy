import { NextResponse } from "next/server";
import { credentialCode, credentialTitle, verifyCertificate } from "@/lib/certificates/server";

/**
 * Open Badges 3.0 / W3C Verifiable Credential (JSON-LD) view of a Rreal credential,
 * so learners can import it into digital-badge wallets and employers' systems can read it.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  let v: ReturnType<typeof verifyCertificate>;
  try {
    v = verifyCertificate(token);
  } catch {
    return NextResponse.json({ error: "Verification unavailable" }, { status: 503 });
  }
  if (!v.valid) return NextResponse.json({ error: v.reason }, { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const p = v.payload;
  const name = credentialTitle(p.t, p.ti);
  return NextResponse.json(
    {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
      id: `${site}/verify/${encodeURIComponent(token)}`,
      type: ["VerifiableCredential", "OpenBadgeCredential"],
      issuer: { id: site, type: ["Profile"], name: "Rreal AI Academy", url: site },
      validFrom: p.i,
      name,
      credentialSubject: {
        type: ["AchievementSubject"],
        name: p.n,
        achievement: {
          id: `${site}/learn/${p.t}`,
          type: ["Achievement"],
          name,
          description: `Completed all lessons, graded labs and assessments of "${name}" at Rreal AI Academy.`,
          criteria: { narrative: "Complete every lesson, pass every quiz and graded prompt lab" + (p.t === "master" || p.t === "architect" ? ", and score 80%+ on the capstone exam." : ".") },
          ...(p.a ? { creditsAvailable: p.a.ceu, humanCode: p.a.id, fieldOfStudy: "Artificial Intelligence", otherIdentifier: [{ type: "IdentifierEntry", identifier: p.a.id ?? "", identifierType: "identifier" }] } : {}),
        },
        ...(p.s ? { result: [{ type: ["Result"], value: `${p.s}%` }] } : {}),
      },
      evidence: [{ type: ["Evidence"], id: `${site}/verify/${encodeURIComponent(token)}`, name: `Credential ${credentialCode(p)}` }],
      ...(p.a ? { endorsement: [{ type: ["EndorsementCredential"], issuer: { name: p.a.p }, name: `Accredited via ${p.a.b}` }] } : {}),
    },
    { headers: { "content-type": "application/ld+json", "cache-control": "public, max-age=300" } },
  );
}
