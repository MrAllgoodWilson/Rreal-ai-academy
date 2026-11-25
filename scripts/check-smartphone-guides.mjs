// Official-source change detection only. Never publishes/replaces course instructions.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const allowed = new Set(['support.apple.com','www.apple.com','support.google.com','www.samsung.com']);
export async function checkGuides(sources, baseline = {}, fetcher = fetch) {
  const records = [];
  for (const source of sources) {
    const record = { id: source.id, url: source.url, state: 'needs_review' };
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || !allowed.has(url.hostname) || url.username || url.password) throw new Error('source_not_allowlisted');
      const res = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { accept: 'text/html' } });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('unexpected_content_type');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('empty_body');
      const hash = createHash('sha256'); let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 2_000_000) { await reader.cancel(); throw new Error('source_too_large'); }
          hash.update(value);
        }
      } finally { reader.releaseLock(); }
      if (!bytes) throw new Error('empty_body');
      const digest = hash.digest('hex');
      records.push({ ...record, state: baseline[source.id] === digest ? 'unchanged_snapshot' : baseline[source.id] ? 'changed_needs_review' : 'initial_review_required', digest, bytes });
    } catch (e) { records.push({ ...record, reason: e instanceof Error ? e.message : 'source_unavailable' }); }
  }
  return { checkedAt: new Date().toISOString(), autoPublished: false, records };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(new URL('../docs/SMARTPHONE_SOURCES.json', import.meta.url), 'utf8'));
  const output = resolve(process.argv[2] || 'work/smartphone-source-review.json');
  let prior = {}; try { const p = JSON.parse(await readFile(output, 'utf8')); prior = Object.fromEntries(p.records.filter(r => r.digest).map(r => [r.id,r.digest])); } catch { /* Initial fetch always needs human review. */ }
  const report = await checkGuides(source.sources, prior);
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ output, autoPublished: false, states: report.records.map(r => ({ id:r.id,state:r.state })) }));
}
