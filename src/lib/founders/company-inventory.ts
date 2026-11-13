import { CompanyFitRecord, CompanyId } from './types';

/**
 * Authoritative Company Inventory and $4.99 Founders Beta Fit Assessment.
 * Directives:
 * - CONFIRMED-FOUNDERS-4-99-MONTHLY-20261112.md
 * - FINAL-FOUNDERS-499-3-5-ACTIVE-ONLY-QA-20261112.md (P0 Founder Decisions)
 *
 * Founder Decisions Approved:
 * 1. Pilot cohort is strictly capped at APPROXIMATELY 3-5 EXTERNAL BUSINESS ACCOUNTS TOTAL across the entire portfolio.
 * 2. All previous unapproved capacity suggestions (100/250/150/300) are RETRACTED.
 * 3. Cancellation of subscription or closure of original account PERMANENTLY FORFEITS the $4.99 rate.
 *    Any subsequent signup pays standard market rate.
 * 4. Legitimate live Rreal $1/mo subscriber is 100% PRESERVED; zero auto-migration.
 */
export const COMPANY_FIT_INVENTORY: Record<CompanyId, CompanyFitRecord> = {
  tiqology: {
    companyId: 'tiqology',
    name: 'TiQology Core AI Platform',
    legalSeller: 'TiQology Holdings LLC (Atlanta, GA)',
    businessModel: 'AI Developer Platform, multi-agent orchestrator, runtime APIs',
    fitStatus: 'eligible',
    foundersOfferUnitAmount: 499, // $4.99/mo
    inclusions: [
      'Early access to multi-agent developer sandbox runtime',
      '5,000 monthly compute credits for agent task executions (subject to cost ceiling)',
      'Access to core API gateway and developer discord/beta channel',
      'Account-bound rate lock ONLY while continuously active; cancellation forfeits rate permanently',
    ],
    exclusions: [
      'Dedicated enterprise agents or private cloud VPC clusters',
      'Custom LLM fine-tuning or proprietary model hosting',
      'Third-party provider pass-through API costs exceeding quota',
    ],
    usageCapsAndMargin: {
      maxComputeUnitsMonthly: 5000,
      marginFloorPercent: 65,
      concurrencyCap: 2,
    },
    supportTerms: 'Community beta channel + asynchronous ticketing (within 48 business hours)',
    cancellationRefundTerms: 'Cancel anytime via dashboard; access continues until end of billing period; cancellation PERMANENTLY forfeits the $4.99 rate; future subscriptions charged at standard market rate ($29/mo).',
    openFounderDecisions: [
      'Pilot cohort size: 3-5 business accounts total across portfolio (APPROVED by Founder)',
      'Confirm cost ceiling on 5,000 compute credits before live activation',
    ],
  },

  zuri: {
    companyId: 'zuri',
    name: 'Zuri Small Business AI Platform',
    legalSeller: 'TiQology Holdings LLC',
    businessModel: 'Industry-specific AI assistants (Tiers 1-4) for service businesses',
    fitStatus: 'eligible',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'Solo business tier: 1 configured AI assistant widget for company website',
      'Up to 150 customer conversation sessions per month',
      'Self-service appointment request and FAQ lead intake widget',
      'Account-bound rate lock ONLY while continuously active; cancellation forfeits rate permanently',
    ],
    exclusions: [
      'Multi-location or multi-technician dispatch boards',
      'Live GPS technician tracking or automated SMS marketing campaigns',
      'Medical/legal ambient scribe or voice transcription',
      'Carrier pass-through SMS/telephony fees',
    ],
    usageCapsAndMargin: {
      maxInvocationsMonthly: 150,
      marginFloorPercent: 70,
      concurrencyCap: 1,
    },
    supportTerms: 'Email support with 48h response window during business hours',
    cancellationRefundTerms: 'Monthly renewal with self-service cancellation; widget stops accepting new sessions at period end; cancellation forfeits rate permanently.',
    openFounderDecisions: [
      'Part of 3-5 total business accounts pilot cohort',
    ],
  },

  riley: {
    companyId: 'riley',
    name: 'Agentic Riley Business Bots',
    legalSeller: 'Mr. AL Wilson / TiQology (8753 Dunwoody Place STE G, Atlanta, GA)',
    businessModel: 'Commercial AI business bot family, lead qualification, website concierge',
    fitStatus: 'eligible',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'Website Concierge pilot widget for 1 verified business domain',
      'Up to 100 qualified lead intakes and scoring evaluations per month',
      'Standard lead qualification rules (domain, consent evidence, urgency validation)',
      'Immediate lead alert email dispatches to business owner',
      'Account-bound rate lock ONLY while continuously active; cancellation forfeits rate permanently',
    ],
    exclusions: [
      'Dedicated Option 6 toll-free phone bot handling (carrier minutes not included)',
      'Custom enterprise CRM sync or automated sales outreach drips',
      'Done-for-you concierge implementation (which requires written quote and bespoke retainer)',
    ],
    usageCapsAndMargin: {
      maxInvocationsMonthly: 100,
      marginFloorPercent: 75,
      concurrencyCap: 2,
    },
    supportTerms: 'Standard electronic support; consultative phone review remains quote-based',
    cancellationRefundTerms: 'Cancel anytime; lead intake widget deactivates at end of billing cycle; cancellation permanently forfeits $4.99 rate; returning signups pay market rate ($49/mo).',
    openFounderDecisions: [
      'Part of 3-5 total business accounts pilot cohort',
      'Option 6 phone bot routing remains unverified for live commercial traffic',
    ],
  },

  rreal: {
    companyId: 'rreal',
    name: 'Rreal AI Academy & Video Creator Lab',
    legalSeller: 'TiQology Holdings LLC / Rreal AI Academy',
    businessModel: 'Smartphone content creator video courses and AI creator community',
    fitStatus: 'conditional',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'NEW Founders Creator Tier: Access to AI Video Editing Lab / Prompt Studio Beta',
      'Monthly live creator workshop webinar and community forum access',
      'All smartphone course catalog access',
      'Account-bound rate lock ONLY while continuously active; cancellation forfeits rate permanently',
    ],
    exclusions: [
      '1-on-1 private video coaching sessions or physical studio time',
      'Guaranteed video production or bespoke commercial editing',
    ],
    usageCapsAndMargin: {
      maxComputeUnitsMonthly: 200,
      marginFloorPercent: 80,
      concurrencyCap: 1,
    },
    supportTerms: 'Community forum + weekly creator office hours',
    cancellationRefundTerms: 'Monthly renewal; cancel stops access at period end; cancellation permanently forfeits $4.99 rate.',
    openFounderDecisions: [
      'MANDATORY FOUNDER REQUIREMENT: Existing legitimate live $1/mo subscriber must remain permanently at $1/mo; confirm $4.99 is a separate, premium "Creators Beta" product with distinct deliverables to avoid diluting or auto-migrating existing customer.',
      'Part of 3-5 total business accounts pilot cohort',
    ],
  },

  reel2real: {
    companyId: 'reel2real',
    name: 'Reel2Real Creator Hub',
    legalSeller: 'TiQology Holdings LLC',
    businessModel: 'Creator economy monetization hub and media tools',
    fitStatus: 'eligible',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'Beta Creator Hub membership',
      'Up to 50 audio/video asset processing operations per month (subject to transcode ceiling)',
      'Creator profile and portfolio showcase hosting',
      'Account-bound rate lock ONLY while continuously active; cancellation forfeits rate permanently',
    ],
    exclusions: [
      'High-bandwidth uncompressed 4K video streaming/CDN distribution',
      'Commercial broadcast licensing rights',
    ],
    usageCapsAndMargin: {
      maxComputeUnitsMonthly: 50,
      marginFloorPercent: 75,
      concurrencyCap: 1,
    },
    supportTerms: 'Online creator help center + community support',
    cancellationRefundTerms: 'Self-service monthly cancellation; access until period end; cancellation forfeits rate.',
    openFounderDecisions: [
      'Confirm media processing cost ceiling before live launch',
    ],
  },

  inboxedge: {
    companyId: 'inboxedge',
    name: 'InboxEdge Agency',
    legalSeller: 'Mr. AL Wilson / InboxEdge Agency',
    businessModel: 'Full done-for-you B2B cold email marketing agency ($250 to $2,000/mo retainers)',
    fitStatus: 'excluded_from_full_service',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'RESTRICTED AUDIT-ONLY SCOPE IF PERMITTED: Self-service monthly domain deliverability scan (SPF/DKIM/DMARC health report) only',
    ],
    exclusions: [
      'STRICTLY EXCLUDED: Full done-for-you lead generation retainers ($250, $500, $1,000, $2,000/mo)',
      'STRICTLY EXCLUDED: Dedicated inbox provisioning, warm-up infrastructure, and campaign copywriting',
      'STRICTLY EXCLUDED: Dedicated account manager or live lead delivery',
    ],
    usageCapsAndMargin: {
      maxInvocationsMonthly: 2,
      marginFloorPercent: 90,
      concurrencyCap: 1,
    },
    supportTerms: 'Automated scan report only; agency onboarding excluded',
    cancellationRefundTerms: 'Cancel anytime.',
    openFounderDecisions: [
      'FOUNDER CONFIRMED: Agency retainers ($250-$2,000) are NOT sold for $4.99. Deliverability audit tool allowed only if built and isolated.',
    ],
  },

  ifilms: {
    companyId: 'ifilms',
    name: 'iFilms Studios',
    legalSeller: 'iFilms Studios / TiQology',
    businessModel: 'Commercial film production, CCTV feature distribution, Brand Ad Studio',
    fitStatus: 'excluded_from_production',
    foundersOfferUnitAmount: 499,
    inclusions: [
      'RESTRICTED PREVIEW SCOPE IF PERMITTED: Early Screening & Asset Vault digital pass (stream festival cuts, view draft renders)',
    ],
    exclusions: [
      'STRICTLY EXCLUDED: Commercial video production shoots, film crews, or location rentals',
      'STRICTLY EXCLUDED: Paid ad campaign management or social ad spend',
      'STRICTLY EXCLUDED: Bespoke Brand Ad Studio commercial video rendering',
    ],
    usageCapsAndMargin: {
      maxComputeUnitsMonthly: 10,
      marginFloorPercent: 85,
      concurrencyCap: 1,
    },
    supportTerms: 'Online ticket portal',
    cancellationRefundTerms: 'Cancel anytime; screener access revoked at period end.',
    openFounderDecisions: [
      'FOUNDER CONFIRMED: Commercial film production is quote/contract based. Digital screener pass allowed only if built and isolated.',
    ],
  },

  shopify_stores: {
    companyId: 'shopify_stores',
    name: 'E-Commerce Stores ("I Want That" Skincare & Merch)',
    legalSeller: 'Store Operating Entity',
    businessModel: 'Direct-to-consumer physical e-commerce (trending skincare, apparel, merchandise)',
    fitStatus: 'excluded',
    foundersOfferUnitAmount: 499,
    inclusions: [],
    exclusions: [
      'ALL RECURRING SUBSCRIPTIONS EXCLUDED',
      'Physical trending skincare items are one-time retail purchases with discrete cost-of-goods-sold (COGS)',
    ],
    usageCapsAndMargin: {
      marginFloorPercent: 0,
    },
    supportTerms: 'Standard Shopify store return/shipping policy',
    cancellationRefundTerms: 'Standard 30-day physical goods return policy.',
    openFounderDecisions: [
      'MANDATORY EXCLUSION: Physical retail goods must NOT have a recurring $4.99 subscription attached.',
    ],
  },
};

