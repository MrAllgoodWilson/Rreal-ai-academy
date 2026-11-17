import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Legal" title="Terms of service (draft)" subtitle="Placeholder — have a lawyer finalize this before launch." />
      <div className="space-y-4 text-lg leading-relaxed text-muted">
        <p>Rreal AI Academy is free to use: there is no membership fee and no card is needed. Fair-use limits apply to AI features. Optional paid power-ups (credits) are never needed to learn or earn certificates. If you have a paid membership from before the Academy became free, it renews automatically until you cancel it; you can cancel anytime from Settings.</p>
        <p>Rreal Certified credentials certify completion of Rreal AI Academy coursework and assessments. They are not a government license or a degree.</p>
        <p>Use AI responsibly: no impersonation, harassment, or misleading deepfakes. We may revoke credentials obtained by cheating.</p>
      </div>
    </div>
  );
}
