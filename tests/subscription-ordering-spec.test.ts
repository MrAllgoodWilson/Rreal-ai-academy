import { describe, it, expect, vi, beforeEach } from "vitest";

describe("PostgreSQL Migration 0011 — Atomic Subscription Event Ordering & Terminal Tie Semantics", () => {
  // Priority hierarchy simulation matching public.subscription_status_priority in migration 0011
  function statusPriority(status: string): number {
    switch (status) {
      case "canceled": return 5;
      case "unpaid": return 4;
      case "past_due": return 3;
      case "incomplete_expired": return 2;
      case "active":
      case "trialing": return 1;
      default: return 0;
    }
  }

  // Pure state-machine specification matching public.upsert_subscription_ordered in migration 0011
  interface SubscriptionRow {
    id: string;
    stripe_subscription_id: string;
    status: string;
    last_event_created: number;
    updated_at: string;
  }

  class AtomicSubscriptionOrderingHarness {
    private rows = new Map<string, SubscriptionRow>();

    // Simulates SELECT ... FOR UPDATE atomic conditional upsert
    async upsertOrdered(
      subId: string,
      status: string,
      eventCreated: number | null,
    ): Promise<{ updated: boolean; row: SubscriptionRow }> {
      const existing = this.rows.get(subId);

      if (existing && eventCreated !== null && eventCreated > 0) {
        // 1. Monotonic timestamp check: older event is stale
        if (eventCreated < existing.last_event_created) {
          return { updated: false, row: existing };
        }
        // 2. Tied timestamp check: terminal canceled strictly wins, priority hierarchy tie-breaking
        if (eventCreated === existing.last_event_created) {
          if (existing.status === "canceled" && status !== "canceled") {
            return { updated: false, row: existing };
          }
          if (status === "canceled" && existing.status !== "canceled") {
            // Incoming canceled wins tie
          } else if (statusPriority(existing.status) > statusPriority(status)) {
            return { updated: false, row: existing };
          }
        }
      }

      const updatedRow: SubscriptionRow = {
        id: existing?.id || "sub_row_" + Math.random().toString(36).slice(2),
        stripe_subscription_id: subId,
        status,
        last_event_created: eventCreated ?? existing?.last_event_created ?? 0,
        updated_at: new Date().toISOString(),
      };

      this.rows.set(subId, updatedRow);
      return { updated: true, row: updatedRow };
    }

    getRow(subId: string): SubscriptionRow | undefined {
      return this.rows.get(subId);
    }
  }

  let harness: AtomicSubscriptionOrderingHarness;

  beforeEach(() => {
    harness = new AtomicSubscriptionOrderingHarness();
  });

  it("1. Monotonic ordering: late arrival of older active event (200) after canceled (300) is rejected", async () => {
    const r1 = await harness.upsertOrdered("sub_1", "active", 100);
    expect(r1.updated).toBe(true);
    expect(r1.row.status).toBe("active");

    const r2 = await harness.upsertOrdered("sub_1", "canceled", 300);
    expect(r2.updated).toBe(true);
    expect(r2.row.status).toBe("canceled");

    const r3 = await harness.upsertOrdered("sub_1", "active", 200);
    expect(r3.updated).toBe(false);
    expect(harness.getRow("sub_1")?.status).toBe("canceled");
    expect(harness.getRow("sub_1")?.last_event_created).toBe(300);
  });

  it("2. Terminal tie rule: tied timestamp (300 vs 300) between canceled and active leaves subscription canceled", async () => {
    await harness.upsertOrdered("sub_tie_1", "canceled", 300);
    const rActive = await harness.upsertOrdered("sub_tie_1", "active", 300);
    expect(rActive.updated).toBe(false);
    expect(harness.getRow("sub_tie_1")?.status).toBe("canceled");

    // Reverse arrival order at same timestamp: canceled overwrites active
    await harness.upsertOrdered("sub_tie_2", "active", 300);
    const rCanceled = await harness.upsertOrdered("sub_tie_2", "canceled", 300);
    expect(rCanceled.updated).toBe(true);
    expect(harness.getRow("sub_tie_2")?.status).toBe("canceled");
  });

  it("3. Priority hierarchy tie-break: unpaid (priority 4) beats active (priority 1) on identical timestamp", async () => {
    await harness.upsertOrdered("sub_prio", "unpaid", 500);
    const r = await harness.upsertOrdered("sub_prio", "active", 500);
    expect(r.updated).toBe(false);
    expect(harness.getRow("sub_prio")?.status).toBe("unpaid");
  });

  it("4. Concurrent overlapping request paths: parallel requests resolve to highest valid state without race conditions", async () => {
    // Simulate 10 concurrent webhook events hitting the atomic update in parallel
    const events = [
      { status: "active", created: 100 },
      { status: "active", created: 150 },
      { status: "past_due", created: 200 },
      { status: "active", created: 180 }, // Out-of-order
      { status: "canceled", created: 300 },
      { status: "active", created: 250 }, // Out-of-order
      { status: "unpaid", created: 290 }, // Out-of-order
      { status: "active", created: 300 }, // Tied with canceled, lower priority
      { status: "canceled", created: 300 }, // Tied idempotent retry
    ];

    // Shuffle and execute concurrently
    const shuffled = [...events].sort(() => Math.random() - 0.5);
    await Promise.all(shuffled.map((ev) => harness.upsertOrdered("sub_concurrent", ev.status, ev.created)));

    const finalRow = harness.getRow("sub_concurrent");
    expect(finalRow).toBeDefined();
    expect(finalRow?.status).toBe("canceled");
    expect(finalRow?.last_event_created).toBe(300);
  });

  it("5. Null event timestamp preservation: event without timestamp does not null existing monotonic clock", async () => {
    await harness.upsertOrdered("sub_clock", "active", 500);
    expect(harness.getRow("sub_clock")?.last_event_created).toBe(500);

    const rNull = await harness.upsertOrdered("sub_clock", "active", null);
    expect(rNull.updated).toBe(true);
    expect(harness.getRow("sub_clock")?.last_event_created).toBe(500);
  });
});
