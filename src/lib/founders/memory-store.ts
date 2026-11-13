import {
  AuthenticatedAccount,
  CompanyId,
  FoundersAuditEntry,
  FoundersEligibility,
  FoundersEnrollment,
  FoundersOffer,
} from './types';
import { IFoundersStore, IneligibleAccountException } from './rules-engine';

/**
 * In-memory test store implementing IFoundersStore with full signal persistence,
 * portfolio-wide counting, and atomic event claiming across multiple engine instances.
 */
export class MemoryFoundersStore implements IFoundersStore {
  private offers = new Map<CompanyId, FoundersOffer>();
  private eligibilities = new Map<string, FoundersEligibility>(); // key: `${companyId}:${accountId}`
  private enrollments = new Map<string, FoundersEnrollment>(); // key: `${companyId}:${accountId}`
  private processedEvents = new Set<string>();
  private inFlightClaims = new Set<string>();
  private auditLogs: FoundersAuditEntry[] = [];

  // Track identity signals for duplicate account detection (Rule E5)
  // key: `${companyId}:${signalType}:${signalValue}` -> accountId
  private identitySignalIndex = new Map<string, string>();

  async getOffer(companyId: CompanyId): Promise<FoundersOffer | null> {
    return this.offers.get(companyId) || null;
  }

  async saveOffer(offer: FoundersOffer): Promise<void> {
    this.offers.set(offer.companyId, offer);
  }

  async getEligibility(companyId: CompanyId, accountId: string): Promise<FoundersEligibility | null> {
    const e = this.eligibilities.get(`${companyId}:${accountId}`);
    return e ? { ...e, immutableSourceEvidence: { ...e.immutableSourceEvidence } } : null;
  }

  async findEligibilityByIdentitySignals(
    companyId: CompanyId,
    signals?: AuthenticatedAccount['identitySignals'],
  ): Promise<FoundersEligibility | null> {
    if (!signals) return null;

    if (signals.emailHash) {
      const match = this.identitySignalIndex.get(`${companyId}:email:${signals.emailHash}`);
      if (match) return this.getEligibility(companyId, match);
    }
    if (signals.paymentFingerprint) {
      const match = this.identitySignalIndex.get(`${companyId}:payment:${signals.paymentFingerprint}`);
      if (match) return this.getEligibility(companyId, match);
    }
    if (signals.deviceFingerprint) {
      const match = this.identitySignalIndex.get(`${companyId}:device:${signals.deviceFingerprint}`);
      if (match) return this.getEligibility(companyId, match);
    }
    return null;
  }

  async saveEligibility(eligibility: FoundersEligibility): Promise<void> {
    const key = `${eligibility.companyId}:${eligibility.immutableAccountId}`;
    this.eligibilities.set(key, { ...eligibility, immutableSourceEvidence: { ...eligibility.immutableSourceEvidence } });
  }

  /**
   * Qualifies account with cap check: atomically validates portfolio-wide 5-ever cap
   */
  async qualifyAccountWithCapCheck(
    companyId: CompanyId,
    eligibility: FoundersEligibility,
    maxCap: number = 5,
  ): Promise<void> {
    const total = await this.getQualifiedAccountCount();
    if (total >= maxCap) {
      throw new IneligibleAccountException(
        `Portfolio-wide pilot capacity limit of ${maxCap} business accounts reached across all companies`,
      );
    }
    await this.saveEligibility(eligibility);
  }

  /**
   * Indexes signals for an account to detect duplicate accounts
   */
  indexIdentitySignals(
    companyId: CompanyId,
    accountId: string,
    signals?: AuthenticatedAccount['identitySignals'],
  ): void {
    if (!signals) return;
    if (signals.emailHash) {
      this.identitySignalIndex.set(`${companyId}:email:${signals.emailHash}`, accountId);
    }
    if (signals.paymentFingerprint) {
      this.identitySignalIndex.set(`${companyId}:payment:${signals.paymentFingerprint}`, accountId);
    }
    if (signals.deviceFingerprint) {
      this.identitySignalIndex.set(`${companyId}:device:${signals.deviceFingerprint}`, accountId);
    }
  }

  async getEnrollment(companyId: CompanyId, accountId: string): Promise<FoundersEnrollment | null> {
    const en = this.enrollments.get(`${companyId}:${accountId}`);
    return en ? { ...en } : null;
  }

  async getEnrollmentBySubscriptionId(subscriptionId: string): Promise<FoundersEnrollment | null> {
    for (const e of this.enrollments.values()) {
      if (e.providerSubscriptionId === subscriptionId) {
        return { ...e };
      }
    }
    return null;
  }

  async saveEnrollment(enrollment: FoundersEnrollment): Promise<void> {
    const key = `${enrollment.companyId}:${enrollment.immutableAccountId}`;
    this.enrollments.set(key, { ...enrollment });
  }

  async deleteEnrollment(companyId: CompanyId, accountId: string): Promise<void> {
    const key = `${companyId}:${accountId}`;
    this.enrollments.delete(key);
  }

  async claimEvent(eventId: string): Promise<boolean> {
    if (this.processedEvents.has(eventId) || this.inFlightClaims.has(eventId)) {
      return false;
    }
    this.inFlightClaims.add(eventId);
    return true;
  }

  async releaseEventClaim(eventId: string): Promise<void> {
    this.inFlightClaims.delete(eventId);
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async recordProcessedEvent(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
    this.inFlightClaims.delete(eventId);
  }

  async saveAuditEntry(entry: FoundersAuditEntry): Promise<void> {
    this.auditLogs.push({ ...entry });
  }

  async getAuditTrail(accountId: string): Promise<FoundersAuditEntry[]> {
    return this.auditLogs.filter((a) => a.immutableAccountId === accountId);
  }

  /**
   * Counts distinct accounts. When companyId is omitted, counts PORTFOLIO-WIDE across all companies.
   */
  async getQualifiedAccountCount(companyId?: CompanyId): Promise<number> {
    const uniqueAccounts = new Set<string>();
    for (const e of this.eligibilities.values()) {
      if (companyId && e.companyId !== companyId) continue;
      // Conservative coordinator default (Directive FOUNDERS-da6e265):
      // Any original account ever admitted (eligible, enrolled, forfeited, revoked) counts towards cap.
      // A forfeited or closed account NEVER frees its slot for another account.
      if (e.eligibilityStatus !== 'ineligible_duplicate') {
        uniqueAccounts.add(e.immutableAccountId);
      }
    }
    return uniqueAccounts.size;
  }

  clear(): void {
    this.offers.clear();
    this.eligibilities.clear();
    this.enrollments.clear();
    this.processedEvents.clear();
    this.inFlightClaims.clear();
    this.auditLogs = [];
    this.identitySignalIndex.clear();
  }
}
