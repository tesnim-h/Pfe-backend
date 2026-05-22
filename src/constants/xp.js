// Level thresholds: user reaches level N when xpTotal >= minXp for that level.
// Titles align with FENNEKY XP business rules (Seed → Oasis).
const XP_LEVELS = [
  { level: 1, minXp: 0, title: 'Seed' },
  { level: 2, minXp: 100, title: 'Sprout' },
  { level: 3, minXp: 350, title: 'Grower' },
  { level: 4, minXp: 800, title: 'Builder' },
  { level: 5, minXp: 1500, title: 'Guide' },
  { level: 6, minXp: 3000, title: 'Oasis' },
];

const MAX_LEVEL = XP_LEVELS[XP_LEVELS.length - 1].level;

// MVP: 1 credit earned from teaching = 10 XP (applied on session completion).
const XP_PER_CREDIT_EARNED = 10;

// Known sources — extend when adding bonus events, challenges, endorsements, etc.
const XP_SOURCES = {
  SESSION_COMPLETED:       'session_completed',
  BONUS_EVENT:             'bonus_event',
  CHALLENGE_PARTICIPATION: 'challenge_participation',
  CHALLENGE_WINNER:        'challenge_winner',
  ENDORSEMENT:             'endorsement',
  STREAK_MILESTONE:        'streak_milestone',
  COMMUNITY_CONTRIBUTION:  'community_contribution',
};

const XP_HISTORY_LIMIT = 100;

module.exports = {
  XP_LEVELS,
  MAX_LEVEL,
  XP_PER_CREDIT_EARNED,
  XP_SOURCES,
  XP_HISTORY_LIMIT,
};
