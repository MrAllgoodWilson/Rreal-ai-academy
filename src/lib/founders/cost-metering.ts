import { CompanyId } from './types';

export interface ModelPricing {
  provider: string;
  model: string;
  inputPerMillionTokensUsd: number;
  outputPerMillionTokensUsd: number;
  perInvocationUsd?: number;
  unitDefinition: string;
}

export interface CompanyFulfillmentBudget {
  companyId: CompanyId;
  grossRevenueMonthlyUsd: number; // $4.99
  paymentProcessingFeeUsd: number; // ~$0.44471 (2.9% + $0.30)
  stripeBillingFeeUsd: number; // ~$0.03493 (0.7%)
  netPaymentAfterFeesUsd: number; // ~$4.51036
  marginFloorPercent: number;
  maxFulfillmentBudgetMonthlyUsd: number; // Rounded down enforceable ceiling
  fixedCostAllocationMonthlyUsd: number; // Pro-rated infrastructure allocation
  netInferenceBudgetMonthlyUsd: number; // Allowable variable compute
  approvedQuotaUnits: number; // Monthly quota (credits / sessions / leads / screeners)
  maxCostPerQuotaUnitUsd: number;
  concurrencyLimit: number;
  supportedModels: Record<string, ModelPricing>;
}

/**
 * Hard Per-Request Maximums Before Dispatch
 */
export const HARD_REQUEST_LIMITS = {
  maxPromptTokens: 2000,
  maxCompletionTokens: 1000,
  maxTurns: 5,
  maxDurationSeconds: 30,
  maxRetries: 2,
};

/**
 * Exact Per-Company Cost Envelopes & Margin Floors (Directives FOUNDERS-da6e265 & Cloudflare Nov 2026 pricing)
 * Cloudflare Workers AI Llama 3.2 3B Official Rate: $0.051 / 1M input, $0.335 / 1M output.
 * Max call (2k in, 1k out) = (2000 * 0.051 + 1000 * 0.335) / 1,000,000 = $0.000437.
 */
