import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: { AI: { run } } }) }));
import { cfSpeech } from "@/lib/cf-ai";
import { resolveDeviceVoice } from "@/lib/voices";

beforeEach(() => { run.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("selected voice consistency", () => {
  it("uses the requested cloud speaker", async () => {
    const audio = new Uint8Array(256);
    run.mockResolvedValue(audio);
    expect(await cfSpeech("Hello", "en", "asteria")).toBe(audio);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("@cf/deepgram/aura-2-en", { text: "Hello", speaker: "asteria", encoding: "mp3" });
  });
  it("does not replace a failed selected voice with MeloTTS", async () => {
    run.mockRejectedValue(new Error("Mock selected provider unavailable"));
    expect(await cfSpeech("Hola", "es", "celeste")).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("does not replace empty selected-voice output with another speaker", async () => {
    run.mockResolvedValue(new Uint8Array(20));
    expect(await cfSpeech("Hello", "en", "asteria")).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("still supports the generic speech engine when no speaker was selected", async () => {
    run.mockResolvedValue(new Uint8Array(256));
    expect(await cfSpeech("Hello", "en")).toHaveLength(256);
    expect(run).toHaveBeenCalledWith("@cf/myshell-ai/melotts", { prompt: "Hello", lang: "en" });
  });
  it("keeps the pinned device voice when the browser reorders its list", () => {
    const first = { name: "First voice", lang: "en-US" };
    const other = { name: "Google other voice", lang: "en-US" };
    expect(resolveDeviceVoice([other, first], "en", first.name)).toBe(first);
  });
  it("does not substitute another voice when a selected voice disappears", () => {
    expect(resolveDeviceVoice([{ name: "Other", lang: "en-US" }], "en", "Selected")).toBeUndefined();
    expect(resolveDeviceVoice([], "en")).toBeUndefined();
  });
  it("does not select a different language just because its voice name matches", () => {
    expect(resolveDeviceVoice([{ name: "Selected", lang: "es-MX" }], "en", "Selected")).toBeUndefined();
  });
});
