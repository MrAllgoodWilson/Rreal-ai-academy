"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { BYOK_PROVIDERS, getByok, setByok, type ByokProvider } from "@/lib/byok";

/** "Your AI accounts": members connect their own Claude / ChatGPT / ElevenLabs / Replicate accounts. */
export function AiAccounts() {
  const [saved, setSaved] = useState<Partial<Record<ByokProvider, string>>>({});
  const [draft, setDraft] = useState<Partial<Record<ByokProvider, string>>>({});
  const [status, setStatus] = useState("");

  useEffect(() => setSaved(getByok()), []);

  const save = (p: ByokProvider) => {
    setByok(p, draft[p] ?? "");
    setSaved(getByok());
    setDraft((d) => ({ ...d, [p]: "" }));
    setStatus(draft[p]?.trim() ? `${BYOK_PROVIDERS.find((x) => x.id === p)!.name} connected.` : "Removed.");
  };
  const remove = (p: ByokProvider) => {
    setByok(p, "");
    setSaved(getByok());
    setStatus(`${BYOK_PROVIDERS.find((x) => x.id === p)!.name} disconnected.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Your $1 membership includes every course plus our built-in AI. To build real projects with premium tools, connect <strong className="text-ink">your own</strong> accounts below, or buy credits.
        Keys are saved only in this browser and sent securely with each request. We never store them on our servers.
      </p>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      <ul className="space-y-3">
        {BYOK_PROVIDERS.map((p) => {
          const connected = Boolean(saved[p.id]);
          return (
            <li key={p.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-violet" aria-hidden="true" /> {p.name}</p>
                <span className={`chip text-xs ${connected ? "border-lime text-lime" : ""}`}>{connected ? `Connected ••••${saved[p.id]!.slice(-4)}` : "Not connected"}</span>
              </div>
              <p className="mt-1 text-sm text-muted">Unlocks: {p.unlocks}</p>
              <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save(p.id); }}>
                <label htmlFor={`byok-${p.id}`} className="sr-only">{p.name} API key</label>
                <input id={`byok-${p.id}`} type="password" autoComplete="off" spellCheck={false} className="input min-w-0 flex-1" placeholder={p.hint} value={draft[p.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))} />
                <button className="btn-primary min-h-[44px]" disabled={!draft[p.id]?.trim()}>Save</button>
                {connected && <button type="button" className="btn-ghost min-h-[44px]" onClick={() => remove(p.id)}>Disconnect</button>}
              </form>
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm text-neon underline-offset-4 hover:underline">
                Get your {p.name} key <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