export const COMPANY_COST_BUDGETS: Record<CompanyId, CompanyFulfillmentBudget> = {
  tiqology: {
    companyId: 'tiqology',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 65,
    maxFulfillmentBudgetMonthlyUsd: 1.26, // Rounded down ceiling
    fixedCostAllocationMonthlyUsd: 0.20,
    netInferenceBudgetMonthlyUsd: 1.06, // ~$1.06 net inference (~2,425 max calls at $0.000437/call)
    approvedQuotaUnits: 5000, // 5,000 compute credits (each credit is up to ~450 tokens or micro-computation)
    maxCostPerQuotaUnitUsd: 1.06 / 5000, // $0.000212 per credit
    concurrencyLimit: 2,
    supportedModels: {
      'llama-3.2-3b': {
        provider: 'cloudflare-workers-ai',
        model: 'llama-3.2-3b-instruct',
        inputPerMillionTokensUsd: 0.051,
        outputPerMillionTokensUsd: 0.335,
        unitDefinition: 'Official Cloudflare Nov 2026 pricing ($0.051/M in, $0.335/M out; $0.000437/max-call)',
      },
    },
  },
  zuri: {
    companyId: 'zuri',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 70,
    maxFulfillmentBudgetMonthlyUsd: 1.01, // Rounded down ceiling
    fixedCostAllocationMonthlyUsd: 0.15,
    netInferenceBudgetMonthlyUsd: 0.86,
    approvedQuotaUnits: 150, // 150 chat sessions
    maxCostPerQuotaUnitUsd: 0.86 / 150, // $0.00573 per session
    concurrencyLimit: 1,
    supportedModels: {
      'llama-3.2-3b': {
        provider: 'cloudflare-workers-ai',
        model: 'llama-3.2-3b-instruct',
        inputPerMillionTokensUsd: 0.051,
        outputPerMillionTokensUsd: 0.335,
        unitDefinition: '1 session = up to 5 conversational turns (max 2,000 total tokens)',
      },
    },
  },
  riley: {
    companyId: 'riley',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 75,
    maxFulfillmentBudgetMonthlyUsd: 0.76, // Rounded down ceiling
    fixedCostAllocationMonthlyUsd: 0.15,
    netInferenceBudgetMonthlyUsd: 0.61,
    approvedQuotaUnits: 100, // 100 concierge lead evaluations
    maxCostPerQuotaUnitUsd: 0.61 / 100, // $0.0061 per evaluation
    concurrencyLimit: 1,
    supportedModels: {
      'llama-3.2-3b': {
        provider: 'cloudflare-workers-ai',
        model: 'llama-3.2-3b-instruct',
        inputPerMillionTokensUsd: 0.051,
        outputPerMillionTokensUsd: 0.335,
        unitDefinition: '1 evaluation = text-only lead scoring (max 1,500 tokens; telephony excluded)',
      },
    },
  },
  rreal: {
    companyId: 'rreal',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 80,
    maxFulfillmentBudgetMonthlyUsd: 0.51, // Rounded down ceiling
    fixedCostAllocationMonthlyUsd: 0.10,
    netInferenceBudgetMonthlyUsd: 0.41,
    approvedQuotaUnits: 200, // 200 compute credits
    maxCostPerQuotaUnitUsd: 0.41 / 200, // $0.00205 per credit
    concurrencyLimit: 1,
    supportedModels: {
      'llama-3.2-3b': {
        provider: 'cloudflare-workers-ai',
        model: 'llama-3.2-3b-instruct',
        inputPerMillionTokensUsd: 0.051,
        outputPerMillionTokensUsd: 0.335,
        unitDefinition: '1 credit = prompt review / text generation (video strictly excluded)',
      },
    },
  },
  reel2real: {
    companyId: 'reel2real',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 75,
    maxFulfillmentBudgetMonthlyUsd: 0.76,
    fixedCostAllocationMonthlyUsd: 0.15,
    netInferenceBudgetMonthlyUsd: 0.61,
    approvedQuotaUnits: 50, // 50 creator media ops
    maxCostPerQuotaUnitUsd: 0.61 / 50, // $0.0122 per media op
    concurrencyLimit: 1,
    supportedModels: {
      'media-slice-op': {
        provider: 'internal-image-slice',
        model: 'lightweight-thumbnail',
        inputPerMillionTokensUsd: 0,
        outputPerMillionTokensUsd: 0,
        perInvocationUsd: 0.010,
        unitDefinition: '1 media op = image thumbnail / audio crop (heavy video rendering excluded)',
      },
    },
  },
  inboxedge: {
    companyId: 'inboxedge',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 90,
    maxFulfillmentBudgetMonthlyUsd: 0.01,
    fixedCostAllocationMonthlyUsd: 0.005,
    netInferenceBudgetMonthlyUsd: 0.005,
    approvedQuotaUnits: 2, // Exactly 2 DNS/DMARC audits as approved (retainers excluded)
    maxCostPerQuotaUnitUsd: 0.005 / 2,
    concurrencyLimit: 1,
    supportedModels: {
      'dns-dmarc-scanner': {
        provider: 'dns-lookup-native',
        model: 'dns-scanner-v1',
        inputPerMillionTokensUsd: 0,
        outputPerMillionTokensUsd: 0,
        perInvocationUsd: 0.0005,
        unitDefinition: '1 audit = DNS/SPF/DKIM/DMARC record scan (retainers/outreach excluded)',
      },
    },
  },
  ifilms: {
    companyId: 'ifilms',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 85,
    maxFulfillmentBudgetMonthlyUsd: 0.26,
    fixedCostAllocationMonthlyUsd: 0.05,
    netInferenceBudgetMonthlyUsd: 0.21,
    approvedQuotaUnits: 2, // 2 screener viewing passes
    maxCostPerQuotaUnitUsd: 0.21 / 2, // $0.105 per pass
    concurrencyLimit: 1,
    supportedModels: {
      'screener-delivery': {
        provider: 'cloudflare-stream',
        model: 'video-stream-delivery',
        inputPerMillionTokensUsd: 0,
        outputPerMillionTokensUsd: 0,
        perInvocationUsd: 0.10,
        unitDefinition: '1 screener pass = up to 100 streamed viewing minutes (production shoots excluded)',
      },
    },
  },
  shopify_stores: {
    companyId: 'shopify_stores',
    grossRevenueMonthlyUsd: 4.99,
    paymentProcessingFeeUsd: 0.44471,
    stripeBillingFeeUsd: 0.03493,
    netPaymentAfterFeesUsd: 4.51036,
    marginFloorPercent: 100, // Strictly excluded
    maxFulfillmentBudgetMonthlyUsd: 0,
    fixedCostAllocationMonthlyUsd: 0,
    netInferenceBudgetMonthlyUsd: 0,
    approvedQuotaUnits: 0,
    maxCostPerQuotaUnitUsd: 0,
    concurrencyLimit: 0,
    supportedModels: {},
  },
};

