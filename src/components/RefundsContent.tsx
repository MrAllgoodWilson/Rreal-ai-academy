"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/lib/i18n";
import { REFUND_POLICY as P } from "@/lib/refund-policy";

type Section = { id: string; title: string; body: React.ReactNode };

/** The public refund policy in English and Spanish. The numbers always come from REFUND_POLICY. A Spanish speaker should proofread the Spanish before launch. */
export function RefundsContent() {
  const { lang } = useI18n();
  const es = lang === "es";
  const mail = <a className="underline" href={`mailto:${P.supportEmail}`}>{P.supportEmail}</a>;

  const sections: Section[] = es
    ? [
        { id: "cancel", title: "Cancela cuando quieras", body: <p>Puedes cancelar tu membresía en cualquier momento en <strong>Ajustes → Plan y facturación</strong>. Conservas el acceso hasta el final del período que ya pagaste y no se te vuelve a cobrar. No necesitas una cuenta del proveedor de pagos para suscribirte ni para cancelar.</p> },
        { id: "sub", title: "Membresía mensual", body: <p>Los cargos mensuales no se prorratean ni se reembolsan por el tiempo no usado. Como excepción de buena voluntad, si lo pides dentro de <strong>{P.firstChargeDays} días</strong> de tu <em>primer</em> cargo mensual, te reembolsamos ese cargo una sola vez por cuenta.</p> },
        { id: "pack", title: "Paquetes de créditos", body: <p>Puedes pedir el reembolso de un paquete de créditos dentro de <strong>{P.creditPackDays} días</strong> de la compra si no has usado los créditos. Los créditos ya usados no son reembolsables. Si se aprueba el reembolso, los créditos sin usar se quitan de tu saldo.</p> },
        { id: "always", title: "Siempre reembolsado", body: <p>Si te cobraron dos veces o por error, te reembolsamos el cargo extra o equivocado. Si la ley de tu lugar de residencia te da derecho a un reembolso o a un período de desistimiento, ese derecho se aplica y esta política nunca lo reduce.</p> },
        { id: "how", title: "Cómo pedirlo", body: <><p>Inicia sesión, ve a <Link href="/settings" className="underline">Ajustes</Link> y usa <strong>Solicitar un reembolso</strong>, o escribe a {mail}. Una persona lee cada solicitud y responde en {P.replyBusinessDays} días hábiles. Si se aprueba, el dinero suele llegar a tu método de pago original en {P.processingBusinessDays} días hábiles, según tu banco.</p><p>Por favor contáctanos antes de disputar un cargo con tu banco: normalmente lo resolvemos más rápido.</p></> },
      ]
    : [
        { id: "cancel", title: "Cancel anytime", body: <p>You can cancel your membership at any time in <strong>Settings → Plan &amp; billing</strong>. You keep access until the end of the period you already paid for, and you are not charged again. You do not need a payment-provider account to subscribe or to cancel.</p> },
        { id: "sub", title: "Monthly membership", body: <p>Monthly charges are not prorated or refunded for unused time. As a good-will exception, if you ask within <strong>{P.firstChargeDays} days</strong> of your <em>first</em> monthly charge, we will refund that charge once per account.</p> },
        { id: "pack", title: "Credit packs", body: <p>You can ask for a refund of a credit pack within <strong>{P.creditPackDays} days</strong> of buying it if you have not used the credits. Credits already used are not refundable. If a refund is approved, any unused credits are removed from your balance.</p> },
        { id: "always", title: "Always refunded", body: <p>If you were charged twice or by mistake, we refund the extra or mistaken charge. If the law where you live gives you a right to a refund or a withdrawal period, that right applies and this policy never reduces it.</p> },
        { id: "how", title: "How to ask", body: <><p>Sign in, go to <Link href="/settings" className="underline">Settings</Link> and use <strong>Request a refund</strong>, or email {mail}. A person reads every request and answers within {P.replyBusinessDays} business days. If approved, the money usually reaches your original payment method in {P.processingBusinessDays} business days, depending on your bank.</p><p>Please contact us before disputing a charge with your bank: we can usually fix it faster.</p></> },
      ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader eyebrow={es ? "Facturación" : "Billing"} title={es ? "Reembolsos y cancelación" : "Refunds and cancellation"} subtitle={es ? "Política en lenguaje sencillo. Última actualización: 2026-11-26." : "Plain-language policy. Last updated 2026-11-26."} />
      <div className="space-y-6 text-lg leading-relaxed text-muted">
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`${s.id}-h`} className="space-y-2">
            <h2 id={`${s.id}-h`} className="font-display text-xl font-semibold text-ink">{s.title}</h2>
            {s.body}
          </section>
        ))}
        <p className="text-sm">{es ? "Podemos rechazar solicitudes que abusen de esta política (por ejemplo, reembolsos repetidos después de usar el servicio). Esta página es un resumen en lenguaje sencillo; se aplican nuestros " : "We may decline requests that abuse this policy (for example repeated refunds after using the service). This page is a plain-language summary; our "}<Link href="/terms" className="underline">{es ? "Términos" : "Terms"}</Link>{es ? "." : " apply."}</p>
      </div>
    </div>
  );
}
