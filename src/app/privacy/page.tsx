import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Legal" title="Privacy policy (draft)" subtitle="Placeholder — have a lawyer finalize this before launch." />
      <div className="space-y-4 text-lg leading-relaxed text-muted">
        <p>We collect your name, email, username, learning progress and the content you create in labs so we can run your account, issue certificates and improve the academy.</p>
        <p>Voice: microphone audio is processed by your browser’s speech engine to create text. We send the text — not your audio — to our AI coach. We do not sell your data.</p>
        <p>Certificates: your name, credential title, issue date and score are visible to anyone with your verification link.</p>
        <p>You can export or delete your data anytime from Settings, or by emailing privacy@example.com.</p>
      </div>
    </div>
  );
}