export class BudgetExceededException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededException';
  }
}

export class ConcurrencyLimitExceededException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyLimitExceededException';
  }
}

export class UnknownModelPriceException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownModelPriceException';
  }
}

export class InvalidUsageQuantityException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUsageQuantityException';
  }
}

export class HardTokenLimitExceededException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HardTokenLimitExceededException';
  }
}

export interface UsageReservation {
  id: string;
  companyId: CompanyId;
  accountId: string;
  monthWindow: string; // YYYY-MM
  modelKey: string;
  estimatedUnits: number;
  reservedCostUsd: number;
  status: 'reserved' | 'settled' | 'released';
  createdAt: string;
  updatedAt: string;
}

export interface AccountUsageLedger {
  companyId: CompanyId;
  accountId: string;
  monthWindow: string; // YYYY-MM
  totalSettledCostUsd: number;
  totalReservedCostUsd: number;
  totalUnitsConsumed: number;
  totalUnitsReserved: number;
  activeConcurrency: number;
  overageFlag: boolean;
}

export interface IFoundersCostStore {
  getLedger(companyId: CompanyId, accountId: string, monthWindow: string): Promise<AccountUsageLedger>;
  saveLedger(ledger: AccountUsageLedger): Promise<void>;
  getReservation(reservationId: string): Promise<UsageReservation | null>;
  saveReservation(reservation: UsageReservation): Promise<void>;
  listActiveReservations(accountId: string): Promise<UsageReservation[]>;
  withTransaction?<T>(fn: (txnStore: IFoundersCostStore) => Promise<T>): Promise<T>;
}

export class MemoryFoundersCostStore implements IFoundersCostStore {
  private ledgers = new Map<string, AccountUsageLedger>();
  private reservations = new Map<string, UsageReservation>();

  async getLedger(companyId: CompanyId, accountId: string, monthWindow: string): Promise<AccountUsageLedger> {
    const key = `${companyId}:${accountId}:${monthWindow}`;
    let ledger = this.ledgers.get(key);
    if (!ledger) {
      ledger = {
        companyId,
        accountId,
        monthWindow,
        totalSettledCostUsd: 0,
        totalReservedCostUsd: 0,
        totalUnitsConsumed: 0,
        totalUnitsReserved: 0,
        activeConcurrency: 0,
        overageFlag: false,
      };
      this.ledgers.set(key, ledger);
    }
    return { ...ledger };
  }

  async saveLedger(ledger: AccountUsageLedger): Promise<void> {
    const key = `${ledger.companyId}:${ledger.accountId}:${ledger.monthWindow}`;
    this.ledgers.set(key, { ...ledger });
  }

  async getReservation(reservationId: string): Promise<UsageReservation | null> {
    const r = this.reservations.get(reservationId);
    return r ? { ...r } : null;
  }

  async saveReservation(reservation: UsageReservation): Promise<void> {
    this.reservations.set(reservation.id, { ...reservation });
  }

