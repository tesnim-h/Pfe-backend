// Skill Tier — mentor-assigned during validation. Controls S multiplier in Credits = T × S × M.
const SKILL_TIERS = {
  STARTER:      { multiplier: 1.0 },
  BEGINNER:     { multiplier: 1.2 },
  INTERMEDIATE: { multiplier: 1.5 },
  ADVANCED:     { multiplier: 1.8 },
  EXPERT:       { multiplier: 2.0 },
};

const SKILL_TIER_NAMES = Object.keys(SKILL_TIERS);
const DEFAULT_SKILL_TIER = 'STARTER';

const getSkillTierMultiplier = (tier) => {
  return SKILL_TIERS[tier]?.multiplier ?? 1.0;
};

// Trust Score Badges — per skill, derived from trust score (0–100).
// Controls M modifier in Credits = T × S × M.
const TRUST_BADGES = [
  { badge: 'UNVERIFIED', minScore: 0,  maxScore: 24,  modifier: 1.00 },
  { badge: 'BRONZE',     minScore: 25, maxScore: 49,  modifier: 1.05 },
  { badge: 'SILVER',     minScore: 50, maxScore: 74,  modifier: 1.10 },
  { badge: 'GOLD',       minScore: 75, maxScore: 89,  modifier: 1.20 },
  { badge: 'VERIFIED',   minScore: 90, maxScore: 100, modifier: 1.30 },
];

const getTrustBadge = (score) => {
  const clamped = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  const tier = TRUST_BADGES.findLast((t) => clamped >= t.minScore) ?? TRUST_BADGES[0];
  return { badge: tier.badge, modifier: tier.modifier };
};

// Trust Score formula: round(0.55 × P + 0.45 × E)
// P = Portfolio Score (0–100), E = Endorsements Score (0–100)
const PORTFOLIO_WEIGHT  = 0.55;
const ENDORSEMENT_WEIGHT = 0.45;

const computeTrustScore = (portfolioScore, endorsementScore) => {
  const p = Math.min(100, Math.max(0, Number(portfolioScore) || 0));
  const e = Math.min(100, Math.max(0, Number(endorsementScore) || 0));
  return Math.round(PORTFOLIO_WEIGHT * p + ENDORSEMENT_WEIGHT * e);
};

// P Score — based on linked external platforms and active Fenneky project evidence.
// Maps to the table: 0 platforms → 0, 1 → 30, 2 → 55, 2+active → 75, 2+active+projects → 90-100
const computePortfolioScore = ({ platformCount, hasActiveContent, fennekyProjectCount }) => {
  if (platformCount === 0) return 0;
  if (platformCount === 1) return 30;
  if (platformCount >= 2 && !hasActiveContent) return 55;
  if (platformCount >= 2 && hasActiveContent && fennekyProjectCount === 0) return 75;
  // 2+ platforms + active content + at least 1 Fenneky project with description
  return Math.min(100, 90 + fennekyProjectCount * 2);
};

// E Score — maps endorsement count to a score using spec table midpoints.
const ENDORSEMENT_E_TABLE = [
  { maxCount: 0,        score: 0   },
  { maxCount: 1,        score: 20  },
  { maxCount: 2,        score: 35  },
  { maxCount: 3,        score: 50  },
  { maxCount: 4,        score: 57  },
  { maxCount: 5,        score: 70  },
  { maxCount: 6,        score: 75  },
  { maxCount: 7,        score: 79  },
  { maxCount: 8,        score: 83  },
  { maxCount: 9,        score: 88  },
  { maxCount: Infinity, score: null }, // 90 + (count - 10), capped at 100
];

const computeEndorsementScore = (endorsementCount) => {
  const count = Math.max(0, Math.floor(Number(endorsementCount) || 0));
  if (count >= 10) return Math.min(100, 90 + (count - 10));
  const row = ENDORSEMENT_E_TABLE.findLast((r) => count >= r.maxCount) ?? ENDORSEMENT_E_TABLE[0];
  return row.score ?? 0;
};

// Fairness safeguards
const MAX_SESSION_HOURS       = 4;    // Part 6: credit cap per session
const PROBATION_WEEKLY_CAP_CR = 5;    // Part 6: weekly cap for UNVERIFIED users
const PROBATION_BADGE         = 'UNVERIFIED';

// Platform evidence types that count as "a linked platform" for P score
const PLATFORM_EVIDENCE_TYPES = new Set(['GITHUB_REPO', 'LINKEDIN', 'PORTFOLIO_LINK', 'CV']);
// Types that indicate "active content" (repos with visible work)
const ACTIVE_CONTENT_TYPES    = new Set(['GITHUB_REPO', 'PROJECT']);

module.exports = {
  SKILL_TIERS,
  SKILL_TIER_NAMES,
  DEFAULT_SKILL_TIER,
  getSkillTierMultiplier,
  TRUST_BADGES,
  getTrustBadge,
  computeTrustScore,
  computePortfolioScore,
  computeEndorsementScore,
  MAX_SESSION_HOURS,
  PROBATION_WEEKLY_CAP_CR,
  PROBATION_BADGE,
  PLATFORM_EVIDENCE_TYPES,
  ACTIVE_CONTENT_TYPES,
};
