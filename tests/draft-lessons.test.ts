import { createServer, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/draft-lessons.mjs");
const lesson = {
  title: "Transport fixture", minutes: 6, summary: "Not course content",
  blocks: [
    { type: "text", heading: "Practice", body: "A local test fixture." },
    { type: "keypoints", heading: "Check", items: ["Review the result"] },
    { type: "quiz", question: "Which?", options: ["A", "B", "C", "D"], answer: 0, explanation: "A" },
    { type: "prompt-lab", goal: "Practice", minScore: 65 },
  ],
};

async function runDraft(respond: (res: ServerResponse) => void, args: string[] = []) {
  const dir = await mkdtemp(path.join(tmpdir(), "rreal-draft-test-"));
  let requestBody: Record<string, unknown> | null = null;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    respond(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  try {
    const child = spawn(process.execPath, [script, "--course", "Test", "--topics", "Test topic", ...args], {
      cwd: dir, env: { ...process.env, OLLAMA_URL: `http://127.0.0.1:${address.port}` }, stdio: "ignore",
    });
    const code = await new Promise<number | null>((resolve, reject) => { child.on("exit", resolve); child.on("error", reject); });
    const files = await readdir(path.join(dir, "drafts")).catch(() => [] as string[]);
    const draft = files.length ? JSON.parse(await readFile(path.join(dir, "drafts", files[0]), "utf8")) : null;
    return { code, files, draft, requestBody };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(dir, { recursive: true, force: true });
  }
}

describe("local lesson drafting transport", () => {
  it("reads delayed headers, split stream records and a final record without newline", async () => {
    const result = await runDraft((res) => setTimeout(() => {
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      const record = JSON.stringify({ message: { content: JSON.stringify(lesson) } });
      res.write(record.slice(0, 25));
      setTimeout(() => res.end(record.slice(25)), 20);
    }, 50), ["--threads", "2", "--context", "2048", "--max-tokens", "1500", "--keep-alive", "0"]);
    expect(result.code).toBe(0);
    expect(result.draft.lessons[0].lesson).toEqual(lesson);
    expect(result.draft.lessons[0].needsReview).toBe(true);
    expect(result.requestBody).toMatchObject({ options: { num_thread: 2, num_ctx: 2048, num_predict: 1500 }, keep_alive: "0" });
  });

  it("does not report a streamed runner error as a successful draft", async () => {
    const result = await runDraft((res) => { res.writeHead(200); res.end(JSON.stringify({ error: "Test runner unavailable" }) + "\n"); });
    expect(result.code).not.toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it("fails on an HTTP error rather than writing an empty successful batch", async () => {
    const result = await runDraft((res) => { res.writeHead(503); res.end("Test unavailable"); });
    expect(result.code).not.toBe(0);
    expect(result.files).toHaveLength(0);
  });
});
