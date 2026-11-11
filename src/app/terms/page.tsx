import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Terms of Service" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 font-display text-2xl font-bold text-ink">{children}</h2>;

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Legal" title="Terms of Service" subtitle="Standard customer agreement, billing policies, and refund terms." />
      <div className="space-y-4 text-lg leading-relaxed text-muted">
        <H>Subscription & Billing</H>
        <p>Subscriptions renew automatically on a monthly basis until cancelled. Membership fees are billed in advance via Stripe. You can cancel anytime directly from Settings → Plan & billing. Cancellation takes effect at the end of the current paid billing cycle with no cancellation penalties.</p>

        <H>Refund Policy</H>
        <p>We want you to be completely satisfied with your learning experience. If you are not satisfied with your membership, you may request a full refund within 14 days of your initial monthly subscription charge by contacting <a className="text-neon underline" href="mailto:support@rrealaiacademy.app">support@rrealaiacademy.app</a>. Subsequent monthly subscription renewals are non-refundable once the billing period has commenced, but cancellation is effective immediately for future periods. One-time credit pack purchases (e.g., custom course creation and video credits) are non-refundable once credits have been utilized.</p>

        <H>Certification & Credentialing</H>
        <p>Rreal Certified credentials signify successful completion of Rreal AI Academy curriculum, hands-on playbooks, and assessment criteria. They represent certificates of completion and competency, not accredited academic degrees or government-issued professional licenses.</p>

        <H>Responsible AI Usage & Academic Integrity</H>
        <p>Learners agree to use all AI tools responsibly: no impersonation, harassment, copyright infringement, or generation of deceptive or harmful deepfakes. Academic integrity is strictly enforced; assessments and project submissions must reflect your own work. We reserve the right to revoke credentials obtained through dishonest or abusive means.</p>
      </div>
    </div>
  );
}
