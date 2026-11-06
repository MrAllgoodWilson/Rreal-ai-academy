import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { PARTNER_PROGRAMS, approvedAffiliateUrl, officialProgramUrl } from "@/lib/partners";

/** Public, read-only program information. No application or account is created here. */
export default function PartnersPage() {
  const approved = PARTNER_PROGRAMS.filter((p) => approvedAffiliateUrl(p)).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Tools and community" title="Explore learning resources and partner programs" />
      <section className="card mb-8 max-w-4xl" aria-labelledby="partner-disclosure">
        <h2 id="partner-disclosure" className="font-display text-xl font-semibold">Clear information before you leave</h2>
        <p className="mt-3 text-muted">These are researched prospects, not a list of companies that sponsor or endorse Rreal AI Academy. An official program information link does not mean we have applied or been approved.</p>
        <p className="mt-3 text-muted">If a program approves us and supplies a referral link, that link will be labeled. We may receive a commission for a qualifying purchase. Tool subscriptions and project costs are separate from your Academy membership. You can take published Academy courses without buying these tools.</p>
        <p className="mt-3 text-sm text-muted">{approved === 0 ? "No commission-earning referral links are active in this directory." : `${approved} program${approved === 1 ? " has" : "s have"} a reviewed referral link.`} We do not collect click activity on this page. External sites have their own privacy policies and terms.</p>
        <Link href="/learn" className="btn-ghost mt-4 inline-flex min-h-[44px] max-w-full items-center whitespace-normal break-words text-left">Return to learning</Link>
      </section>
      <ul className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2" aria-label="Researched programs">
        {PARTNER_PROGRAMS.map((program) => {
          const affiliate = approvedAffiliateUrl(program);
          const official = officialProgramUrl(program);
          return (
            <li key={program.id} className="card flex min-w-0 flex-col items-start">
              <h2 className="font-display text-xl font-semibold">{program.name}</h2>
              <p className="mt-2 text-muted">{program.description}</p>
              <p className="mt-3 text-sm text-muted">{program.status === "prospect" ? "Research only" : program.status === "applied" ? "Application pending" : "Program approved"} · Reviewed {program.lastReviewed}</p>
              <p className="mt-2 text-sm text-muted">{program.applicationNote}</p>
              {affiliate ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-muted">Affiliate link: we may earn a commission on a qualifying purchase.</p>
                  <a href={affiliate} rel="sponsored noopener noreferrer" referrerPolicy="no-referrer" className="btn-primary inline-flex min-h-[44px] max-w-full items-center whitespace-normal break-words text-left">Visit {program.name} through our referral link</a>
                </div>
              ) : official ? (
                <a href={official} rel="noopener noreferrer" referrerPolicy="no-referrer" className="btn-ghost mt-4 inline-flex min-h-[44px] max-w-full items-center whitespace-normal break-words text-left">Official {program.name} program information</a>
              ) : <p className="mt-4 text-sm text-muted">Program information is temporarily unavailable.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
