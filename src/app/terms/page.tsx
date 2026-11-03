import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Legal" title="Terms of service (draft)" subtitle="Placeholder — have a lawyer finalize this before launch." />
      <div className="space-y-4 text-lg leading-relaxed text-muted">
        <p>Subscriptions renew automatically until cancelled. Free trials convert to paid plans unless cancelled before the trial ends. You can cancel anytime from Settings.</p>
        <p>Rreal Certified credentials certify completion of Rreal AI Academy coursework and assessments. They are not a government license or a degree.</p>
        <p>Use AI responsibly: no impersonation, harassment, or misleading deepfakes. We may revoke credentials obtained by cheating.</p>
      </div>
    </div>
  );
}
