import * as crypto from 'crypto';
import {
  AuthenticatedAccount,
  CompanyId,
  EntitlementResult,
  FoundersEligibility,
  FoundersEnrollment,
  FoundersOffer,
  RulesEngineConfig,
  TermsConsent,
  WebhookEventPayload,
} from './types';
import { COMPANY_PILOT_CONFIG } from './company-inventory';

export interface IFoundersStore {
  getOffer(companyId: CompanyId): Promise<FoundersOffer | null>;
  saveOffer(offer: FoundersOffer): Promise<void>;
  getEligibility(companyId: CompanyId, accountId: string): Promise<FoundersEligibility | null>;
  findEligibilityByIdentitySignals(
    companyId: CompanyId,
    signals?: AuthenticatedAccount['identitySignals'],
  ): Promise<FoundersEligibility | null>;
  saveEligibility(eligibility: FoundersEligibility): Promise<void>;
  indexIdentitySignals(
    companyId: CompanyId,
    accountId: string,
    signals?: AuthenticatedAccount['identitySignals'],
  ): void | Promise<void>;
  getEnrollment(companyId: CompanyId, accountId: string): Promise<FoundersEnrollment | null>;
  getEnrollmentBySubscriptionId(subscriptionId: string): Promise<FoundersEnrollment | null>;
  saveEnrollment(enrollment: FoundersEnrollment): Promise<void>;
  deleteEnrollment?(companyId: CompanyId, accountId: string): Promise<void>;
  claimEvent(eventId: string): Promise<boolean>;
  releaseEventClaim(eventId: string): Promise<void>;
  hasProcessedEvent(eventId: string): Promise<boolean>;
  recordProcessedEvent(eventId: string): Promise<void>;
  saveAuditEntry(entry: any): Promise<void>;
  getAuditTrail(accountId: string): Promise<any[]>;
  getQualifiedAccountCount(companyId?: CompanyId): Promise<number>;
  withTransaction?<T>(fn: (txnStore: IFoundersStore) => Promise<T>): Promise<T>;
  qualifyAccountWithCapCheck?(
    companyId: CompanyId,
    eligibility: FoundersEligibility,
    maxCap?: number,
  ): Promise<void>;
}

export class RateForfeitedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateForfeitedException';
  }
}

export class IneligibleAccountException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IneligibleAccountException';
  }
}

export class DuplicateAccountIneligibleException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateAccountIneligibleException';
  }
}

export class MissingAffirmativeConsentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingAffirmativeConsentException';
  }
}

export class InvalidBrandOrPriceException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBrandOrPriceException';
  }
}

export class AlreadySubscribedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadySubscribedException';
  }
}

