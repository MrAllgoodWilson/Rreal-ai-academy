import "server-only";

/** Reads member-supplied keys (see src/lib/byok.ts). Values are format-checked and never logged or stored. */
export type Byok = { anthropic?: string; openai?: string; elevenlabs?: string; replicate?: string };

const FORMAT: Record<keyof Byok, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,200}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,200}$/,
  elevenlabs: /^(sk_)?[A-Za-z0-9]{20,100}$/,
  replicate: /^r8_[A-Za-z0-9]{20,100}$/,
};

export function readByok(req: Request): Byok {
  const out: Byok = {};
  for (const k of Object.keys(FORMAT) as (keyof Byok)[]) {
    const v = req.headers.get(`x-byok-${k}`)?.trim();
    if (v && FORMAT[k].test(v)) out[k] = v;
  }
  return out;
}

/** True when the member brings their own text-AI account (so no credit/quota is charged). */
export const ownsTextAi = (b: Byok) => Boolean(b.anthropic || b.openai);
