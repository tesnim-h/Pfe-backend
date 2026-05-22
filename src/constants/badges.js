const BADGES = {
  // Teaching (5)
  FIRST_SESSION:     { key: 'FIRST_SESSION',     label: 'First Session',     category: 'teaching' },
  CONSISTENT_MENTOR: { key: 'CONSISTENT_MENTOR', label: 'Consistent Mentor', category: 'teaching' },
  TRUSTED_TEACHER:   { key: 'TRUSTED_TEACHER',   label: 'Trusted Teacher',   category: 'teaching' },
  COMMUNITY_PILLAR:  { key: 'COMMUNITY_PILLAR',  label: 'Community Pillar',  category: 'teaching' },
  OASIS_MAKER:       { key: 'OASIS_MAKER',       label: 'Oasis Maker',       category: 'teaching' },

  // Project (5)
  FIRST_BUILD:         { key: 'FIRST_BUILD',         label: 'First Build',         category: 'project' },
  TEAM_PLAYER:         { key: 'TEAM_PLAYER',         label: 'Team Player',         category: 'project' },
  PROJECT_LEADER:      { key: 'PROJECT_LEADER',      label: 'Project Leader',      category: 'project' },
  CROSS_DISCIPLINARY:  { key: 'CROSS_DISCIPLINARY',  label: 'Cross-Disciplinary',  category: 'project' },
  SERIAL_BUILDER:      { key: 'SERIAL_BUILDER',      label: 'Serial Builder',      category: 'project' },

  // Validation (5)
  FIRST_VALIDATION: { key: 'FIRST_VALIDATION', label: 'First Validation', category: 'validation' },
  BRONZE_EARNER:    { key: 'BRONZE_EARNER',    label: 'Bronze Earner',    category: 'validation' },
  SILVER_EARNER:    { key: 'SILVER_EARNER',    label: 'Silver Earner',    category: 'validation' },
  GOLD_EARNER:      { key: 'GOLD_EARNER',      label: 'Gold Earner',      category: 'validation' },
  FULLY_VERIFIED:   { key: 'FULLY_VERIFIED',   label: 'Fully Verified',   category: 'validation' },

  // Streak milestones (2)
  FLAME_BADGE:   { key: 'FLAME_BADGE',   label: '7-Day Streak',  category: 'streak' },
  SPECIAL_BADGE: { key: 'SPECIAL_BADGE', label: '30-Day Streak', category: 'streak' },
};

const BADGE_KEYS = new Set(Object.keys(BADGES));

module.exports = { BADGES, BADGE_KEYS };
