import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { REFUND_POLICY as P } from "@/lib/refund-policy";

export const metadata = { title: "Refunds and cancellation" };

export default function RefundsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow="Billing" title="Refunds and cancellation" subtitle="Plain-language policy. Last updated 2026-11-26." />
      <div className="space-y-6 text-lg leading-relaxed text-muted">
        <section aria-labelledby="cancel-h" className="space-y-2">
          <h2 id="cancel-h" className="font-display text-xl font-semibold text-ink">Cancel anytime</h2>
          <p>You can cancel your membership at any time in <strong>Settings → Plan &amp; billing</strong>. You keep access until the end of the period you already paid for, and you are not charged again. You do not need a payment-provider account to subscribe or to cancel.</p>
        </section>
        <section aria-labelledby="sub-h" className="space-y-2">
          <h2 id="sub-h" className="font-display text-xl font-semibold text-ink">Monthly membership</h2>
          <p>Monthly charges are not prorated or refunded for unused time. As a good-will exception, if you ask within <strong>{P.firstChargeDays} days</strong> of your <em>first</em> monthly charge, we will refund that charge once per account.</p>
        </section>
        <section aria-labelledby="pack-h" className="space-y-2">
          <h2 id="pack-h" className="font-display text-xl font-semibold text-ink">Credit packs</h2>
          <p>You can ask for a refund of a credit pack within <strong>{P.creditPackDays} days</strong> of buying it if you have not used the credits. Credits already used are not refundable. If a refund is approved, any unused credits are removed from your balance.</p>
        </section>
        <section aria-labelledby="always-h" className="space-y-2">
          <h2 id="always-h" className="font-display text-xl font-semibold text-ink">Always refunded</h2>
          <p>If you were charged twice or by mistake, we refund the extra or mistaken charge. If the law where you live gives you a right to a refund or a withdrawal period, that right applies and this policy never reduces it.</p>
        </section>
        <section aria-labelledby="how-h" className="space-y-2">
          <h2 id="how-h" className="font-display text-xl font-semibold text-ink">How to ask</h2>
          <p>Sign in, go to <Link href="/settings" className="underline">Settings</Link> and use <strong>Request a refund</strong>, or email <a className="underline" href={`mailto:${P.supportEmail}`}>{P.supportEmail}</a>. A person reads every request and answers within {P.replyBusinessDays} business days. If approved, the money usually reaches your original payment method in {P.processingBusinessDays} business days, depending on your bank.</p>
          <p>Please contact us before disputing a charge with your bank: we can usually fix it faster.</p>
        </section>
        <p className="text-sm">We may decline requests that abuse this policy (for example repeated refunds after using the service). This page is a plain-language summary; our <Link href="/terms" className="underline">Terms</Link> apply.</p>
      </div>
    </div>
  );
}
