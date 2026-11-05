/** Reviewed prospect registry. Program information is NOT an approved affiliate tracking URL. */
export type PartnerStatus = "prospect" | "applied" | "approved";
export interface PartnerProgram {
  readonly id: string;
  readonly name: string;
  readonly category: "tool" | "community" | "education";
  readonly description: string;
  readonly applicationUrl: string;
  readonly officialHosts: readonly string[];
  readonly status: PartnerStatus;
  readonly lastReviewed: string;
  readonly applicationNote: string;
  /** Populate only with a real vendor-issued URL after campaign approval and terms review. */
  readonly affiliateTrackingUrl?: string;
  /** Exact campaign hosts reviewed by the owner; no wildcard or suffix matches. */
  readonly approvedTrackingHosts: readonly string[];
}

function allowedHttpsUrl(raw: string | undefined, hosts: readonly string[]): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
    if (!hosts.includes(url.hostname.toLowerCase())) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function officialProgramUrl(program: PartnerProgram): string | undefined {
  return allowedHttpsUrl(program.applicationUrl, program.officialHosts);
}

export function approvedAffiliateUrl(program: PartnerProgram): string | undefined {
  if (program.status !== "approved") return undefined;
  return allowedHttpsUrl(program.affiliateTrackingUrl, program.approvedTrackingHosts);
}

