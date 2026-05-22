const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Computes Monday 00:00:00 UTC for the current ISO week (leaderboard resets every Monday).
const getCurrentWeekStart = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
};

// GET /leaderboard/weekly-xp
// Returns the top 50 XP earners of the current week within the caller's level tier.
const getWeeklyXpLeaderboard = async (req, res, next) => {
  try {
    if (!req.user?.userId) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const callerLevel = req.user.level || 1;
    const weekStart = getCurrentWeekStart();

    const entries = await User.aggregate([
      { $match: { level: callerLevel, accountStatus: 'ACTIVE' } },
      {
        $addFields: {
          weeklyXp: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$xpHistory', []] },
                    as: 'h',
                    cond: { $gte: ['$$h.createdAt', weekStart] },
                  },
                },
                as: 'h',
                in: '$$h.amount',
              },
            },
          },
        },
      },
      {
        $project: {
          userId: 1,
          firstName: 1,
          lastName: 1,
          level: 1,
          levelTitle: 1,
          weeklyXp: 1,
        },
      },
      { $sort: { weeklyXp: -1 } },
      { $limit: 50 },
    ]);

    const leaderboard = entries.map((e, index) => ({
      rank:          index + 1,
      userId:        e.userId,
      displayName:   [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unknown',
      weeklyXp:      e.weeklyXp || 0,
      level:         e.level,
      levelTitle:    e.levelTitle,
      isCurrentUser: e.userId === req.user.userId,
    }));

    res.json({
      success: true,
      data: {
        weekStart:  weekStart.toISOString(),
        level:      callerLevel,
        entries:    leaderboard,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWeeklyXpLeaderboard };
