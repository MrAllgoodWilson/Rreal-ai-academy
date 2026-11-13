import { describe, it, expect, vi, beforeEach } from "vitest";
import { callClaude } from "@/lib/claude";
import {
  CostMeteringManager,
  MemoryFoundersCostStore,
  BudgetExceededException,
  ConcurrencyLimitExceededException,
} from "@/lib/founders";

vi.mock("server-only", () => ({}));

describe("Founders Beta — Real Provider Boundary Cost Metering & Zero-Call Enforcements", () => {
  let store: MemoryFoundersCostStore;
  let manager: CostMeteringManager;
  const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
  const MONTH_WINDOW = new Date().toISOString().slice(0, 7);

  beforeEach(() => {
    store = new MemoryFoundersCostStore();
    manager = new CostMeteringManager(store);
    vi.restoreAllMocks();
  });

  it("P2-Z1: Denied reservation due to zero remaining quota results in exactly ZERO provider calls", async () => {
    // Set consumed units equal to approved quota (200 units for Rreal)
    const ledger = await store.getLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    ledger.totalUnitsConsumed = 200;
    await store.saveLedger(ledger);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      callClaude({
        system: "You are a helpful tutor.",
        messages: [{ role: "user", content: "Explain closures." }],
        metering: {
          accountId: ACCOUNT_ID,
          companyId: "rreal",
          meterManager: manager,
        },
      }),
    ).rejects.toThrow(BudgetExceededException);

    // Guaranteed ZERO provider network requests
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("P2-Z2: Denied reservation due to budget envelope breach results in exactly ZERO provider calls", async () => {
    // Set settled cost equal to net inference budget ($0.41 for Rreal)
    const ledger = await store.getLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    ledger.totalSettledCostUsd = 0.41;
    await store.saveLedger(ledger);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      callClaude({
        system: "System prompt",
        messages: [{ role: "user", content: "Generate large text" }],
        maxTokens: 1000,
        metering: {
          accountId: ACCOUNT_ID,
          companyId: "rreal",
          meterManager: manager,
        },
      }),
    ).rejects.toThrow(BudgetExceededException);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("P2-Z3: Successful provider call reserves tokens, invokes provider once, and settles actual tokens in ledger", async () => {
    // Mock Anthropic provider response
    const mockResponseText = "Closures in JavaScript retain their outer lexical scope.";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: mockResponseText }],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    } as any);

    const result = await callClaude({
      system: "You are a JS tutor.",
      messages: [{ role: "user", content: "What is a closure?" }],
      maxTokens: 100,
      byok: { anthropic: "sk-ant-test-key" },
      metering: {
        accountId: ACCOUNT_ID,
        companyId: "rreal",
        meterManager: manager,
      },
    });

    expect(result).toBe(mockResponseText);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const updatedLedger = await manager.getAccountLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    expect(updatedLedger.totalUnitsConsumed).toBe(1);
    expect(updatedLedger.totalUnitsReserved).toBe(0);
    expect(updatedLedger.activeConcurrency).toBe(0);
    expect(updatedLedger.totalSettledCostUsd).toBeGreaterThan(0);
  });

  it("P2-Z4: Provider timeout or throw strictly retains reservation so in-flight compute cannot be double-spent", async () => {
    // Mock provider throw / network timeout
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Upstream provider gateway timeout (504)"));

    await expect(
      callClaude({
        system: "System",
        messages: [{ role: "user", content: "Prompt" }],
        byok: { anthropic: "sk-ant-test-key" },
        metering: {
          accountId: ACCOUNT_ID,
          companyId: "rreal",
          meterManager: manager,
        },
      }),
    ).rejects.toThrow(/Upstream provider gateway timeout/);

    const updatedLedger = await manager.getAccountLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    // Reservation is retained per Directive P2 (N6) to prevent double spending
    expect(updatedLedger.totalUnitsReserved).toBe(1);
    expect(updatedLedger.activeConcurrency).toBe(1);
  });

  it("P2-Z5: Concurrency limit (1 simultaneous in-flight dispatch for Rreal) is enforced at the meter boundary", async () => {
    // Saturate Rreal concurrency limit (concurrency limit = 1)
    await manager.reserveUsage(
      "rreal",
      ACCOUNT_ID,
      "llama-3.2-3b",
      100,
      100,
      1,
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      callClaude({
        system: "System",
        messages: [{ role: "user", content: "Prompt 2" }],
        byok: { anthropic: "sk-ant-test-key" },
        metering: {
          accountId: ACCOUNT_ID,
          companyId: "rreal",
          meterManager: manager,
        },
      }),
    ).rejects.toThrow(ConcurrencyLimitExceededException);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("P2-Z4: Missing provider usage metrics strictly throws and retains reservation on hold", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Reply without usage metrics" }],
        // usage is omitted
      }),
    } as any);

    const ledgerBefore = await store.getLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    const initialReservedCost = ledgerBefore.totalReservedCostUsd;

    await expect(
      callClaude({
        system: "You are a tutor.",
        messages: [{ role: "user", content: "Test prompt" }],
        maxTokens: 50,
        byok: { anthropic: "sk-ant-test-key" },
        metering: {
          accountId: ACCOUNT_ID,
          companyId: "rreal",
          meterManager: manager,
        },
      }),
    ).rejects.toThrow(/Provider response omitted required token usage metrics; reservation retained on hold/);

    const ledgerAfter = await store.getLedger("rreal", ACCOUNT_ID, MONTH_WINDOW);
    expect(ledgerAfter.totalReservedCostUsd).toBeGreaterThan(initialReservedCost);
    expect(ledgerAfter.totalSettledCostUsd).toBe(ledgerBefore.totalSettledCostUsd);
  });
});
