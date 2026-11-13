/**
 * Canonical domain types for Account-Bound Founders Beta Subscription Architecture.
 * Directives:
 * - STOP-ONE-DOLLAR-ROLL OUT-FOUNDERS-4-99-20261112.md
 * - CONFIRMED-FOUNDERS-4-99-MONTHLY-20261112.md
 * - FINAL-FOUNDERS-499-3-5-ACTIVE-ONLY-QA-20261112.md (P0 Founder Policy Supersession)
 * - Claude QA Plan (reviews/founders-499-adversarial-baseline-claude-20261113.md)
 */

export type CompanyId =
  | 'tiqology'
  | 'zuri'
  | 'riley'
  | 'rreal'
  | 'reel2real'
  | 'inboxedge'
  | 'ifilms'
  | 'shopify_stores';

export type OfferState = 'draft' | 'active' | 'retired';

/**
 * P0 POLICY UPDATE: 'canceled_grace' is REVOKED.
 * Any cancellation or account closure immediately transitions eligibility to 'forfeited'.
 * Forfeited eligibility permanently loses the $4.99 rate; returning signups pay market rate.
 */
export type EligibilityStatus =
  | 'eligible'
  | 'enrolled'
  | 'forfeited'
  | 'ineligible_duplicate'
  | 'revoked';

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'trialing';

export type AuditEventType =
  | 'qualified'
  | 'consent_recorded'
  | 'checkout_initiated'
  | 'enrolled'
  | 'renewed'
  | 'canceled'
  | 'cancellation_requested'
  | 'rate_forfeited'
  | 'forfeited'
  | 'market_rate_offered'
  | 'duplicate_rejected'
  | 'payment_failed'
  | 'recovered'
  | 'account_closed'
  | 'legacy_subscriber_preserved';

export interface RulesEngineConfig {
  livemode?: boolean;
  environment?: string; // 'development' | 'production'
  maxPilotAccounts?: number; // default 5
}

export interface FoundersOffer {
  id: string;
  companyId: CompanyId;
  merchantContext: string;
  offerVersion: number;
  currency: string; // 'usd'
  unitAmount: number; // 499 ($4.99 in cents)
  billingInterval: 'month' | 'year'; // parameterised; default 'month'
  state: OfferState;
  deliverables: string[];
  betaTermsVersion: string;
  enrollmentWindow?: {
    startsAt: string;
    endsAt?: string;
  };
  termsHash: string; // SHA-256 of deliverables + unitAmount + interval + betaTermsVersion
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedAccount {
  accountId: string; // UUID of immutable account
  registeredAt: string;
  authVerified: boolean;
  isClosed?: boolean; // If closed/deactivated, rate is permanently forfeited
  tenantId?: string;
  recoveryState?: {
    isRecovered: boolean;
    recoveredAt?: string;
  };
  identitySignals?: {
    emailHash?: string; // SHA256 of lowercase email (never raw email)
    paymentFingerprint?: string;
    deviceFingerprint?: string;
    billingNameHash?: string;
  };
}

export interface FoundersEligibility {
  id: string;
  companyId: CompanyId;
  immutableAccountId: string; // UUID
  originalRegisteredAt: string;
  qualifiedAt: string;
  founderOfferId: string;
  eligibilityStatus: EligibilityStatus;
  immutableSourceEvidence: {
    qualifyingEvent: string;
    termsHash: string;
    termsVersion: string;
    consentTimestamp: string;
    forfeitedAt?: string;
    forfeitedReason?: string;
    forfeitReason?: string;
    clientIpHash?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FoundersEnrollment {
  id: string;
  eligibilityId: string;
  immutableAccountId: string;
  companyId: CompanyId;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerPriceId: string;
  subscriptionStatus: SubscriptionStatus;
  startedAt: string;
  currentPeriodEnd: number; // Unix epoch timestamp in seconds
  canceledAt?: string;
  cancelAtPeriodEnd?: boolean;
  lastEventCreated?: number; // Epoch timestamp of last applied Stripe webhook event
  providerLivemode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FoundersAuditEntry {
  id: string;
  companyId: CompanyId;
  immutableAccountId: string;
  actorId: string;
  eventType: AuditEventType;
  eventId?: string | null;
  priceId?: string | null;
  mode: 'test' | 'live';
  details: Record<string, unknown>;
  timestamp: string;
}

export interface TermsConsent {
  termsVersion: string;
  termsHash: string;
  affirmativeConsent: boolean;
  consentTimestamp: string;
}

export interface EntitlementResult {
  hasActiveEntitlement: boolean;
  isFoundersRateLocked: boolean;
  subscriptionStatus?: SubscriptionStatus | 'none';
  currentPeriodEnd?: number;
  accountStatus: EligibilityStatus;
  companyId: CompanyId;
  accountId: string;
  planRate?: number;
  reason?: string;
}

export interface WebhookEventPayload {
  id: string; // evt_...
  type: string;
  livemode: boolean;
  created: number; // Stripe event creation timestamp in seconds
  data: {
    object: {
      id: string; // sub_..., cs_..., etc.
      customer?: string;
      status?: string;
      current_period_end?: number;
      canceled_at?: number | null;
      cancel_at_period_end?: boolean;
      items?: {
        data: Array<{
          price: {
            id: string;
            unit_amount: number;
            currency: string;
            recurring?: {
              interval: string;
            };
          };
        }>;
      };
      client_reference_id?: string; // accountId (UUID)
      metadata?: Record<string, string>;
    };
  };
}

export interface CompanyFitRecord {
  companyId: CompanyId;
  name: string;
  legalSeller: string;
  businessModel: string;
  fitStatus: 'eligible' | 'conditional' | 'excluded' | 'excluded_from_full_service' | 'excluded_from_production';
  foundersOfferUnitAmount: number; // 499
  inclusions: string[];
  exclusions: string[];
  usageCapsAndMargin: {
    maxComputeUnitsMonthly?: number;
    maxInvocationsMonthly?: number;
    marginFloorPercent: number;
    concurrencyCap?: number;
  };
  supportTerms: string;
  cancellationRefundTerms: string;
  openFounderDecisions: string[];
}