export function computeTermsHash(
  deliverables: string[],
  unitAmount: number,
  billingInterval: string,
  termsVersion: string,
): string {
  const payload = JSON.stringify({
    deliverables: [...deliverables].sort(),
    unitAmount,
    billingInterval,
    termsVersion,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export class AccountBoundRulesEngine {
  private qualificationQueue = Promise.resolve();

  constructor(
    private store: IFoundersStore,
    private config: RulesEngineConfig = {},
  ) {}

  /**
   * Serializes qualification to defend against race conditions at the last slot.
   */
  private acquireLock(): Promise<() => void> {
    return new Promise((resolve) => {
      this.qualificationQueue = this.qualificationQueue.then(() => {
        return new Promise<void>((release) => {
          resolve(release);
        });
      });
    });
  }

  /**
   * Qualifies an authenticated account for the Founders Beta.
   * Strictly enforces PORTFOLIO-WIDE limit of 3-5 total accounts across all brands.
   */
  async qualifyAccount(
    companyId: CompanyId,
    account: AuthenticatedAccount,
  ): Promise<any> {
    const release = await this.acquireLock();
    try {
      const runQualification = async (txnStore: IFoundersStore) => {
        if (!account.authVerified) {
          throw new IneligibleAccountException('Account auth must be verified prior to beta qualification');
        }

        if (account.isClosed) {
          throw new RateForfeitedException(
            `Account ${account.accountId} is closed or deactivated; Founders rate is permanently forfeited`,
          );
        }

        const offer = await txnStore.getOffer(companyId);

        // Check if duplicate identity signals already exist on another account
        const existingDuplicate = await txnStore.findEligibilityByIdentitySignals(
          companyId,
          account.identitySignals,
        );
        if (existingDuplicate && existingDuplicate.immutableAccountId !== account.accountId) {
          const dupEligibility: FoundersEligibility = {
            id: `elig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            companyId,
            immutableAccountId: account.accountId,
            originalRegisteredAt: account.registeredAt,
            qualifiedAt: new Date().toISOString(),
            founderOfferId: offer ? offer.id : 'unknown',
            eligibilityStatus: 'ineligible_duplicate',
            immutableSourceEvidence: {
              qualifyingEvent: 'duplicate_signal_match',
              termsHash: '',
              termsVersion: '',
              consentTimestamp: new Date().toISOString(),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await txnStore.saveEligibility(dupEligibility);

          throw new DuplicateAccountIneligibleException(
            `Account ${account.accountId} matches identity signals of previously registered account ${existingDuplicate.immutableAccountId}. Rate lock cannot be inherited.`,
          );
        }

        // Check existing eligibility on this account
        const existing = await txnStore.getEligibility(companyId, account.accountId);
        if (existing) {
          if (existing.eligibilityStatus === 'forfeited' || existing.eligibilityStatus === 'revoked') {
            throw new RateForfeitedException(
              `Account ${account.accountId} has permanently forfeited the Founders rate upon cancellation or closure.`,
            );
          }
          return Object.assign(existing, { eligibility: existing, offer });
        }

        if (!offer || offer.state !== 'active') {
          throw new IneligibleAccountException(`No active Founders offer found for company ${companyId}`);
        }

        const maxPilot = this.config.maxPilotAccounts ?? 5;

        const eligibility: FoundersEligibility = {
          id: `elig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          immutableAccountId: account.accountId,
          originalRegisteredAt: account.registeredAt,
          qualifiedAt: new Date().toISOString(),
          founderOfferId: offer.id,
          eligibilityStatus: 'eligible',
          immutableSourceEvidence: {
            qualifyingEvent: 'manual_admin_or_sandbox_qualification',
            termsHash: offer.termsHash,
            termsVersion: offer.betaTermsVersion,
            consentTimestamp: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Enforce PORTFOLIO-WIDE pilot capacity in DB row-lock or memory store
        if (txnStore.qualifyAccountWithCapCheck) {
          await txnStore.qualifyAccountWithCapCheck(companyId, eligibility, maxPilot);
        } else {
          const totalPortfolioQualified = await txnStore.getQualifiedAccountCount();
          if (totalPortfolioQualified >= maxPilot) {
            throw new IneligibleAccountException(
              `Portfolio-wide pilot capacity limit of ${maxPilot} business accounts reached across all companies`,
            );
          }
          await txnStore.saveEligibility(eligibility);
        }

        // Auto-index identity signals in store for subsequent duplicate detection
        if (txnStore.indexIdentitySignals) {
          await txnStore.indexIdentitySignals(companyId, account.accountId, account.identitySignals);
        }

        await txnStore.saveAuditEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          immutableAccountId: account.accountId,
          actorId: account.accountId,
          eventType: 'qualified',
          eventId: null,
          priceId: offer.id,
          mode: this.config.livemode ? 'live' : 'test',
          details: { offerId: offer.id, unitAmount: offer.unitAmount },
          timestamp: new Date().toISOString(),
        });

        return Object.assign(eligibility, { eligibility, offer });
      };

      if (this.store.withTransaction) {
        return await this.store.withTransaction(runQualification);
      } else {
        return await runQualification(this.store);
      }
    } finally {
      release();
    }
  }

  /**
   * Creates a checkout session config for an eligible account.
   */
  async createCheckoutSession(
    companyId: CompanyId,
    accountId: string,
    consent: TermsConsent,
  ): Promise<any> {
    // 1. Guard against double-billing: cannot checkout if already actively subscribed
    const enrollment = await this.store.getEnrollment(companyId, accountId);
    if (
      enrollment &&
      ['active', 'trialing'].includes(enrollment.subscriptionStatus) &&
      !enrollment.cancelAtPeriodEnd
    ) {
      throw new AlreadySubscribedException(
        `Account ${accountId} already has active subscription ${enrollment.providerSubscriptionId}`,
      );
    }

    // 2. Check eligibility status
    const eligibility = await this.store.getEligibility(companyId, accountId);
    if (!eligibility) {
      throw new IneligibleAccountException(`Account ${accountId} has not been qualified for Founders Beta`);
    }

    if (eligibility.eligibilityStatus === 'forfeited' || eligibility.eligibilityStatus === 'revoked') {
      throw new RateForfeitedException(
        `Account ${accountId} has permanently forfeited the $4.99 rate upon cancellation or closure. Returning signups must pay market rate.`,
      );
    }

    if (eligibility.eligibilityStatus === 'ineligible_duplicate') {
      throw new DuplicateAccountIneligibleException(
        `Account ${accountId} was identified as a duplicate account and cannot enroll at Founders rate`,
      );
    }

    // 3. Affirmative consent verification
    if (!consent.affirmativeConsent) {
      throw new MissingAffirmativeConsentException('Explicit affirmative consent is required to enroll');
    }

    const offer = await this.store.getOffer(companyId);
    if (!offer || offer.state !== 'active') {
      throw new IneligibleAccountException(`Founders offer is unavailable for company ${companyId}`);
    }

    if (consent.termsHash !== offer.termsHash) {
      throw new Error('Terms hash mismatch: consent was recorded for a different terms version');
    }

    const cfg = COMPANY_PILOT_CONFIG[companyId];
    const env = this.config.environment ?? (this.config.livemode ? 'production' : 'development');

    const checkoutSessionConfig = {
      mode: 'subscription',
      client_reference_id: accountId,
      line_items: [
        {
          price: cfg ? cfg.foundersPriceId : `price_${companyId}_founders_499_monthly`,
          quantity: 1,
        },
      ],
      metadata: {
        company_id: companyId,
        brand: companyId,
        client_reference_id: accountId,
        terms_version: consent.termsVersion,
        terms_hash: consent.termsHash,
        environment: env,
      },
      subscription_data: {
        metadata: {
          company_id: companyId,
          brand: companyId,
          client_reference_id: accountId,
          is_founders_rate_locked: 'true',
        },
      },
    };

    await this.store.saveAuditEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      immutableAccountId: accountId,
      actorId: accountId,
      eventType: 'checkout_initiated',
      eventId: null,
      priceId: cfg ? cfg.foundersPriceId : `price_${companyId}_founders_499_monthly`,
      mode: this.config.livemode ? 'live' : 'test',
      details: { environment: env },
      timestamp: new Date().toISOString(),
    });

    return { checkoutSessionConfig };
  }

  /**
   * Reactivate subscription attempt: permanently refused if canceled or forfeited under P0 policy.
   */
  async reactivateSubscription(
    companyId: CompanyId,
    accountId: string,
    consent: TermsConsent,
  ): Promise<any> {
    const eligibility = await this.store.getEligibility(companyId, accountId);
    if (!eligibility || eligibility.eligibilityStatus === 'forfeited' || eligibility.eligibilityStatus === 'revoked') {
      throw new RateForfeitedException(
        `Account ${accountId} has permanently forfeited the Founders rate upon cancellation or closure`,
      );
    }
    return this.createCheckoutSession(companyId, accountId, consent);
  }

  /**
   * Permanent account closure / deactivation path (Rule P0 / Claude P4).
   */
  async closeAccount(companyId: CompanyId, accountId: string): Promise<{ status: string }> {
    return this.handleAccountClosure(companyId, accountId);
  }

  async handleAccountClosure(companyId: CompanyId, accountId: string): Promise<{ status: string }> {
    await this.forfeitEligibility(companyId, accountId, 'account_closed');
    return { status: 'account_closed_rate_forfeited' };
  }

  /**
   * Forfeits eligibility permanently.
   */
  async forfeitEligibility(companyId: CompanyId, accountId: string, reason: string = 'manual_or_account_closed'): Promise<void> {
    const eligibility = await this.store.getEligibility(companyId, accountId);
    if (eligibility) {
      eligibility.eligibilityStatus = 'forfeited';
      eligibility.immutableSourceEvidence = {
        ...eligibility.immutableSourceEvidence,
        forfeitedAt: new Date().toISOString(),
        forfeitedReason: reason,
        forfeitReason: reason,
      };
      await this.store.saveEligibility(eligibility);
    }

    const enrollment = await this.store.getEnrollment(companyId, accountId);
    if (enrollment) {
      // Synchronously cancel enrollment on account closure / forfeiture (resolves M5b)
      if (reason === 'account_closed' || reason.includes('closed')) {
        enrollment.subscriptionStatus = 'canceled';
        enrollment.canceledAt = new Date().toISOString();
      }
      enrollment.cancelAtPeriodEnd = true;
      await this.store.saveEnrollment(enrollment);
    }

    await this.store.saveAuditEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      immutableAccountId: accountId,
      actorId: 'system',
      eventType: 'account_closed',
      eventId: null,
      priceId: null,
      mode: this.config.livemode ? 'live' : 'test',
      details: { reason },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generates a checkout session at standard market rate ($29/mo or $49/mo)
   */
  async createMarketRateCheckoutSession(companyId: CompanyId, accountId: string): Promise<any> {
    const cfg = COMPANY_PILOT_CONFIG[companyId];
    const env = this.config.environment ?? (this.config.livemode ? 'production' : 'development');

    return {
      checkoutSessionConfig: {
        mode: 'subscription',
        client_reference_id: accountId,
        line_items: [
          {
            price: cfg ? cfg.standardMarketPriceId : `price_${companyId}_standard_29_monthly`,
            quantity: 1,
          },
        ],
        metadata: {
          company_id: companyId,
          brand: companyId,
          client_reference_id: accountId,
          environment: env,
          rate_tier: 'standard_market',
        },
      },
    };
  }

  /**
   * Account recovery verification. Refuses forfeited/cancelled accounts and empty proof strings.
   */
  async recoverAccount(
    companyId: CompanyId,
    accountId: string,
    proof: { verificationMethod: string; recoveryTokenId: string },
  ): Promise<any> {
    if (
      !proof ||
      !proof.verificationMethod ||
      !proof.recoveryTokenId ||
      proof.verificationMethod.trim() === '' ||
      proof.recoveryTokenId.trim() === ''
    ) {
      throw new Error('Recovery requires real verified authentication proof (empty proof rejected)');
    }

    const eligibility = await this.store.getEligibility(companyId, accountId);
    if (!eligibility) {
      throw new IneligibleAccountException(`Account ${accountId} not found`);
    }

    if (eligibility.eligibilityStatus === 'forfeited' || eligibility.eligibilityStatus === 'revoked') {
      throw new RateForfeitedException(
        `Account ${accountId} was forfeited or revoked; cannot be recovered into Founders rate`,
      );
    }

    await this.store.saveAuditEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      immutableAccountId: accountId,
      actorId: 'auth_recovery_service',
      eventType: 'recovered',
      eventId: null,
      priceId: null,
      mode: this.config.livemode ? 'live' : 'test',
      details: { proofMethod: proof.verificationMethod },
      timestamp: new Date().toISOString(),
    });

    return Object.assign(eligibility, { recovered: true, eligibility });
  }

  /**
   * Company-scoped payment failure handler.
   */
  async handlePaymentFailure(companyId: CompanyId, subscriptionId: string): Promise<void> {
    const enrollment = await this.store.getEnrollmentBySubscriptionId(subscriptionId);
    if (!enrollment) return;

    if (enrollment.companyId !== companyId) {
      // Cross-company mutation strictly forbidden
      return;
    }

    enrollment.subscriptionStatus = 'past_due';
    await this.store.saveEnrollment(enrollment);

    await this.store.saveAuditEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      immutableAccountId: enrollment.immutableAccountId,
      actorId: 'stripe_payment_engine',
      eventType: 'payment_failed',
      eventId: null,
      priceId: enrollment.providerPriceId,
      mode: this.config.livemode ? 'live' : 'test',
      details: { subscriptionId, status: 'past_due' },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Checks current access entitlement and rate lock status.
   */
  async checkEntitlement(companyId: CompanyId, accountId: string): Promise<EntitlementResult> {
    const enrollment = await this.store.getEnrollment(companyId, accountId);
    const eligibility = await this.store.getEligibility(companyId, accountId);
    const now = Math.floor(Date.now() / 1000);

    const hasActivePeriod = enrollment ? enrollment.currentPeriodEnd > now : false;
    // Paid through access persists until currentPeriodEnd even if subscriptionStatus is canceled
    const hasActiveEntitlement = Boolean(
      enrollment &&
      hasActivePeriod &&
      ['active', 'trialing', 'canceled'].includes(enrollment.subscriptionStatus),
    );

    // Rate lock is active ONLY while the subscription stays continuously active and not canceled/forfeited
    const isFoundersRateLocked = Boolean(
      eligibility &&
      eligibility.eligibilityStatus === 'enrolled' &&
      enrollment &&
      ['active', 'trialing'].includes(enrollment.subscriptionStatus) &&
      !enrollment.cancelAtPeriodEnd &&
      hasActivePeriod,
    );

    return {
      accountId,
      companyId,
      hasActiveEntitlement,
      isFoundersRateLocked,
      subscriptionStatus: enrollment ? enrollment.subscriptionStatus : 'none',
      currentPeriodEnd: enrollment ? enrollment.currentPeriodEnd : 0,
      accountStatus: eligibility ? eligibility.eligibilityStatus : 'forfeited',
      planRate: isFoundersRateLocked ? 499 : 2900,
    };
  }

  /**
   * Processes Stripe webhooks with exact idempotency, event ordering, brand isolation, and P0 forfeiture.
   */
  async processSubscriptionWebhook(
    companyId: CompanyId,
    event: WebhookEventPayload,
  ): Promise<{ status: string }> {
    if (this.store.withTransaction) {
      return this.store.withTransaction((txnStore) =>
        new AccountBoundRulesEngine(txnStore, this.config).executeWebhook(companyId, event),
      );
    }
    return this.executeWebhook(companyId, event);
  }

  private async executeWebhook(
    companyId: CompanyId,
    event: WebhookEventPayload,
  ): Promise<{ status: string }> {
    // 1. Store-level durable event claiming (works across multiple engine instances)
    const claimed = await this.store.claimEvent(event.id);
    if (!claimed) {
      return { status: 'already_processed_idempotent' };
    }

    const subObj = event.data.object;
    const metadata = subObj?.metadata || {};
    const accountId = subObj?.client_reference_id || metadata?.user_id || metadata?.account_id;
    const itemPrice = subObj.items?.data?.[0]?.price;
    const priceId = itemPrice?.id;

    // Snapshot prior state for transactional atomicity & rollback on failure
    const existingEnrollment = accountId ? await this.store.getEnrollment(companyId, accountId) : null;
    const existingEligibility = accountId ? await this.store.getEligibility(companyId, accountId) : null;

    try {
      // 2. Legacy Rreal $1 Subscriber Protection (checked by EXACT price ID only)
      const isLegacyPrice = priceId === 'price_1UXevHK68Pw0CGHvMMNt6NeD' || priceId === 'price_rreal_1dollar_monthly';
      if (companyId === 'rreal' && isLegacyPrice) {
        await this.store.saveAuditEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          immutableAccountId: accountId || 'legacy_rreal_subscriber',
          actorId: 'system_webhook',
          eventType: 'legacy_subscriber_preserved',
          eventId: event.id,
          priceId: priceId,
          mode: event.livemode ? 'live' : 'test',
          details: { reason: 'Untouched legacy Rreal $1 subscriber preserved' },
          timestamp: new Date().toISOString(),
        });
        await this.store.recordProcessedEvent(event.id);
        return { status: 'legacy_subscriber_preserved' };
      }

      // 3. Mode isolation (test vs live)
      const expectedLivemode = Boolean(this.config.livemode ?? false);
      if (Boolean(event.livemode) !== expectedLivemode) {
        throw new InvalidBrandOrPriceException(
          `Event livemode (${event.livemode}) does not match configured engine mode (${expectedLivemode})`,
        );
      }

      // 4. Status validation
      const VALID_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'canceled'];
      if (subObj.status && !VALID_STATUSES.includes(subObj.status)) {
        throw new Error(`Invalid subscription status: ${subObj.status}`);
      }

      // 5. Brand Isolation
      const cfg = COMPANY_PILOT_CONFIG[companyId];
      if (metadata.company_id && metadata.company_id !== companyId) {
        throw new InvalidBrandOrPriceException(
          `Brand mismatch: webhook company_id '${metadata.company_id}' does not match context '${companyId}'`,
        );
      }
      if (metadata.brand && metadata.brand !== companyId && metadata.brand !== (cfg ? cfg.name.toLowerCase() : companyId)) {
        throw new InvalidBrandOrPriceException(
          `Brand mismatch: webhook brand '${metadata.brand}' does not match '${companyId}'`,
        );
      }

      // 6. Price Allow-List Check
      const configuredPrices = [
        process.env.STRIPE_FOUNDERS_PRICE_ID,
        process.env.NEXT_PUBLIC_STRIPE_FOUNDERS_PRICE_ID,
        cfg ? cfg.foundersPriceId : `price_${companyId}_founders_499_monthly`,
      ].filter(Boolean);
      const allowedFoundersPrice = (configuredPrices[0] as string) || (cfg ? cfg.foundersPriceId : `price_${companyId}_founders_499_monthly`);
      if (priceId && !configuredPrices.includes(priceId)) {
        if (priceId.includes('standard') || priceId.includes('29')) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'non_founders_price_ignored' };
        }
        throw new InvalidBrandOrPriceException(
          `Price '${priceId}' is not an approved Founders Beta price for company ${companyId}`,
        );
      }

      if (!accountId) {
        throw new Error('client_reference_id missing from webhook data object');
      }

      // 7. Handle customer.subscription.deleted
      if (event.type === 'customer.subscription.deleted') {
        if (existingEnrollment && existingEnrollment.providerSubscriptionId !== subObj.id) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'ignored_unrelated_subscription' };
        }

        if (existingEnrollment && (existingEnrollment.lastEventCreated || 0) > event.created) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'stale_active_ignored' };
        }

        const eligibility = await this.store.getEligibility(companyId, accountId);
        if (eligibility) {
          eligibility.eligibilityStatus = 'forfeited';
          eligibility.immutableSourceEvidence = {
            ...eligibility.immutableSourceEvidence,
            forfeitedAt: new Date().toISOString(),
            forfeitedReason: 'subscription_canceled',
            forfeitReason: 'subscription_canceled',
          };
          await this.store.saveEligibility(eligibility);
        }

        const enrollment: FoundersEnrollment = {
          id: existingEnrollment?.id || `enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eligibilityId: eligibility?.id || 'unknown_eligibility',
          immutableAccountId: accountId,
          companyId,
          providerCustomerId: subObj.customer || 'cus_unknown',
          providerSubscriptionId: subObj.id,
          providerPriceId: priceId || allowedFoundersPrice,
          subscriptionStatus: 'canceled',
          startedAt: existingEnrollment?.startedAt || new Date().toISOString(),
          currentPeriodEnd: subObj.current_period_end || Math.floor(Date.now() / 1000),
          canceledAt: new Date().toISOString(),
          cancelAtPeriodEnd: true,
          lastEventCreated: event.created,
          providerLivemode: Boolean(event.livemode),
          createdAt: existingEnrollment?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.store.saveEnrollment(enrollment);

        await this.store.saveAuditEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          immutableAccountId: accountId,
          actorId: 'stripe_webhook',
          eventType: 'canceled',
          eventId: event.id,
          priceId: priceId || allowedFoundersPrice,
          mode: this.config.livemode ? 'live' : 'test',
          details: { subscriptionId: subObj.id, forfeited: true },
          timestamp: new Date().toISOString(),
        });

        await this.store.recordProcessedEvent(event.id);
        return { status: 'subscription_canceled_and_rate_forfeited' };
      }

      // 8. Handle customer.subscription.created and customer.subscription.updated
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated'
      ) {
        // Enforce one active paid subscription per account (reject second subscription)
        if (
          existingEnrollment &&
          ['active', 'trialing'].includes(existingEnrollment.subscriptionStatus) &&
          existingEnrollment.providerSubscriptionId !== subObj.id
        ) {
          throw new AlreadySubscribedException(
            `Account ${accountId} already has active subscription ${existingEnrollment.providerSubscriptionId}; rejecting secondary subscription ${subObj.id}`,
          );
        }

        // Out-of-order defense
        // If already terminal (canceled), active update with <= timestamp cannot resurrect (Q5 tie rule)
        if (
          existingEnrollment &&
          existingEnrollment.subscriptionStatus === 'canceled' &&
          (existingEnrollment.lastEventCreated || 0) >= event.created
        ) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'stale_active_ignored' };
        }

        // For non-terminal, strictly older events are stale
        if (existingEnrollment && (existingEnrollment.lastEventCreated || 0) > event.created) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'stale_active_ignored' };
        }

        const eligibility = await this.store.getEligibility(companyId, accountId);

        // If subscription is canceled_at_period_end, forfeit eligibility immediately
        if (subObj.cancel_at_period_end === true) {
          if (eligibility) {
            eligibility.eligibilityStatus = 'forfeited';
            eligibility.immutableSourceEvidence = {
              ...eligibility.immutableSourceEvidence,
              forfeitedAt: new Date().toISOString(),
              forfeitedReason: 'cancellation_requested_at_period_end',
              forfeitReason: 'cancellation_requested_at_period_end',
            };
            await this.store.saveEligibility(eligibility);
          }

          if (existingEnrollment) {
            existingEnrollment.cancelAtPeriodEnd = true;
            existingEnrollment.lastEventCreated = event.created;
            await this.store.saveEnrollment(existingEnrollment);
          }

          await this.store.saveAuditEntry({
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            companyId,
            immutableAccountId: accountId,
            actorId: 'stripe_webhook',
            eventType: 'cancellation_requested',
            eventId: event.id,
            priceId: priceId || allowedFoundersPrice,
            mode: this.config.livemode ? 'live' : 'test',
            details: { reason: 'cancel_at_period_end_true' },
            timestamp: new Date().toISOString(),
          });

          await this.store.recordProcessedEvent(event.id);
          return { status: 'cancellation_requested_and_forfeited' };
        }

        // Check if previously forfeited
        if (eligibility && (eligibility.eligibilityStatus === 'forfeited' || eligibility.eligibilityStatus === 'revoked')) {
          await this.store.recordProcessedEvent(event.id);
          return { status: 'ignored_account_forfeited' };
        }

        if (eligibility && eligibility.eligibilityStatus === 'eligible') {
          eligibility.eligibilityStatus = 'enrolled';
          eligibility.updatedAt = new Date().toISOString();
          await this.store.saveEligibility(eligibility);
        }

        const enrollment: FoundersEnrollment = {
          id: existingEnrollment?.id || `enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eligibilityId: eligibility?.id || 'unlinked_eligibility',
          immutableAccountId: accountId,
          companyId,
          providerCustomerId: subObj.customer || 'cus_unknown',
          providerSubscriptionId: subObj.id,
          providerPriceId: priceId || allowedFoundersPrice,
          subscriptionStatus: (subObj.status as any) || 'active',
          startedAt: existingEnrollment?.startedAt || new Date().toISOString(),
          currentPeriodEnd: subObj.current_period_end || Math.floor(Date.now() / 1000) + 30 * 86400,
          cancelAtPeriodEnd: Boolean(subObj.cancel_at_period_end),
          lastEventCreated: event.created,
          providerLivemode: Boolean(event.livemode),
          createdAt: existingEnrollment?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.store.saveEnrollment(enrollment);

        await this.store.saveAuditEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          immutableAccountId: accountId,
          actorId: 'stripe_webhook',
          eventType: event.type === 'customer.subscription.created' ? 'enrolled' : 'renewed',
          eventId: event.id,
          priceId: priceId || allowedFoundersPrice,
          mode: this.config.livemode ? 'live' : 'test',
          details: { subscriptionId: subObj.id, status: subObj.status },
          timestamp: new Date().toISOString(),
        });

        await this.store.recordProcessedEvent(event.id);
        return { status: 'enrollment_saved' };
      }

      await this.store.recordProcessedEvent(event.id);
      return { status: 'event_type_unhandled' };
    } catch (err) {
      // Transactional atomicity: roll back state mutations on error so no partial half-state remains
      if (accountId) {
        if (existingEligibility) {
          await this.store.saveEligibility(existingEligibility);
        }
        if (existingEnrollment) {
          await this.store.saveEnrollment(existingEnrollment);
        } else if (this.store.deleteEnrollment) {
          await this.store.deleteEnrollment(companyId, accountId);
        }
      }
      await this.store.releaseEventClaim(event.id);
      throw err;
    }
  }
}

import { MemoryFoundersStore } from './memory-store';
import { PostgresFoundersStore } from './postgres-store';

let defaultEngine: AccountBoundRulesEngine | null = null;

export function getDefaultFoundersRulesEngine(): AccountBoundRulesEngine {
  if (!defaultEngine) {
    const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    if (dbUrl) {
      try {
        const { Pool } = require("pg");
        defaultEngine = new AccountBoundRulesEngine(new PostgresFoundersStore(new Pool({ connectionString: dbUrl })));
        return defaultEngine;
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Failed to initialize durable PostgresFoundersStore in production: " + (err as Error).message);
        }
      }
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Durable PostgresFoundersStore requires DATABASE_URL in production. In-memory fallback is prohibited.");
    }
    defaultEngine = new AccountBoundRulesEngine(new MemoryFoundersStore());
  }
  return defaultEngine;
}

export function setDefaultFoundersRulesEngine(engine: AccountBoundRulesEngine | null): void {
  defaultEngine = engine;
}
