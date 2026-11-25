import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js → Cloudflare Workers adapter (OpenNext). No ISR/data cache bindings needed: pages are static or per-request.
export default defineCloudflareConfig();