export const PARTNER_PROGRAMS: readonly PartnerProgram[] = [
  {
    "id": "make",
    "name": "Make",
    "category": "tool",
    "description": "Visual automation labs for founders and small businesses",
    "applicationUrl": "https://www.make.com/affiliate",
    "officialHosts": [
      "www.make.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "elevenlabs",
    "name": "ElevenLabs",
    "category": "tool",
    "description": "English/Spanish narration and AI coach demonstrations",
    "applicationUrl": "https://elevenlabs.io/affiliates",
    "officialHosts": [
      "elevenlabs.io"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "opusclip",
    "name": "OpusClip",
    "category": "tool",
    "description": "Turning lessons and podcasts into social clips",
    "applicationUrl": "https://www.opus.pro/affiliate",
    "officialHosts": [
      "www.opus.pro"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "mailerlite",
    "name": "MailerLite",
    "category": "tool",
    "description": "Low-complexity email campaigns for beginners",
    "applicationUrl": "https://www.mailerlite.com/become-a-partner",
    "officialHosts": [
      "www.mailerlite.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "getresponse",
    "name": "GetResponse",
    "category": "tool",
    "description": "Email automation and landing-page courses",
    "applicationUrl": "https://www.getresponse.com/affiliate-programs",
    "officialHosts": [
      "www.getresponse.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "namecheap",
    "name": "Namecheap",
    "category": "tool",
    "description": "Domains, SSL and beginner website ownership",
    "applicationUrl": "https://www.namecheap.com/affiliates/",
    "officialHosts": [
      "www.namecheap.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "descript",
    "name": "Descript",
    "category": "tool",
    "description": "Transcript-based editing, podcasts, captions",
    "applicationUrl": "https://www.descript.com/affiliate",
    "officialHosts": [
      "www.descript.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "capcut",
    "name": "CapCut",
    "category": "tool",
    "description": "Accessible short-form production and social video courses",
    "applicationUrl": "https://www.capcut.com/partners/affiliate-program",
    "officialHosts": [
      "www.capcut.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "webflow",
    "name": "Webflow",
    "category": "tool",
    "description": "Advanced website design and portfolio courses",
    "applicationUrl": "https://webflow.com/solutions/affiliates",
    "officialHosts": [
      "webflow.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "hostinger",
    "name": "Hostinger",
    "category": "tool",
    "description": "Website and hosting lessons",
    "applicationUrl": "https://www.hostinger.com/support/1583642-how-to-join-the-hostinger-affiliate-program/",
    "officialHosts": [
      "www.hostinger.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "wix",
    "name": "Wix",
    "category": "tool",
    "description": "Beginner business websites and AI site creation",
    "applicationUrl": "https://www.wix.com/about/affiliates",
    "officialHosts": [
      "www.wix.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "brevo",
    "name": "Brevo",
    "category": "tool",
    "description": "Email/CRM lessons and small-business automation",
    "applicationUrl": "https://www.brevo.com/partners/affiliates/",
    "officialHosts": [
      "www.brevo.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "systeme-io",
    "name": "systeme.io",
    "category": "tool",
    "description": "Funnels, simple websites and course businesses",
    "applicationUrl": "https://systeme.io/affiliate-program",
    "officialHosts": [
      "systeme.io"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "canva",
    "name": "Canva",
    "category": "tool",
    "description": "Visual literacy, templates, small-business marketing",
    "applicationUrl": "https://www.canva.com/partners/",
    "officialHosts": [
      "www.canva.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "cloudflare",
    "name": "Cloudflare",
    "category": "tool",
    "description": "Academy hosting, AI, bilingual voices, infrastructure lessons",
    "applicationUrl": "https://www.cloudflare.com/partners/",
    "officialHosts": [
      "www.cloudflare.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "replicate",
    "name": "Replicate",
    "category": "tool",
    "description": "Model demos and reproducible image/video labs",
    "applicationUrl": "https://replicate.com/",
    "officialHosts": [
      "replicate.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "runway",
    "name": "Runway",
    "category": "tool",
    "description": "Generative film projects and learner showcases",
    "applicationUrl": "https://runway.com/creative-partners-program",
    "officialHosts": [
      "runway.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "heygen",
    "name": "HeyGen",
    "category": "tool",
    "description": "Multilingual avatars and business explainer videos",
    "applicationUrl": "https://www.heygen.com/geniverse/affiliate-program",
    "officialHosts": [
      "www.heygen.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "suno",
    "name": "Suno",
    "category": "tool",
    "description": "Original music projects and responsible AI music instruction",
    "applicationUrl": "https://suno.com/spark",
    "officialHosts": [
      "suno.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "zapier",
    "name": "Zapier",
    "category": "tool",
    "description": "Practical AI automation and business workflow courses",
    "applicationUrl": "https://zapier.com/l/partners",
    "officialHosts": [
      "zapier.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "notion",
    "name": "Notion",
    "category": "tool",
    "description": "Student workspaces, playbooks, course knowledge bases",
    "applicationUrl": "https://www.notion.com/affiliates",
    "officialHosts": [
      "www.notion.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "ifilms-studios",
    "name": "iFilms Studios",
    "category": "tool",
    "description": "Learner film showcases and creator-channel education",
    "applicationUrl": "https://ifilmsstudio.pics/partners",
    "officialHosts": [
      "ifilmsstudio.pics"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Related business prospect; not an independent sponsor commitment.",
    "approvedTrackingHosts": []
  },
  {
    "id": "georgia-hispanic-chamber-of-commerce",
    "name": "Georgia Hispanic Chamber of Commerce",
    "category": "community",
    "description": "Hispanic entrepreneurs and bilingual digital-skills workshops",
    "applicationUrl": "https://www.ghcc.org/Sponsorship-Opportunities",
    "officialHosts": [
      "www.ghcc.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "latin-american-association",
    "name": "Latin American Association",
    "category": "community",
    "description": "Bilingual workforce training and learner recruitment",
    "applicationUrl": "https://thelaa.org/",
    "officialHosts": [
      "thelaa.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "latino-community-fund-georgia",
    "name": "Latino Community Fund Georgia",
    "category": "community",
    "description": "Latino microbusiness owners and emerging entrepreneurs",
    "applicationUrl": "https://lcfgeorgia.org/what-we-do/protect-build-community/entrepreneurship/",
    "officialHosts": [
      "lcfgeorgia.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "prospera-georgia",
    "name": "Prospera Georgia",
    "category": "community",
    "description": "Bilingual entrepreneurship and practical business AI",
    "applicationUrl": "https://prosperausa.org/georgia-strategic-partners/",
    "officialHosts": [
      "prosperausa.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "univision-atlanta-televisaunivision",
    "name": "Univision Atlanta / TelevisaUnivision",
    "category": "community",
    "description": "Spanish-language reach and creator education",
    "applicationUrl": "https://corporate.televisaunivision.com/partner-with-us/local/atlanta/",
    "officialHosts": [
      "corporate.televisaunivision.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "douglas-county-chamber",
    "name": "Douglas County Chamber",
    "category": "community",
    "description": "Douglasville employer access and local small-business workshops",
    "applicationUrl": "https://business.douglascountygeorgia.com/list/",
    "officialHosts": [
      "business.douglascountygeorgia.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "atlanta-tech-village",
    "name": "Atlanta Tech Village",
    "category": "community",
    "description": "Founder community, workshop venues, startup mentors",
    "applicationUrl": "https://atlantatechvillage.com/partners-and-sponsors",
    "officialHosts": [
      "atlantatechvillage.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "goodwill-of-north-georgia",
    "name": "Goodwill of North Georgia",
    "category": "community",
    "description": "Job readiness, digital skills, employer pathways",
    "applicationUrl": "https://goodwillng.org/ways-to-support/partner-with-us/",
    "officialHosts": [
      "goodwillng.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Potential community collaboration; no funding or referral agreement is in place.",
    "approvedTrackingHosts": []
  },
  {
    "id": "kit",
    "name": "Kit",
    "category": "tool",
    "description": "Creator newsletters and email-course publishing",
    "applicationUrl": "https://kit.com/affiliate",
    "officialHosts": [
      "kit.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "semrush",
    "name": "Semrush",
    "category": "tool",
    "description": "SEO and online-business research",
    "applicationUrl": "https://www.semrush.com/lp/affiliate-program/",
    "officialHosts": [
      "www.semrush.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "fiverr",
    "name": "Fiverr",
    "category": "tool",
    "description": "Learning when to outsource narrowly scoped project work",
    "applicationUrl": "https://affiliates.fiverr.com/",
    "officialHosts": [
      "affiliates.fiverr.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "hubspot",
    "name": "HubSpot",
    "category": "tool",
    "description": "CRM and inbound marketing education",
    "applicationUrl": "https://www.hubspot.com/partners/affiliates",
    "officialHosts": [
      "www.hubspot.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "teachable",
    "name": "Teachable",
    "category": "education",
    "description": "Students who later create and sell their own courses",
    "applicationUrl": "https://www.teachable.com/partners",
    "officialHosts": [
      "www.teachable.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "thinkific",
    "name": "Thinkific",
    "category": "education",
    "description": "Course-business platform education; current intake hold",
    "applicationUrl": "https://www.thinkific.com/partners/",
    "officialHosts": [
      "www.thinkific.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Partner page states new applications are closed; affiliate availability needs separate confirmation.",
    "approvedTrackingHosts": []
  },
  {
    "id": "podia",
    "name": "Podia",
    "category": "education",
    "description": "Creator products and membership-business learning",
    "applicationUrl": "https://help.podia.com/en/articles/11370941-becoming-a-podia-affiliate",
    "officialHosts": [
      "help.podia.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "skillshare",
    "name": "Skillshare",
    "category": "education",
    "description": "Complementary creative classes with a separately disclosed subscription",
    "applicationUrl": "https://www.skillshare.com/en/affiliates",
    "officialHosts": [
      "www.skillshare.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "kinsta",
    "name": "Kinsta",
    "category": "tool",
    "description": "Advanced hosting lessons; not first choice for budget beginners",
    "applicationUrl": "https://kinsta.com/affiliates/",
    "officialHosts": [
      "kinsta.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "siteground",
    "name": "SiteGround",
    "category": "tool",
    "description": "Website hosting and WordPress practical lessons",
    "applicationUrl": "https://www.siteground.com/affiliates",
    "officialHosts": [
      "www.siteground.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "bluehost",
    "name": "Bluehost",
    "category": "tool",
    "description": "Beginner WordPress hosting comparisons",
    "applicationUrl": "https://www.bluehost.com/affiliates",
    "officialHosts": [
      "www.bluehost.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "synthesia",
    "name": "Synthesia",
    "category": "tool",
    "description": "Training videos and multilingual explainers",
    "applicationUrl": "https://www.synthesia.io/partners/affiliate",
    "officialHosts": [
      "www.synthesia.io"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "pictory",
    "name": "Pictory",
    "category": "tool",
    "description": "Script-to-video and accessible content workflows",
    "applicationUrl": "https://pictory.ai/affiliate-program",
    "officialHosts": [
      "pictory.ai"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "veed",
    "name": "VEED",
    "category": "tool",
    "description": "Captions, smartphone editing and short-form videos",
    "applicationUrl": "https://www.veed.io/affiliate",
    "officialHosts": [
      "www.veed.io"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "invideo",
    "name": "InVideo",
    "category": "tool",
    "description": "Beginner AI video project instruction",
    "applicationUrl": "https://invideo.io/affiliate/",
    "officialHosts": [
      "invideo.io"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "adobe",
    "name": "Adobe",
    "category": "tool",
    "description": "Creative tools and smartphone-to-desktop design skills",
    "applicationUrl": "https://www.adobe.com/affiliates.html",
    "officialHosts": [
      "www.adobe.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "envato",
    "name": "Envato",
    "category": "tool",
    "description": "Licensed assets and design templates; teach license limits",
    "applicationUrl": "https://www.envato.com/affiliates/",
    "officialHosts": [
      "www.envato.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "placeit",
    "name": "Placeit",
    "category": "tool",
    "description": "Mockups and beginner small-business visuals",
    "applicationUrl": "https://placeit.net/affiliate-program",
    "officialHosts": [
      "placeit.net"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "udemy",
    "name": "Udemy",
    "category": "education",
    "description": "Complementary specialist courses; disclose separate fees",
    "applicationUrl": "https://www.udemy.com/affiliate/",
    "officialHosts": [
      "www.udemy.com"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official route needs rechecking before an application. No application submitted.",
    "approvedTrackingHosts": []
  },
  {
    "id": "coursera",
    "name": "Coursera",
    "category": "education",
    "description": "Further education beyond Academy catalog; no accreditation claim",
    "applicationUrl": "https://www.coursera.org/about/affiliates",
    "officialHosts": [
      "www.coursera.org"
    ],
    "status": "prospect",
    "lastReviewed": "2026-11-05",
    "applicationNote": "Official program route requires eligibility and terms review. No application submitted.",
    "approvedTrackingHosts": []
  }
];
