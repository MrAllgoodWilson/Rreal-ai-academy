"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Link2, Loader2, Plug, RefreshCw, Send, Trash2, Zap } from "lucide-react";
import { RequireMember } from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/AuthCard";
import { useA11y } from "@/lib/a11y";

const PLATFORMS = [
  ["tiktok", "TikTok"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"], ["twitter", "X (Twitter)"], ["threads", "Threads"], ["pinterest", "Pinterest"],
] as const;

const PLUGIN_KINDS = [
  { id: "zapier", name: "Zapier", help: "In Zapier: create a Zap → Trigger \"Webhooks by Zapier\" → Catch Hook → copy the URL (hooks.zapier.com/…)." },
  { id: "make", name: "Make", help: "In Make: add a \"Custom webhook\" module → copy the URL (hook.<region>.make.com/…)." },
  { id: "slack", name: "Slack", help: "In Slack: create an Incoming Webhook for a channel → copy the URL (hooks.slack.com/…)." },
  { id: "discord", name: "Discord", help: "In Discord: Channel settings → Integrations → Webhooks → New → copy URL." },
  { id: "webhook", name: "Custom webhook", help: "Any https endpoint you control. We POST JSON: { event, data, sent_at }." },
] as const;

const EVENTS = [
  ["lesson.completed", "Lesson completed"], ["certificate.issued", "Certificate issued"], ["video.rendered", "AI video rendered"], ["course.created", "Custom course created"],
] as const;

const TOOLS = [
  ["Claude", "https://claude.ai"], ["ChatGPT", "https://chatgpt.com"], ["ElevenLabs", "https://elevenlabs.io"], ["Canva", "https://www.canva.com"],
  ["CapCut", "https://www.capcut.com"], ["Adobe Express", "https://www.adobe.com/express"], ["Runway", "https://runwayml.com"], ["GitHub", "https://github.com"], ["Vercel", "https://vercel.com"], ["Zapier", "https://zapier.com"],
] as const;

interface PluginRow { id: string; kind: string; url: string; events: string[]; enabled: boolean }

function Connections() {
  const { announce } = useA11y();
  const [social, setSocial] = useState<{ configured: boolean; platforms: string[] } | null>(null);
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [post, setPost] = useState({ text: "", media: "", when: "", platforms: [] as string[] });
  const [posting, setPosting] = useState(false);
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [newPlugin, setNewPlugin] = useState({ kind: "zapier", url: "", events: ["lesson.completed", "certificate.issued"] as string[] });

  const loadSocial = useCallback(() => fetch("/api/social", { cache: "no-store" }).then((r) => r.json()).then(setSocial).catch(() => setSocial({ configured: false, platforms: [] })), []);
  const loadPlugins = useCallback(() => fetch("/api/plugins", { cache: "no-store" }).then((r) => r.json()).then((j) => setPlugins(j.plugins ?? [])).catch(() => {}), []);
  useEffect(() => {
    loadSocial();
    loadPlugins();
  }, [loadSocial, loadPlugins]);

  const link = async () => {
    setLinking(true);
    setMsg(null);
    const r = await fetch("/api/social/link", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setLinking(false);
    if (j.url) window.open(j.url, "_blank", "noopener");
    else setMsg({ kind: "error", text: j.error ?? "Couldn't open the connection page." });
  };

  const send = async () => {
    setPosting(true);
    setMsg(null);
    const r = await fetch("/api/social/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ post: post.text, platforms: post.platforms, mediaUrl: post.media || undefined, scheduleDate: post.when ? new Date(post.when).toISOString() : undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setPosting(false);
    if (r.ok) {
      setMsg({ kind: "success", text: post.when ? "Scheduled! 🎉" : "Posted! 🎉" });
      announce(post.when ? "Post scheduled." : "Post published.");
      setPost({ text: "", media: "", when: "", platforms: post.platforms });
    } else setMsg({ kind: "error", text: j.error ?? "Posting failed." });
  };

  const addPlugin = async () => {
    setMsg(null);
    const r = await fetch("/api/plugins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newPlugin) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setNewPlugin({ ...newPlugin, url: "" });
      loadPlugins();
      setMsg({ kind: "success", text: "Plugin connected." });
    } else setMsg({ kind: "error", text: j.error ?? "Couldn't add plugin." });
  };

  const linked = social?.platforms ?? [];
  const help = PLUGIN_KINDS.find((k) => k.id === newPlugin.kind)?.help;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Connections & Plugins" title="Connect your world" subtitle="Link your social accounts to publish straight from Rreal, and plug your learning into Zapier, Make, Slack, Discord and more." />
      {msg && <div className="mb-6"><FormAlert kind={msg.kind}>{msg.text}</FormAlert></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-5" aria-labelledby="social-h">
          <div className="flex items-center justify-between gap-3">
            <h2 id="social-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Link2 className="h-5 w-5 text-neon" aria-hidden="true" /> Social accounts</h2>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-line" onClick={loadSocial} aria-label="Refresh connected accounts"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          {social === null ? (
            <p className="text-muted" role="status">Checking connections…</p>
          ) : !social.configured ? (
            <FormAlert kind="error">Social connections are being set up by the Rreal team. Check back soon.</FormAlert>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(([id, name]) => (
                  <li key={id} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${linked.includes(id) ? "border-lime/60" : "border-line text-muted"}`}>
                    {name} <span className={linked.includes(id) ? "text-lime" : ""}>{linked.includes(id) ? "Connected" : "—"}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-primary" onClick={link} disabled={linking}>
                {linking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />} {linked.length ? "Manage connected accounts" : "Connect social accounts"}
              </button>
              <p className="text-xs text-muted">You&apos;ll sign in to each platform on a secure page. We never see your passwords. Come back and press refresh when done.</p>
            </>
          )}
        </section>

        <section className="card space-y-4" aria-labelledby="compose-h">
          <h2 id="compose-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Send className="h-5 w-5 text-neon" aria-hidden="true" /> Post or schedule</h2>
          <div>
            <label htmlFor="post-text" className="label">Caption</label>
            <textarea id="post-text" rows={4} maxLength={2200} className="input" value={post.text} onChange={(e) => setPost({ ...post, text: e.target.value })} placeholder="Write your caption… #hashtags" />
          </div>
          <div>
            <label htmlFor="post-media" className="label">Video or image URL (optional — e.g. your AI render)</label>
            <input id="post-media" type="url" className="input" value={post.media} onChange={(e) => setPost({ ...post, media: e.target.value })} placeholder="https://…" />
          </div>
          <fieldset>
            <legend className="label">Platforms</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.filter(([id]) => linked.includes(id)).map(([id, name]) => (
                <label key={id} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 ${post.platforms.includes(id) ? "border-neon bg-neon/10" : "border-line"}`}>
                  <input type="checkbox" className="accent-[rgb(var(--neon))]" checked={post.platforms.includes(id)} onChange={(e) => setPost({ ...post, platforms: e.target.checked ? [...post.platforms, id] : post.platforms.filter((p) => p !== id) })} /> {name}
                </label>
              ))}
              {linked.length === 0 && <p className="text-sm text-muted">Connect an account first.</p>}
            </div>
          </fieldset>
          <div>
            <label htmlFor="post-when" className="label flex items-center gap-2"><CalendarClock className="h-4 w-4" aria-hidden="true" /> Schedule for later (optional)</label>
            <input id="post-when" type="datetime-local" className="input" value={post.when} onChange={(e) => setPost({ ...post, when: e.target.value })} />
          </div>
          <button type="button" className="btn-primary" onClick={send} disabled={posting || !post.text.trim() || post.platforms.length === 0}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} {post.when ? "Schedule post" : "Post now"}
          </button>
          <p className="text-xs text-muted">Tip: platforms require an AI-content label for realistic AI video. TikTok and Instagram need a video/image for most posts.</p>
        </section>

        <section className="card space-y-4 lg:col-span-2" aria-labelledby="plugins-h">
          <h2 id="plugins-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Plug className="h-5 w-5 text-violet" aria-hidden="true" /> Plugins</h2>
          <p className="text-muted">Send your learning events to other apps — e.g. post to your Discord when you earn a certificate, or log lessons to a Google Sheet through Zapier.</p>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div>
              <label htmlFor="pl-kind" className="label">Plugin</label>
              <select id="pl-kind" className="input" value={newPlugin.kind} onChange={(e) => setNewPlugin({ ...newPlugin, kind: e.target.value })}>
                {PLUGIN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pl-url" className="label">Webhook URL</label>
              <input id="pl-url" type="url" className="input" value={newPlugin.url} onChange={(e) => setNewPlugin({ ...newPlugin, url: e.target.value })} placeholder="https://…" aria-describedby="pl-help" />
              <p id="pl-help" className="mt-1 text-xs text-muted">{help}</p>
            </div>
          </div>
          <fieldset>
            <legend className="label">Send these events</legend>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(([id, name]) => (
                <label key={id} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 ${newPlugin.events.includes(id) ? "border-violet bg-violet/10" : "border-line"}`}>
                  <input type="checkbox" className="accent-[rgb(var(--violet))]" checked={newPlugin.events.includes(id)} onChange={(e) => setNewPlugin({ ...newPlugin, events: e.target.checked ? [...newPlugin.events, id] : newPlugin.events.filter((x) => x !== id) })} /> {name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-violet" onClick={addPlugin} disabled={!newPlugin.url || newPlugin.events.length === 0}><Plug className="h-4 w-4" aria-hidden="true" /> Add plugin</button>
            {plugins.length > 0 && (
              <button type="button" className="btn-ghost" onClick={async () => { await fetch("/api/plugins/test", { method: "POST" }); setMsg({ kind: "success", text: "Test event sent to your plugins." }); }}>
                <Zap className="h-4 w-4" aria-hidden="true" /> Send test event
              </button>
            )}
          </div>
          {plugins.length > 0 && (
            <ul className="space-y-2" aria-label="Connected plugins">
              {plugins.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <span><strong className="capitalize">{p.kind}</strong> <span className="text-sm text-muted">{p.url}</span><span className="block text-xs text-muted">{p.events.join(", ")}</span></span>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-danger" aria-label={`Remove ${p.kind} plugin`} onClick={async () => { await fetch(`/api/plugins?id=${p.id}`, { method: "DELETE" }); loadPlugins(); }}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2" aria-labelledby="tools-h">
          <h2 id="tools-h" className="font-display text-xl font-semibold">Your AI toolbox</h2>
          <p className="mt-1 text-muted">Quick links to the tools our courses and playbooks use. Built-in: calendar export (.ics) from the Studio.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {TOOLS.map(([name, url]) => (
              <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" className="chip min-h-[40px] px-4">{name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in new tab)</span></a></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return <RequireMember><Connections /></RequireMember>;
}
