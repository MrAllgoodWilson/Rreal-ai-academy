"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { PromptLab } from "@/components/PromptLab";

const TEMPLATES = [
  { label: "Blank", text: "" },
  { label: "Email reply", text: "You are my executive assistant. Write a friendly reply to the email below declining the meeting but proposing two alternative times next week. Keep it under 90 words, warm but professional.\n\nEmail:\n\"Hi! Can we meet Thursday at 3pm to review the Q3 plan?\"" },
  { label: "Video hooks", text: "You are a viral short-form video strategist. Write 10 hooks for a 30-second TikTok about meal-prepping on a budget, for busy college students. Use the curiosity-gap, result-first and contrarian formulas. Max 12 words each, numbered list." },
  { label: "JSON extraction", text: "Extract the following fields from the customer email below and return ONLY valid JSON matching this schema: {\"name\": string, \"email\": string, \"intent\": \"buy\" | \"support\" | \"other\"}. Do not add commentary.\n\nEmail: \"Hi, I'm Dana (dana@shop.co). My order arrived broken, can you help?\"" },
  { label: "Agent system prompt", text: "You are a customer-support agent for an online store. You have tools: lookup_order(order_id), issue_refund(order_id, amount), escalate_to_human(reason). Rules: always look up the order first; refunds over $100 must be escalated; never reveal internal notes. Respond in under 80 words, friendly tone." },
];

function Sandbox() {
  const [tpl, setTpl] = useState(0);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Prompt Sandbox" title="Experiment freely" subtitle="Write a prompt, watch your Prompt Quality Score update live, then run it. No setup, no API keys, no installs." />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Starter templates">
        {TEMPLATES.map((t, i) => (
          <button key={t.label} type="button" onClick={() => setTpl(i)} aria-pressed={tpl === i} className={`chip min-h-[40px] px-4 text-sm ${tpl === i ? "border-neon text-ink" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card">
        <PromptLab key={tpl} starter={TEMPLATES[tpl].text} saveTitle={`Sandbox: ${TEMPLATES[tpl].label}`} />
      </div>
    </div>
  );
}

export default function SandboxPage() {
  return <RequireAuth><Sandbox /></RequireAuth>;
}