  async listActiveReservations(accountId: string): Promise<UsageReservation[]> {
    return Array.from(this.reservations.values()).filter(
      (r) => r.accountId === accountId && r.status === 'reserved',
    );
  }
}

/**
 * CostMeteringManager enforces hard pre-dispatch reservations, input validation, and margin bounds.
 */
export class CostMeteringManager {
  private store: IFoundersCostStore;

  constructor(store?: IFoundersCostStore) {
    this.store = store || new MemoryFoundersCostStore();
  }

  private getMonthWindow(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Pre-dispatch cost reservation: atomically checks remaining monthly budget and model pricing.
   */
  async reserveUsage(
    companyId: CompanyId,
    accountId: string,
    modelKey: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    unitsCount: number = 1,
    customMonthWindow?: string,
  ): Promise<UsageReservation> {
    if (this.store.withTransaction) {
      return this.store.withTransaction((txnStore) =>
        this.executeReserveUsage(
          txnStore,
          companyId,
          accountId,
          modelKey,
          estimatedInputTokens,
          estimatedOutputTokens,
          unitsCount,
          customMonthWindow,
        ),
      );
    }
    return this.executeReserveUsage(
      this.store,
      companyId,
      accountId,
      modelKey,
      estimatedInputTokens,
      estimatedOutputTokens,
      unitsCount,
      customMonthWindow,
    );
  }

  private async executeReserveUsage(
    store: IFoundersCostStore,
    companyId: CompanyId,
    accountId: string,
    modelKey: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    unitsCount: number = 1,
    customMonthWindow?: string,
  ): Promise<UsageReservation> {
    // 1. Strict Input Validation (finite, non-negative integers only)
    if (
      !Number.isFinite(estimatedInputTokens) ||
      !Number.isInteger(estimatedInputTokens) ||
      estimatedInputTokens < 0
    ) {
      throw new InvalidUsageQuantityException(
        `Invalid estimatedInputTokens: ${estimatedInputTokens}. Must be finite non-negative integer.`,
      );
    }
    if (
      !Number.isFinite(estimatedOutputTokens) ||
      !Number.isInteger(estimatedOutputTokens) ||
      estimatedOutputTokens < 0
    ) {
      throw new InvalidUsageQuantityException(
        `Invalid estimatedOutputTokens: ${estimatedOutputTokens}. Must be finite non-negative integer.`,
      );
    }
    if (!Number.isFinite(unitsCount) || !Number.isInteger(unitsCount) || unitsCount <= 0) {
      throw new InvalidUsageQuantityException(
        `Invalid unitsCount: ${unitsCount}. Must be finite positive integer.`,
      );
    }

    // 2. Hard Per-Request Maximums Before Dispatch
    if (estimatedInputTokens > HARD_REQUEST_LIMITS.maxPromptTokens) {
      throw new HardTokenLimitExceededException(
        `Estimated prompt tokens (${estimatedInputTokens}) exceeds hard limit (${HARD_REQUEST_LIMITS.maxPromptTokens}).`,
      );
    }
    if (estimatedOutputTokens > HARD_REQUEST_LIMITS.maxCompletionTokens) {
      throw new HardTokenLimitExceededException(
        `Estimated completion tokens (${estimatedOutputTokens}) exceeds hard limit (${HARD_REQUEST_LIMITS.maxCompletionTokens}).`,
      );
    }

    const budget = COMPANY_COST_BUDGETS[companyId];
    if (!budget || budget.maxFulfillmentBudgetMonthlyUsd <= 0) {
      throw new BudgetExceededException(
        `Company ${companyId} has no allowable beta fulfillment budget (discrete physical goods or agency retainers excluded)`,
      );
    }

    const modelPricing = budget.supportedModels[modelKey];
    if (!modelPricing) {
      throw new UnknownModelPriceException(
        `Model ${modelKey} is not approved or priced for company ${companyId}. Refusing unverified compute.`,
      );
    }

    const monthWindow = customMonthWindow || this.getMonthWindow();
    const ledger = await store.getLedger(companyId, accountId, monthWindow);

    // 3. Concurrency check
    if (ledger.activeConcurrency >= budget.concurrencyLimit) {
      throw new ConcurrencyLimitExceededException(
        `Account ${accountId} reached concurrency limit (${budget.concurrencyLimit}) for ${companyId}`,
      );
    }

    // 4. Calculate estimated cost
    let estimatedCostUsd = 0;
    if (modelPricing.perInvocationUsd) {
      estimatedCostUsd = modelPricing.perInvocationUsd * unitsCount;
    } else {
      const inputCost = (estimatedInputTokens / 1_000_000) * modelPricing.inputPerMillionTokensUsd;
      const outputCost = (estimatedOutputTokens / 1_000_000) * modelPricing.outputPerMillionTokensUsd;
      estimatedCostUsd = (inputCost + outputCost) * unitsCount;
    }

    // 5. Unit quota check: Pending + Settled units cannot exceed approvedQuotaUnits
    if (ledger.totalUnitsConsumed + ledger.totalUnitsReserved + unitsCount > budget.approvedQuotaUnits) {
      throw new BudgetExceededException(
        `Monthly unit quota (${budget.approvedQuotaUnits}) exceeded for ${companyId}. Currently consumed: ${ledger.totalUnitsConsumed}, pending: ${ledger.totalUnitsReserved}, requested: ${unitsCount}`,
      );
    }

    // 6. Dollar budget check: Settled + Reserved cost cannot exceed net inference ceiling
    const projectedCost = ledger.totalSettledCostUsd + ledger.totalReservedCostUsd + estimatedCostUsd;
    if (projectedCost > budget.netInferenceBudgetMonthlyUsd) {
      throw new BudgetExceededException(
        `Monthly net inference budget ($${budget.netInferenceBudgetMonthlyUsd}) exceeded for ${companyId}. Currently committed: $${(ledger.totalSettledCostUsd + ledger.totalReservedCostUsd).toFixed(4)}, requested: $${estimatedCostUsd.toFixed(4)}`,
      );
    }

    // 7. Commit reservation
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reservation: UsageReservation = {
      id: reservationId,
      companyId,
      accountId,
      monthWindow,
      modelKey,
      estimatedUnits: unitsCount,
      reservedCostUsd: estimatedCostUsd,
      status: 'reserved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.totalReservedCostUsd += estimatedCostUsd;
    ledger.totalUnitsReserved += unitsCount;
    ledger.activeConcurrency += 1;

    await store.saveReservation(reservation);
    await store.saveLedger(ledger);

    return reservation;
  }

  /**
   * Post-dispatch cost settlement: settles actual consumption against original reservation.
   * Retains the reservation's original billing cycle even if settlement crosses calendar months.
   */
  async settleUsage(
    reservationId: string,
    actualInputTokens: number,
    actualOutputTokens: number,
    actualUnits: number = 1,
  ): Promise<void> {
    if (this.store.withTransaction) {
      return this.store.withTransaction((txnStore) =>
        this.executeSettleUsage(txnStore, reservationId, actualInputTokens, actualOutputTokens, actualUnits),
      );
    }
    return this.executeSettleUsage(this.store, reservationId, actualInputTokens, actualOutputTokens, actualUnits);
  }

  private async executeSettleUsage(
    store: IFoundersCostStore,
    reservationId: string,
    actualInputTokens: number,
    actualOutputTokens: number,
    actualUnits: number = 1,
  ): Promise<void> {
    const reservation = await store.getReservation(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    if (reservation.status !== 'reserved') {
      return; // Already settled or released
    }

    const budget = COMPANY_COST_BUDGETS[reservation.companyId];
    const modelPricing = budget?.supportedModels[reservation.modelKey];
    if (!budget || !modelPricing) {
      throw new Error(`Pricing missing for settled reservation ${reservationId}`);
    }

    // Calculate actual cost
    let actualCostUsd = 0;
    if (modelPricing.perInvocationUsd) {
      actualCostUsd = modelPricing.perInvocationUsd * actualUnits;
    } else {
      const inCost = (actualInputTokens / 1_000_000) * modelPricing.inputPerMillionTokensUsd;
      const outCost = (actualOutputTokens / 1_000_000) * modelPricing.outputPerMillionTokensUsd;
      actualCostUsd = (inCost + outCost) * actualUnits;
    }

    // Retrieve ledger for the RESERVATION's month window (preserves billing cycle on month transition)
    const ledger = await store.getLedger(
      reservation.companyId,
      reservation.accountId,
      reservation.monthWindow,
    );

    ledger.totalReservedCostUsd = Math.max(0, ledger.totalReservedCostUsd - reservation.reservedCostUsd);
    ledger.totalUnitsReserved = Math.max(0, ledger.totalUnitsReserved - reservation.estimatedUnits);
    ledger.totalSettledCostUsd += actualCostUsd;
    ledger.totalUnitsConsumed += actualUnits;
    ledger.activeConcurrency = Math.max(0, ledger.activeConcurrency - 1);

    // If actual cost exceeded the net inference budget, truthfully record and flag overage
    if (ledger.totalSettledCostUsd > budget.netInferenceBudgetMonthlyUsd) {
      ledger.overageFlag = true;
    }

    reservation.status = 'settled';
    reservation.updatedAt = new Date().toISOString();

    await store.saveReservation(reservation);
    await store.saveLedger(ledger);
  }

  /**
   * Release reservation without consuming cost (e.g. if pre-dispatch call failed or cancelled)
   */
  async releaseUsage(reservationId: string): Promise<void> {
    if (this.store.withTransaction) {
      return this.store.withTransaction((txnStore) => this.executeReleaseUsage(txnStore, reservationId));
    }
    return this.executeReleaseUsage(this.store, reservationId);
  }

  private async executeReleaseUsage(store: IFoundersCostStore, reservationId: string): Promise<void> {
    const reservation = await store.getReservation(reservationId);
    if (!reservation || reservation.status !== 'reserved') {
      return;
    }

    const ledger = await store.getLedger(
      reservation.companyId,
      reservation.accountId,
      reservation.monthWindow,
    );

    ledger.totalReservedCostUsd = Math.max(0, ledger.totalReservedCostUsd - reservation.reservedCostUsd);
    ledger.totalUnitsReserved = Math.max(0, ledger.totalUnitsReserved - reservation.estimatedUnits);
    ledger.activeConcurrency = Math.max(0, ledger.activeConcurrency - 1);

    reservation.status = 'released';
    reservation.updatedAt = new Date().toISOString();

    await store.saveReservation(reservation);
    await store.saveLedger(ledger);
  }
  async getAccountLedger(
    companyId: CompanyId,
    accountId: string,
    monthWindow?: string,
  ): Promise<AccountUsageLedger> {
    return this.store.getLedger(companyId, accountId, monthWindow || this.getMonthWindow());
  }
}

/**
 * Provider Dispatch Interceptor: wraps actual model call with pre-dispatch reservation and post-dispatch settlement.
 * Guarantees zero provider calls if reservation is denied.
 */
export async function dispatchWithCostMetering<T>(
  meter: CostMeteringManager,
  companyId: CompanyId,
  accountId: string,
  modelKey: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  unitsCount: number,
  dispatchFn: () => Promise<{ result: T; actualInputTokens: number; actualOutputTokens: number }>,
): Promise<T> {
  const reservation = await meter.reserveUsage(
    companyId,
    accountId,
    modelKey,
    estimatedInputTokens,
    estimatedOutputTokens,
    unitsCount,
  );

  try {
    const { result, actualInputTokens, actualOutputTokens } = await dispatchFn();
    await meter.settleUsage(reservation.id, actualInputTokens, actualOutputTokens, unitsCount);
    return result;
  } catch (err) {
    // Directive P2 / N6: Retain reservation on provider timeout or error.
    // A local timeout or provider throw does not prove job cancellation; do not release in-flight compute.
    throw err;
  }
}

export { CostMeteringManager as FoundersCostManager };
