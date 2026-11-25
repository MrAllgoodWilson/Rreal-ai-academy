import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Privacy" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 font-display text-2xl font-bold text-ink">{children}</h2>;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Legal" title="Privacy policy (draft)" subtitle="Plain-English summary. Have a lawyer review it before large-scale launch." />
      <div className="space-y-4 text-lg leading-relaxed text-muted">
        <p>Questions or requests: <a className="text-neon underline" href="mailto:support@rrealaiacademy.app">support@rrealaiacademy.app</a>. We do not sell your data.</p>

        <H>What we collect</H>
        <p>Your name, email, username, learning progress, XP and streaks, certificates, and what you type into the Coach, Sandbox, course builder and image maker so those tools can respond. Payments are handled by Stripe; we never see your card number.</p>

        <H>Who processes it</H>
        <p>Cloudflare (hosting, built-in AI, speech, images and email), Supabase (database and sign-in) and Stripe (payments). Text you send to the built-in AI is processed on Cloudflare. If you connect your own Claude, ChatGPT, ElevenLabs or Replicate account, the content of the request is sent to that provider under your own account and its terms.</p>

        <H>Your own AI account keys</H>
        <p>Keys you add in Settings are saved only in your browser. Each time you use a feature, your browser sends the key to our server over HTTPS so the server can forward your request to your provider. We do not save, log or reuse these keys. Remove one any time with Disconnect. Clearing your browser data also removes them.</p>

        <H>Voice</H>
        <p>Microphone audio is turned into text by your browser&apos;s speech engine. We receive only the text, not your audio. Spoken replies are generated from text by Cloudflare or your own ElevenLabs account.</p>

        <H>Emails</H>
        <p>We send account emails (sign-up, password and username help) and, if you haven&apos;t turned them off, at most one friendly &ldquo;pick up where you left off&rdquo; reminder per week. Turn reminders off in Settings or with the link in any reminder.</p>

        <H>Certificates</H>
        <p>Your name, credential title, issue date and score are visible to anyone with your verification link. Rreal certificates are certificates of completion, not accredited academic credit.</p>

        <H>Sponsors</H>
        <p>Some courses and playbooks may show sponsor or partner links. We do not share your personal information with sponsors. If a link is an affiliate link, we may earn a commission at no cost to you.</p>

        <H>Your choices</H>
        <p>Export your data any time in Settings. Delete your account in Settings → Your data → Delete my account (cancel an active membership first). Deleting permanently removes your profile, progress, certificates, credits and private courses. Courses you published for everyone remain available without your account. You can also email us to ask for access, correction or deletion.</p>

        <H>Children</H>
        <p>Rreal AI Academy is for people 13 and older. If you are under 18, use it with a parent or guardian&apos;s permission.</p>
      </div>
    </div>
  );
}
