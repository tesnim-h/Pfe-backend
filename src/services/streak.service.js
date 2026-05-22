const User = require('../models/User');
const xpService = require('./xp.service');
const badgeService = require('./badge.service');
const { XP_SOURCES } = require('../constants/xp');

// Streak milestones: { days required, XP bonus, optional badge key }
const STREAK_MILESTONES = [
  { days: 7,  xp: 5,  badge: 'FLAME_BADGE' },
  { days: 14, xp: 15, badge: null },
  { days: 30, xp: 40, badge: 'SPECIAL_BADGE' },
];

// Returns true if the streak shield has not been used this calendar month.
const isShieldAvailable = (streakShieldUsedAt) => {
  if (!streakShieldUsedAt) return true;
  const now = new Date();
  const used = new Date(streakShieldUsedAt);
  return now.getFullYear() !== used.getFullYear() || now.getMonth() !== used.getMonth();
};

// Records a qualifying streak activity for a user.
// Qualifying events (per spec): session contribution, project update, endorsement, join project.
// Streak increments at most once per calendar day. Milestones award XP + badges.
const recordActivity = async (userId) => {
  if (!userId) return;

  const user = await User.findOne({ userId }).select(
    'userId currentStreak longestStreak lastActivityDate streakShieldUsedAt'
  );

  if (!user) return;

  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const lastDate = user.lastActivityDate ? new Date(user.lastActivityDate) : null;

  // Already recorded an activity today — nothing to update.
  if (lastDate && lastDate >= todayStart) return;

  const previousStreak = user.currentStreak || 0;
  let newStreak;

  if (!lastDate) {
    // First ever activity.
    newStreak = 1;
  } else if (lastDate >= yesterdayStart) {
    // Consecutive day.
    newStreak = previousStreak + 1;
  } else {
    // Missed at least one day.
    const daysSinceLast = Math.floor((todayStart - lastDate) / 86400000);

    // Shield covers exactly 1 missed day (a gap of 2 calendar days).
    if (daysSinceLast === 2 && isShieldAvailable(user.streakShieldUsedAt)) {
      user.streakShieldUsedAt = now;
      newStreak = previousStreak + 1;
    } else {
      newStreak = 1; // reset
    }
  }

  user.currentStreak = newStreak;
  user.longestStreak = Math.max(user.longestStreak || 0, newStreak);
  user.lastActivityDate = now;
  await user.save();

  // Award XP + badge when crossing a milestone for the first time.
  for (const milestone of STREAK_MILESTONES) {
    if (newStreak >= milestone.days && previousStreak < milestone.days) {
      try {
        await xpService.addXP(
          userId,
          milestone.xp,
          XP_SOURCES.STREAK_MILESTONE,
          { description: `${milestone.days}-day streak milestone` }
        );
        if (milestone.badge) {
          await badgeService.grantBadge(userId, milestone.badge);
        }
      } catch (_) {
        // Non-blocking — streak is recorded even if XP/badge award fails.
      }
    }
  }
};

module.exports = { recordActivity };
