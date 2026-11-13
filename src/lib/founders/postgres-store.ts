export { verifyTargetGuard } from './target-guard';
export type { TargetGuardQueryable, TargetGuardOptions, TargetGuardVerificationResult } from './target-guard';
import * as crypto from 'crypto';
export interface PgQueryResult<R = any> {
  rows: R[];
  rowCount?: number | null;
}
export interface PgQueryable {
  query<R = any>(queryTextOrConfig: string | { text: string; values?: any[] }, values?: any[]): Promise<PgQueryResult<R>>;
}
export interface Pool extends PgQueryable {
  connect(): Promise<PoolClient>;
}
export interface PoolClient extends PgQueryable {
  release(): void;
}
import {
  AuthenticatedAccount,
  CompanyId,
  FoundersAuditEntry,
  FoundersEligibility,
  FoundersEnrollment,
  FoundersOffer,
} from './types';
import { IFoundersStore, IneligibleAccountException } from './rules-engine';
import {
  AccountUsageLedger,
  IFoundersCostStore,
  UsageReservation,
} from './cost-metering';

export function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash('sha256').update(id).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export class PostgresFoundersStore implements IFoundersStore {
  constructor(private pool: Pool | PoolClient) {}

  async getOffer(companyId: CompanyId): Promise<FoundersOffer | null> {
    const res = await this.pool.query(
      `SELECT * FROM founders_offers WHERE company_id = $1 AND state = 'active' ORDER BY offer_version DESC LIMIT 1`,
      [companyId],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      merchantContext: r.merchant_context,
      offerVersion: r.offer_version,
      currency: r.currency,
      unitAmount: r.unit_amount,
      billingInterval: r.billing_interval,
      state: r.state,
      deliverables: typeof r.deliverables === 'string' ? JSON.parse(r.deliverables) : r.deliverables,
      betaTermsVersion: r.beta_terms_version,
      enrollmentWindow: r.enrollment_window ? (typeof r.enrollment_window === 'string' ? JSON.parse(r.enrollment_window) : r.enrollment_window) : undefined,
      termsHash: r.terms_hash,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async saveOffer(offer: FoundersOffer): Promise<void> {
    await this.pool.query(
      `INSERT INTO founders_offers (
        id, company_id, merchant_context, offer_version, currency, unit_amount,
        billing_interval, state, deliverables, beta_terms_version, enrollment_window,
        terms_hash, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        state = EXCLUDED.state,
        deliverables = EXCLUDED.deliverables,
        terms_hash = EXCLUDED.terms_hash,
        updated_at = EXCLUDED.updated_at`,
      [
        offer.id,
        offer.companyId,
        offer.merchantContext,
        offer.offerVersion,
        offer.currency,
        offer.unitAmount,
        offer.billingInterval,
        offer.state,
        JSON.stringify(offer.deliverables),
        offer.betaTermsVersion,
        offer.enrollmentWindow ? JSON.stringify(offer.enrollmentWindow) : null,
        offer.termsHash,
        offer.createdAt,
        offer.updatedAt,
      ],
    );
  }

  async getEligibility(companyId: CompanyId, accountId: string): Promise<FoundersEligibility | null> {
    const res = await this.pool.query(
      `SELECT * FROM founders_eligibilities WHERE company_id = $1 AND immutable_account_id = $2`,
      [companyId, accountId],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      immutableAccountId: r.immutable_account_id,
      originalRegisteredAt: r.original_registered_at.toISOString ? r.original_registered_at.toISOString() : String(r.original_registered_at),
      qualifiedAt: r.qualified_at.toISOString ? r.qualified_at.toISOString() : String(r.qualified_at),
      founderOfferId: r.founder_offer_id,
      eligibilityStatus: r.eligibility_status,
      immutableSourceEvidence: typeof r.immutable_source_evidence === 'string' ? JSON.parse(r.immutable_source_evidence) : r.immutable_source_evidence,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async findEligibilityByIdentitySignals(
    companyId: CompanyId,
    signals?: AuthenticatedAccount['identitySignals'],
  ): Promise<FoundersEligibility | null> {
    if (!signals) return null;

    const signalConditions: Array<{ type: string; val: string }> = [];
    if (signals.emailHash) signalConditions.push({ type: 'email_hash', val: signals.emailHash });
    if (signals.paymentFingerprint) signalConditions.push({ type: 'payment_fingerprint', val: signals.paymentFingerprint });
    if (signals.deviceFingerprint) signalConditions.push({ type: 'device_fingerprint', val: signals.deviceFingerprint });

    if (signalConditions.length === 0) return null;

    for (const s of signalConditions) {
      const res = await this.pool.query(
        `SELECT immutable_account_id FROM founders_identity_signals WHERE company_id = $1 AND signal_type = $2 AND signal_hash = $3 LIMIT 1`,
        [companyId, s.type, s.val],
      );
      if (res.rows.length > 0) {
        return this.getEligibility(companyId, res.rows[0].immutable_account_id);
      }
    }
    return null;
  }

  async saveEligibility(eligibility: FoundersEligibility): Promise<void> {
    await this.pool.query(
      `INSERT INTO founders_eligibilities (
        id, company_id, immutable_account_id, original_registered_at, qualified_at,
        founder_offer_id, eligibility_status, immutable_source_evidence, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (company_id, immutable_account_id) DO UPDATE SET
        eligibility_status = EXCLUDED.eligibility_status,
        updated_at = EXCLUDED.updated_at`,
      [
        eligibility.id,
        eligibility.companyId,
        eligibility.immutableAccountId,
        eligibility.originalRegisteredAt,
        eligibility.qualifiedAt,
        eligibility.founderOfferId,
        eligibility.eligibilityStatus,
        JSON.stringify(eligibility.immutableSourceEvidence),
        eligibility.createdAt,
        eligibility.updatedAt,
      ],
    );
  }

  /**
   * Qualify an account with strict database row-level locking on founders_pilot_counter.
   * Executes inside transaction with SELECT ... FOR UPDATE to serialize admissions across processes.
   */
  async qualifyAccountWithCapCheck(
    companyId: CompanyId,
    eligibility: FoundersEligibility,
    maxCap: number = 5,
  ): Promise<void> {
    // 1. Ensure counter row exists
    await this.pool.query(
      `INSERT INTO founders_pilot_counter (id, total_ever_admitted, max_cap)
       VALUES ('portfolio_cap', 0, $1)
       ON CONFLICT (id) DO NOTHING`,
      [maxCap],
    );

    // 2. Atomic test-and-increment with row lock in single SQL statement
    const updateRes = await this.pool.query(
      `UPDATE founders_pilot_counter
       SET total_ever_admitted = total_ever_admitted + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = 'portfolio_cap' AND total_ever_admitted < $1
       RETURNING total_ever_admitted`,
      [maxCap],
    );

    if (updateRes.rows.length === 0) {
      throw new IneligibleAccountException(
        `Portfolio-wide pilot capacity limit of ${maxCap} business accounts reached across all companies`,
      );
    }

    // 3. Persist the eligibility in same transaction
    await this.saveEligibility(eligibility);
  }

  async indexIdentitySignals(
    companyId: CompanyId,
    accountId: string,
    signals?: AuthenticatedAccount['identitySignals'],
  ): Promise<void> {
    if (!signals) return;

    const items: Array<{ type: string; val: string }> = [];
    if (signals.emailHash) items.push({ type: 'email_hash', val: signals.emailHash });
    if (signals.paymentFingerprint) items.push({ type: 'payment_fingerprint', val: signals.paymentFingerprint });
    if (signals.deviceFingerprint) items.push({ type: 'device_fingerprint', val: signals.deviceFingerprint });

    for (const item of items) {
      const id = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await this.pool.query(
        `INSERT INTO founders_identity_signals (
          id, company_id, immutable_account_id, signal_type, signal_hash, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (company_id, signal_type, signal_hash) DO NOTHING`,
        [id, companyId, accountId, item.type, item.val],
      );
    }
  }

  async getEnrollment(companyId: CompanyId, accountId: string): Promise<FoundersEnrollment | null> {
    const res = await this.pool.query(
      `SELECT * FROM founders_enrollments WHERE company_id = $1 AND immutable_account_id = $2`,
      [companyId, accountId],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      eligibilityId: r.eligibility_id,
      immutableAccountId: r.immutable_account_id,
      companyId: r.company_id,
      providerCustomerId: r.provider_customer_id,
      providerSubscriptionId: r.provider_subscription_id,
      providerPriceId: r.provider_price_id,
      subscriptionStatus: r.subscription_status,
      startedAt: r.started_at.toISOString ? r.started_at.toISOString() : String(r.started_at),
      currentPeriodEnd: parseInt(r.current_period_end, 10),
      canceledAt: r.canceled_at ? (r.canceled_at.toISOString ? r.canceled_at.toISOString() : String(r.canceled_at)) : undefined,
      cancelAtPeriodEnd: r.cancel_at_period_end,
      lastEventCreated: r.last_event_created ? parseInt(r.last_event_created, 10) : undefined,
      providerLivemode: r.provider_livemode,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async getEnrollmentBySubscriptionId(subscriptionId: string): Promise<FoundersEnrollment | null> {
    const res = await this.pool.query(
      `SELECT * FROM founders_enrollments WHERE provider_subscription_id = $1`,
      [subscriptionId],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      eligibilityId: r.eligibility_id,
      immutableAccountId: r.immutable_account_id,
      companyId: r.company_id,
      providerCustomerId: r.provider_customer_id,
      providerSubscriptionId: r.provider_subscription_id,
      providerPriceId: r.provider_price_id,
      subscriptionStatus: r.subscription_status,
      startedAt: r.started_at.toISOString ? r.started_at.toISOString() : String(r.started_at),
      currentPeriodEnd: parseInt(r.current_period_end, 10),
      canceledAt: r.canceled_at ? (r.canceled_at.toISOString ? r.canceled_at.toISOString() : String(r.canceled_at)) : undefined,
      cancelAtPeriodEnd: r.cancel_at_period_end,
      lastEventCreated: r.last_event_created ? parseInt(r.last_event_created, 10) : undefined,
      providerLivemode: r.provider_livemode,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async saveEnrollment(enrollment: FoundersEnrollment): Promise<void> {
    await this.pool.query(
      `INSERT INTO founders_enrollments (
        id, eligibility_id, immutable_account_id, company_id,
        provider_customer_id, provider_subscription_id, provider_price_id,
        subscription_status, started_at, current_period_end, canceled_at,
        cancel_at_period_end, last_event_created, provider_livemode,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        subscription_status = EXCLUDED.subscription_status,
        current_period_end = EXCLUDED.current_period_end,
        canceled_at = EXCLUDED.canceled_at,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        last_event_created = EXCLUDED.last_event_created,
        updated_at = EXCLUDED.updated_at`,
      [
        enrollment.id,
        enrollment.eligibilityId,
        enrollment.immutableAccountId,
        enrollment.companyId,
        enrollment.providerCustomerId,
        enrollment.providerSubscriptionId,
        enrollment.providerPriceId,
        enrollment.subscriptionStatus,
        enrollment.startedAt,
        enrollment.currentPeriodEnd,
        enrollment.canceledAt || null,
        enrollment.cancelAtPeriodEnd ?? false,
        enrollment.lastEventCreated || null,
        enrollment.providerLivemode,
        enrollment.createdAt,
        enrollment.updatedAt,
      ],
    );
  }

  async deleteEnrollment(companyId: CompanyId, accountId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM founders_enrollments WHERE company_id = $1 AND immutable_account_id = $2`,
      [companyId, accountId],
    );
  }

  async claimEvent(eventId: string): Promise<boolean> {
    // Re-throw any database errors; never swallow DB/permission failures as duplicate (resolves M6)
    const res = await this.pool.query(
      `INSERT INTO founders_processed_events (event_id, company_id, status, created_at)
       VALUES ($1, 'in_flight', 'processing', CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [eventId],
    );
    if (res.rows.length > 0) {
      return true;
    }
    // Row exists: if completed or processing, return false for duplicate/in-flight
    return false;
  }

  async releaseEventClaim(eventId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM founders_processed_events WHERE event_id = $1 AND company_id = 'in_flight'`,
      [eventId],
    );
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT event_id FROM founders_processed_events WHERE event_id = $1`,
      [eventId],
    );
    return res.rows.length > 0;
  }

  async recordProcessedEvent(eventId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO founders_processed_events (event_id, company_id, status, created_at)
       VALUES ($1, 'completed', 'completed', CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO UPDATE SET company_id = 'completed', status = 'completed', updated_at = CURRENT_TIMESTAMP`,
      [eventId],
    );
  }

  async saveAuditEntry(entry: FoundersAuditEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO founders_audit_trail (
        id, company_id, immutable_account_id, actor_id, event_type, event_id, price_id, mode, details, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.id,
        entry.companyId,
        entry.immutableAccountId,
        entry.actorId,
        entry.eventType,
        entry.eventId || null,
        entry.priceId || null,
        entry.mode,
        JSON.stringify(entry.details),
        entry.timestamp,
      ],
    );
  }

  async getAuditTrail(accountId: string): Promise<FoundersAuditEntry[]> {
    const res = await this.pool.query(
      `SELECT * FROM founders_audit_trail WHERE immutable_account_id = $1 ORDER BY timestamp ASC`,
      [accountId],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      immutableAccountId: r.immutable_account_id,
      actorId: r.actor_id,
      eventType: r.event_type,
      eventId: r.event_id,
      priceId: r.price_id,
      mode: r.mode,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      timestamp: r.timestamp.toISOString ? r.timestamp.toISOString() : String(r.timestamp),
    }));
  }

  /**
   * Portfolio-wide qualified account counting:
   * When companyId is omitted, queries founders_pilot_counter or counts DISTINCT accounts across ALL brands.
   */
  async getQualifiedAccountCount(companyId?: CompanyId): Promise<number> {
    if (companyId) {
      const res = await this.pool.query(
        `SELECT COUNT(DISTINCT immutable_account_id) as cnt
         FROM founders_eligibilities
         WHERE company_id = $1 AND eligibility_status != 'ineligible_duplicate'`,
        [companyId],
      );
      return parseInt(res.rows[0].cnt, 10);
    } else {
      const counterRes = await this.pool.query(
        `SELECT total_ever_admitted FROM founders_pilot_counter WHERE id = 'portfolio_cap'`,
      );
      if (counterRes.rows.length > 0 && parseInt(counterRes.rows[0].total_ever_admitted, 10) > 0) {
        return parseInt(counterRes.rows[0].total_ever_admitted, 10);
      }
      const res = await this.pool.query(
        `SELECT COUNT(DISTINCT immutable_account_id) as cnt
         FROM founders_eligibilities
         WHERE eligibility_status != 'ineligible_duplicate'`,
      );
      return parseInt(res.rows[0].cnt, 10);
    }
  }

  async withTransaction<T>(fn: (txnStore: IFoundersStore) => Promise<T>): Promise<T> {
    if ('connect' in this.pool && typeof (this.pool as any).connect === 'function') {
      const client: PoolClient = await (this.pool as Pool).connect();
      try {
        await client.query('BEGIN');
        const txnStore = new PostgresFoundersStore(client);
        const result = await fn(txnStore);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      return fn(this);
    }
  }
}

/**
 * PostgreSQL-backed durable store for Founders cost metering and ledger persistence.
 * Implements transactional SQL against founders_cost_reservations and founders_cost_ledger.
 */
export class PostgresFoundersCostStore implements IFoundersCostStore {
  constructor(private pool: Pool | PoolClient) {}

  async getLedger(companyId: CompanyId, accountId: string, monthWindow: string): Promise<AccountUsageLedger> {
    const accountUuid = toUuid(accountId);
    const ledgerId = `ledger_${companyId}_${accountUuid}_${monthWindow}`;

    // Ensure initial row exists for safe row-locking and idempotency
    await this.pool.query(
      `INSERT INTO founders_cost_ledger (
        id, company_id, immutable_account_id, month_window,
        total_settled_cost_usd, total_reserved_cost_usd,
        total_units_consumed, total_units_reserved,
        active_concurrency, overage_flag, updated_at
      ) VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 0, FALSE, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, immutable_account_id, month_window) DO NOTHING`,
      [ledgerId, companyId, accountUuid, monthWindow],
    );

    const res = await this.pool.query(
      `SELECT * FROM founders_cost_ledger
       WHERE company_id = $1 AND immutable_account_id = $2 AND month_window = $3`,
      [companyId, accountUuid, monthWindow],
    );
    if (res.rows.length === 0) {
      return {
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
    }
    const r = res.rows[0];
    return {
      companyId: r.company_id,
      accountId,
      monthWindow: r.month_window,
      totalSettledCostUsd: parseFloat(r.total_settled_cost_usd),
      totalReservedCostUsd: parseFloat(r.total_reserved_cost_usd),
      totalUnitsConsumed: parseInt(r.total_units_consumed, 10),
      totalUnitsReserved: parseInt(r.total_units_reserved, 10),
      activeConcurrency: parseInt(r.active_concurrency, 10),
      overageFlag: Boolean(r.overage_flag),
    };
  }

  async saveLedger(ledger: AccountUsageLedger): Promise<void> {
    const accountUuid = toUuid(ledger.accountId);
    const ledgerId = `ledger_${ledger.companyId}_${accountUuid}_${ledger.monthWindow}`;
    await this.pool.query(
      `INSERT INTO founders_cost_ledger (
        id, company_id, immutable_account_id, month_window,
        total_settled_cost_usd, total_reserved_cost_usd,
        total_units_consumed, total_units_reserved,
        active_concurrency, overage_flag, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, immutable_account_id, month_window)
      DO UPDATE SET
        total_settled_cost_usd = EXCLUDED.total_settled_cost_usd,
        total_reserved_cost_usd = EXCLUDED.total_reserved_cost_usd,
        total_units_consumed = EXCLUDED.total_units_consumed,
        total_units_reserved = EXCLUDED.total_units_reserved,
        active_concurrency = EXCLUDED.active_concurrency,
        overage_flag = EXCLUDED.overage_flag,
        updated_at = CURRENT_TIMESTAMP`,
      [
        ledgerId,
        ledger.companyId,
        accountUuid,
        ledger.monthWindow,
        ledger.totalSettledCostUsd,
        ledger.totalReservedCostUsd,
        ledger.totalUnitsConsumed,
        ledger.totalUnitsReserved,
        ledger.activeConcurrency,
        ledger.overageFlag,
      ],
    );
  }

  async getReservation(reservationId: string): Promise<UsageReservation | null> {
    const res = await this.pool.query(
      `SELECT * FROM founders_cost_reservations WHERE id = $1`,
      [reservationId],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      accountId: r.immutable_account_id,
      monthWindow: r.month_window,
      modelKey: r.model_key,
      estimatedUnits: parseInt(r.estimated_units, 10),
      reservedCostUsd: parseFloat(r.reserved_cost_usd),
      status: r.status,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async saveReservation(reservation: UsageReservation): Promise<void> {
    const accountUuid = toUuid(reservation.accountId);
    await this.pool.query(
      `INSERT INTO founders_cost_reservations (
        id, company_id, immutable_account_id, month_window,
        model_key, estimated_units, reserved_cost_usd,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at`,
      [
        reservation.id,
        reservation.companyId,
        accountUuid,
        reservation.monthWindow,
        reservation.modelKey,
        reservation.estimatedUnits,
        reservation.reservedCostUsd,
        reservation.status,
        reservation.createdAt,
        reservation.updatedAt,
      ],
    );
  }

  async listActiveReservations(accountId: string): Promise<UsageReservation[]> {
    const accountUuid = toUuid(accountId);
    const res = await this.pool.query(
      `SELECT * FROM founders_cost_reservations
       WHERE immutable_account_id = $1 AND status = 'reserved'
       ORDER BY created_at ASC`,
      [accountUuid],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      accountId: r.immutable_account_id,
      monthWindow: r.month_window,
      modelKey: r.model_key,
      estimatedUnits: parseInt(r.estimated_units, 10),
      reservedCostUsd: parseFloat(r.reserved_cost_usd),
      status: r.status,
      createdAt: r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at.toISOString ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }

  async withTransaction<T>(fn: (txnStore: PostgresFoundersCostStore) => Promise<T>): Promise<T> {
    if ('connect' in this.pool && typeof (this.pool as any).connect === 'function') {
      const client: PoolClient = await (this.pool as Pool).connect();
      try {
        await client.query('BEGIN');
        const txnStore = new PostgresFoundersCostStore(client);
        const result = await fn(txnStore);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      return fn(this);
    }
  }
}