/**
 * Validates whether a company is eligible to launch a $4.99 Founders Beta offer.
 */
export function validateCompanyFit(companyId: CompanyId): {
  isEligible: boolean;
  verdict: string;
  record: CompanyFitRecord;
} {
  const record = COMPANY_FIT_INVENTORY[companyId];
  if (!record) {
    throw new Error(`Unknown company identifier: ${companyId}`);
  }

  if (record.fitStatus === 'excluded') {
    return {
      isEligible: false,
      verdict: `Company "${record.name}" is EXCLUDED from recurring $4.99 Founders Beta (physical retail goods / discrete COGS).`,
      record,
    };
  }

  if (record.fitStatus === 'excluded_from_full_service') {
    return {
      isEligible: false,
      verdict: `Company "${record.name}" agency retainers ($250-$2,000) CANNOT be replaced by $4.99 fee. Permitted only as standalone self-service scanner if explicitly isolated.`,
      record,
    };
  }

  if (record.fitStatus === 'excluded_from_production') {
    return {
      isEligible: false,
      verdict: `Company "${record.name}" film production CANNOT be sold for $4.99. Permitted only as an early screening pass.`,
      record,
    };
  }

  if (record.fitStatus === 'conditional') {
    return {
      isEligible: true,
      verdict: `Company "${record.name}" is conditionally eligible: MUST NOT impact existing legitimate live $1/mo subscriber; must be sold as distinct creator tools tier.`,
      record,
    };
  }

  return {
    isEligible: true,
    verdict: `Company "${record.name}" is eligible for $4.99 Founders Beta with defined compute caps in 3-5 account pilot.`,
    record,
  };
}

