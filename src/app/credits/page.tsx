"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Film, Wand2 } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { CREDIT_PACKS } from "@/lib/credits";

interface Data { balances: Record<string, number>; packs: ((typeof CREDIT_PACKS)[number] & { buy: string })[] }

function Credits() {
  const [data, setData] = useState<Data | null>(null);
  const purchased = useSearchParams().get("purchase") === "success";
  useEffect(() => {
    const load = () => fetch("/api/credits", { cache: "no-store" }).then((r) => r.json()).then(setData).catch(() => {});
    load();
    // Credits land a few seconds after Stripe confirms payment.
    if (purchased) {
      const iv = setInterval(load, 3000);
      setTimeout(() => clearInterval(iv), 30000);
      return () => clearInterval(iv);
    }
  }, [purchased]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="Credits" title="Power-ups" subtitle="Your membership stays $1/month forever. Add credits only when you want extra AI power." />
      {purchased && <div className="mb-6"><FormAlert kind="success">Payment received! Your credits appear here within a few seconds.</FormAlert></div>}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4"><Film className="h-10 w-10 text-violet" aria-hidden="true" /><div><p className="font-display text-3xl font-bold">{data?.balances.video ?? "–"}</p><p className="text-muted">AI video credits <span className="text-xs">(+1 free render every month)</span></p></div></div>
        <div className="card flex items-center gap-4"><Wand2 className="h-10 w-10 text-neon" aria-hidden="true" /><div><p className="font-display text-3xl font-bold">{data?.balances.course ?? "–"}</p><p className="text-muted">Custom course credits</p></div></div>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {(data?.packs ?? CREDIT_PACKS.map((p) => ({ ...p, buy: p.url }))).map((p, i) => (
          <motion.li key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card flex flex-col">
            <p className="font-display text-4xl font-bold">{p.price}</p>
            <h2 className="mt-2 font-display text-lg font-semibold">{p.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted">{p.blurb}</p>
            <a href={p.buy} className={`mt-5 ${p.kind === "course" ? "btn-primary" : "btn-violet"}`}>Buy now</a>
          </motion.li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-muted">One-time purchases through Stripe. Credits never expire. If an AI render or course fails, the credit is returned automatically.</p>
    </div>
  );
}

export default function CreditsPage() {
  return <RequireMember><Suspense><Credits /></Suspense></RequireMember>;
}
