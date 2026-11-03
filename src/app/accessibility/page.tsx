import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Accessibility statement" };

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Accessibility" title="Accessibility statement" subtitle="Rreal AI Academy is designed so that everyone — including blind, low-vision, deaf, hard-of-hearing, motor-impaired and neurodivergent learners — can learn AI." />
      <div className="space-y-8 text-lg leading-relaxed">
        <section><h2 className="mb-2 font-display text-2xl font-bold">Our target</h2><p>We design against the Web Content Accessibility Guidelines (WCAG) 2.1 Level AAA wherever technically feasible, and Level AA as a minimum across the whole product.</p></section>
        <section>
          <h2 className="mb-2 font-display text-2xl font-bold">What’s built in</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Semantic landmarks, headings and ARIA roles; a “Skip to main content” link; focus moves to new content on navigation.</li>
            <li>Every control works with a keyboard, with a clearly visible focus ring. Touch targets are at least 44×44 pixels.</li>
            <li>Live captions on all Coach voice interactions and read-aloud, plus full text transcripts.</li>
            <li>Visual flash alerts paired with every sound effect.</li>
            <li>Read-aloud for every lesson step, with adjustable voice speed.</li>
            <li>Voice input as an alternative to typing.</li>
            <li>High-contrast mode, light/dark themes, text scaling up to 150%, and readable spacing for dyslexia.</li>
            <li>Reduced-motion mode that disables animations and confetti (and we honour your operating-system setting automatically).</li>
            <li>Atkinson Hyperlegible, a typeface designed for low-vision readers.</li>
          </ul>
        </section>
        <section><h2 className="mb-2 font-display text-2xl font-bold">Known limitations</h2><p>Voice input relies on your browser’s speech recognition (Chrome, Edge and Safari today). Typing always works. Animated video previews in the Studio include a text description for screen readers.</p></section>
        <section><h2 className="mb-2 font-display text-2xl font-bold">Feedback</h2><p>If anything blocks you, email <a className="text-neon underline" href="mailto:accessibility@example.com">accessibility@example.com</a>. We aim to respond within 2 business days.</p></section>
      </div>
    </div>
  );
}