export const COMPANY_PILOT_CONFIG: Record<
  CompanyId,
  {
    name: string;
    foundersPriceId: string;
    standardMarketPriceId: string;
    maxPilotAccounts: number;
  }
> = {
  tiqology: {
    name: 'TiQology',
    foundersPriceId: 'price_tiqology_founders_499_monthly',
    standardMarketPriceId: 'price_tiqology_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  zuri: {
    name: 'Zuri',
    foundersPriceId: 'price_zuri_founders_499_monthly',
    standardMarketPriceId: 'price_zuri_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  riley: {
    name: 'Riley',
    foundersPriceId: 'price_riley_founders_499_monthly',
    standardMarketPriceId: 'price_riley_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  rreal: {
    name: 'Rreal',
    foundersPriceId: 'price_rreal_founders_499_monthly',
    standardMarketPriceId: 'price_rreal_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  reel2real: {
    name: 'Reel2Real',
    foundersPriceId: 'price_reel2real_founders_499_monthly',
    standardMarketPriceId: 'price_reel2real_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  inboxedge: {
    name: 'InboxEdge',
    foundersPriceId: 'price_inboxedge_founders_499_monthly',
    standardMarketPriceId: 'price_inboxedge_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  ifilms: {
    name: 'iFilms',
    foundersPriceId: 'price_ifilms_founders_499_monthly',
    standardMarketPriceId: 'price_ifilms_standard_29_monthly',
    maxPilotAccounts: 5,
  },
  shopify_stores: {
    name: 'Shopify Stores',
    foundersPriceId: 'price_shopify_founders_499_monthly',
    standardMarketPriceId: 'price_shopify_standard_29_monthly',
    maxPilotAccounts: 5,
  },
};
