import { describe, expect, it, vi } from "vitest";
// Native .mjs is the same change detector used by the maintenance command.
// @ts-expect-error The small Node maintenance script intentionally has no TS declaration.
import { checkGuides } from "../scripts/check-smartphone-guides.mjs";
const source = [{ id: "guide", url: "https://support.apple.com/guide/iphone/welcome/ios" }];
describe("phone source review queue", () => {
 it("requires human review for initial and changed snapshots; never publishes", async () => {
  const fetcher = vi.fn(async () => new Response("<html>source1</html>", { headers: { "content-type": "text/html" } }));
  const first = await checkGuides(source, {}, fetcher);
  expect(first.autoPublished).toBe(false); expect(first.records[0].state).toBe("initial_review_required");
  const same = await checkGuides(source, { guide:first.records[0].digest }, fetcher);
  expect(same.records[0].state).toBe("unchanged_snapshot");
  const changed = await checkGuides(source, { guide:"different" }, fetcher);
  expect(changed.records[0].state).toBe("changed_needs_review");
 });
 it("does not fetch unapproved destinations or follow redirects", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status:302 }));
  const bad = await checkGuides([{ id:"bad", url:"https://example.test/private" }], {}, fetcher);
  expect(bad.records[0].reason).toBe("source_not_allowlisted"); expect(fetcher).not.toHaveBeenCalled();
  const redirect = await checkGuides(source, {}, fetcher);
  expect(redirect.records[0].state).toBe("needs_review");
  expect(fetcher.mock.calls[0]).toBeDefined();
 });
});
