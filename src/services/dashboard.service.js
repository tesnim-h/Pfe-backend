const { randomUUID } = require('crypto');

const ApiError = require('../utils/ApiError');
const City = require('../models/City');
const Country = require('../models/Country');
const MentorApplication = require('../models/MentorApplication');
const MentorCredential = require('../models/MentorCredential');
const MentorSkill = require('../models/MentorSkill');
const Notification = require('../models/Notification');
const Rating = require('../models/Rating');
const Session = require('../models/Session');
const Skill = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const SkillEvidence = require('../models/SkillEvidence');
const User = require('../models/User');
const ValidationRequest = require('../models/ValidationRequest');
const { getMentorValidationOverview } = require('./validation.service');
const { formatXpProfile } = require('./xp.service');
const { ensureDefaultSkillCategory } = require('../utils/skillCategory.util');

const MENTOR_ROLES = new Set(['MENTOR', 'ADMIN']);

const isMentorUser = (user) => MENTOR_ROLES.has(String(user?.role || '').toUpperCase());

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
};

const readDecimalValue = (value) => {
  return Number(value?.toString?.() ?? value ?? 0);
};

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const buildFullName = (user) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Unknown user';
};

const buildInitials = (label = '') => {
  const parts = String(label)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '??';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const toTitleCase = (value = '') => {
  return String(value)
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

const formatDurationLabel = (durationHours) => {
  const duration = Number(durationHours || 0);

  if (!duration) {
    return 'Not specified';
  }

  if (duration === 1) {
    return '1 hour';
  }

  if (Number.isInteger(duration)) {
    return `${duration} hours`;
  }

  return `${duration} hours`;
};

const formatDateTimeLabel = (dateValue) => {
  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
};

const buildSkillKey = (skillName = '') => {
  return skillName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const buildNormalizedSkillNameKey = (skillName = '') => {
  return String(skillName).trim().toLowerCase();
};

const uniqueStrings = (values = []) => {
  return [...new Set(values.filter(Boolean))];
};

const buildGlobalSkillCatalog = async () => {
  const [skillDocs, mentorSkillDocs, users] = await Promise.all([
    Skill.find({}).lean(),
    MentorSkill.find({ isActive: true }).lean(),
    User.find({ accountStatus: 'ACTIVE' }).select('-profilePicture -xpHistory').lean(),
  ]);

  const categoryIds = uniqueStrings([
    ...skillDocs.map((skill) => skill.categoryId),
    ...mentorSkillDocs.map((skill) => skill.skillCategoryId),
  ]);
  const categories = categoryIds.length
    ? await SkillCategory.find({ categoryId: { $in: categoryIds } }).lean()
    : [];
  const categoryMap = new Map(
    categories.map((category) => [category.categoryId, category.categoryName])
  );
  const skillCatalogMap = new Map();

  const upsertCatalogSkill = (skillName, options = {}) => {
    const normalizedSkillName = String(skillName || '').trim();

    if (!normalizedSkillName) {
      return;
    }

    const catalogKey = buildNormalizedSkillNameKey(normalizedSkillName);
    let catalogEntry = skillCatalogMap.get(catalogKey);

    if (!catalogEntry) {
      catalogEntry = {
        id: buildSkillKey(normalizedSkillName),
        skillId: '',
        label: normalizedSkillName,
        evidenceCount: 0,
        hasExistingEvidence: false,
        requestStatus: '',
        validationStatus: 'UNVALIDATED',
        canTeach: false,
        isProfileSkill: false,
        isCatalogSkill: true,
        categoryNames: new Set(),
      };
      skillCatalogMap.set(catalogKey, catalogEntry);
    }

    const normalizedCategoryName = String(options.categoryName || '').trim();

    if (normalizedCategoryName) {
      catalogEntry.categoryNames.add(normalizedCategoryName);
    }
  };

  skillDocs.forEach((skill) => {
    upsertCatalogSkill(skill.skillName, {
      categoryName: categoryMap.get(skill.categoryId) || 'General',
    });
  });

  mentorSkillDocs.forEach((skill) => {
    upsertCatalogSkill(skill.skillName, {
      categoryName: categoryMap.get(skill.skillCategoryId) || 'General',
    });
  });

  users.forEach((user) => {
    [...(user.offeredSkills || []), ...(user.wantedSkills || [])].forEach((skillName) => {
      upsertCatalogSkill(skillName);
    });
  });

  return [...skillCatalogMap.values()]
    .map((skill) => {
      const categoryNames = [...skill.categoryNames].sort((left, right) => left.localeCompare(right));
      const categoryLabel =
        categoryNames.length === 0
          ? 'Available in the app'
          : `Available in the app - ${categoryNames.slice(0, 2).join(', ')}`;

      return {
        id: skill.id,
        skillId: '',
        label: skill.label,
        description: categoryLabel,
        evidenceCount: 0,
        hasExistingEvidence: false,
        requestStatus: '',
        validationStatus: 'UNVALIDATED',
        canTeach: false,
        isProfileSkill: false,
        isCatalogSkill: true,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
};

const uniqueLinksByHref = (links = []) => {
  const seenHrefs = new Set();

  return links.filter((link) => {
    const normalizedHref = link?.href?.trim()?.toLowerCase();

    if (!normalizedHref || seenHrefs.has(normalizedHref)) {
      return false;
    }

    seenHrefs.add(normalizedHref);
    return true;
  });
};

const buildResumeDownloadUrl = (storedName = '') => {
  return storedName ? `/uploads/resumes/${encodeURIComponent(storedName)}` : '';
};

const buildLocationLabel = (user, cityMap, countryMap) => {
  const city = cityMap.get(user.cityId);
  const country = countryMap.get(user.countryId);
  return [city, country].filter(Boolean).join(', ') || 'Location not set';
};

const buildLocationLabelMap = async (users) => {
  const cityIds = uniqueStrings(users.map((user) => user.cityId));
  const countryIds = uniqueStrings(users.map((user) => user.countryId));
  const [cities, countries] = await Promise.all([
    cityIds.length ? City.find({ cityId: { $in: cityIds } }).lean() : [],
    countryIds.length ? Country.find({ countryId: { $in: countryIds } }).lean() : [],
  ]);

  const cityMap = new Map(cities.map((city) => [city.cityId, city.name]));
  const countryMap = new Map(countries.map((country) => [country.countryId, country.name]));

  return new Map(
    users.map((user) => [user.userId, buildLocationLabel(user, cityMap, countryMap)])
  );
};

const buildRatingSummaryMap = async (userIds) => {
  const sanitizedUserIds = uniqueStrings(userIds);

  if (!sanitizedUserIds.length) {
    return new Map();
  }

  const rows = await Rating.aggregate([
    {
      $match: {
        toUser: { $in: sanitizedUserIds },
      },
    },
    {
      $group: {
        _id: '$toUser',
        averageRating: { $avg: '$score' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    sanitizedUserIds.map((userId) => {
      const summary = rows.find((row) => row._id === userId);
      const averageRating = summary?.averageRating
        ? Number(summary.averageRating.toFixed(1))
        : 0;

      return [
        userId,
        {
          averageRating,
          totalReviews: summary?.totalReviews || 0,
        },
      ];
    })
  );
};

const buildSkillRecordsByUserId = async (userIds) => {
  const sanitizedUserIds = uniqueStrings(userIds);

  if (!sanitizedUserIds.length) {
    return new Map();
  }

  const [skillDocs, allCategories] = await Promise.all([
    Skill.find({ userId: { $in: sanitizedUserIds } })
      .sort({ validationStatus: 1, skillName: 1 })
      .lean(),
    SkillCategory.find({}).lean(),
  ]);
  const categoryMap = new Map(
    allCategories.map((category) => [category.categoryId, category.categoryName])
  );

  return new Map(
    sanitizedUserIds.map((userId) => {
      const userSkills = skillDocs
        .filter((skill) => skill.userId === userId)
        .map((skill) => ({
          ...skill,
          categoryName: categoryMap.get(skill.categoryId) || 'General',
        }));

      return [userId, userSkills];
    })
  );
};

const getCombinedSkillNames = (user, skillRecords = []) => {
  return uniqueStrings([
    ...(Array.isArray(user.offeredSkills) ? user.offeredSkills : []),
    ...skillRecords.map((skill) => skill.skillName),
  ]);
};

const buildMentorDirectory = async (currentUserId, { limit = 0 } = {}) => {
  const query = User.find({
    accountStatus: 'ACTIVE',
    role: 'MENTOR',
    ...(currentUserId ? { userId: { $ne: currentUserId } } : {}),
  }).select('-profilePicture -xpHistory');
  if (limit > 0) query.limit(limit);
  const mentors = await query.lean();

  if (!mentors.length) {
    return [];
  }

  const mentorIds = mentors.map((mentor) => mentor.userId);
  const [ratingSummaryMap, skillMap, mentorSkillDocs] = await Promise.all([
    buildRatingSummaryMap(mentorIds),
    buildSkillRecordsByUserId(mentorIds),
    MentorSkill.find({ userId: { $in: mentorIds }, isActive: true })
      .select('userId skillName skillCategoryId').lean(),
  ]);

  const mentorSkillMap = new Map();
  mentorSkillDocs.forEach((ms) => {
    if (!mentorSkillMap.has(ms.userId)) mentorSkillMap.set(ms.userId, []);
    mentorSkillMap.get(ms.userId).push(ms.skillName);
  });

  return mentors
    .map((mentor) => {
      const skillRecords = skillMap.get(mentor.userId) || [];
      const mentorSkillNames = mentorSkillMap.get(mentor.userId) || [];
      const skills = getCombinedSkillNames(mentor, skillRecords).slice(0, 6);
      const topSkill = mentorSkillNames[0] || skillRecords[0]?.skillName || skills[0] || 'General mentoring';
      const ratingSummary = ratingSummaryMap.get(mentor.userId) || {
        averageRating: 0,
        totalReviews: 0,
      };

      const allSkillKeys = [
        ...mentorSkillNames.map(buildSkillKey),
        ...skills.map(buildSkillKey),
      ].filter((v, i, arr) => arr.indexOf(v) === i);

      return {
        id: mentor.userId,
        initials: buildInitials(buildFullName(mentor)),
        name: buildFullName(mentor),
        category: skillRecords[0]?.categoryName || 'General',
        rating: ratingSummary.averageRating.toFixed(1),
        reviews: ratingSummary.totalReviews,
        skills: mentorSkillNames.length > 0 ? mentorSkillNames : skills,
        price: '1 credit/hr',
        specialty: topSkill,
        skillIds: allSkillKeys,
      };
    })
    .sort((left, right) => {
      return Number.parseFloat(right.rating) - Number.parseFloat(left.rating);
    });
};

const buildProfileReviews = async (userId) => {
  const reviews = await Rating.find({ toUser: userId }).sort({ createdAt: -1 }).lean();

  if (!reviews.length) {
    return [];
  }

  const authorIds = uniqueStrings(reviews.map((review) => review.fromUser));
  const authors = await User.find({ userId: { $in: authorIds } }).select('-profilePicture -xpHistory').lean();
  const authorMap = new Map(authors.map((author) => [author.userId, author]));

  return reviews.map((review) => ({
    id: review._id?.toString?.() || review.sessionId,
    author: buildFullName(authorMap.get(review.fromUser) || { email: review.fromUser }),
    rating: review.score,
    reviewedAt: review.createdAt,
    text: review.comment || '',
  }));
};

const buildXpStatCard = (xpProfile) => {
  const xpTotal = xpProfile?.xpTotal ?? 0;
  const level = xpProfile?.level ?? 1;
  const levelTitle = xpProfile?.levelTitle ?? 'Seed';

  return {
    id: 'xp',
    label: 'Your level',
    value: `Lv${level} · ${levelTitle}`,
    note: xpProfile?.isMaxLevel
      ? `${xpTotal.toLocaleString()} XP · Oasis reached`
      : `${xpTotal.toLocaleString()} XP · ${xpProfile?.progressPercent ?? 0}% to next level`,
    icon: 'xp',
  };
};

const getOverview = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);
  const xp = formatXpProfile(user, { includeHistory: true, historyLimit: 5 });
  const [sessions, userRatingMap, ownSkillMap, mentorDirectory] = await Promise.all([
    Session.find({
      $or: [{ teacherId: user.userId }, { learnerId: user.userId }],
    })
      .sort({ date: 1, createdAt: -1 })
      .limit(100)
      .lean(),
    buildRatingSummaryMap([user.userId]),
    buildSkillRecordsByUserId([user.userId]),
    isMentorUser(user) ? Promise.resolve([]) : buildMentorDirectory(user.userId, { limit: 4 }),
  ]);

  const participantIds = uniqueStrings(
    sessions.flatMap((session) => [session.teacherId, session.learnerId])
  ).filter((userId) => userId !== user.userId);
  const participants = participantIds.length
    ? await User.find({ userId: { $in: participantIds } }).select('-profilePicture -xpHistory').lean()
    : [];
  const participantMap = new Map(participants.map((participant) => [participant.userId, participant]));

  const now = new Date();
  const upcomingSessions = sessions
    .filter((session) => {
      return ['PENDING', 'ACCEPTED'].includes(session.status) && new Date(session.date) >= now;
    })
    .slice(0, 4)
    .map((session) => {
      const otherUserId = session.teacherId === user.userId ? session.learnerId : session.teacherId;
      const otherUser = participantMap.get(otherUserId);

      return {
        id: session.sessionId,
        initials: buildInitials(buildFullName(otherUser || { email: otherUserId })),
        title: session.skill,
        mentor: buildFullName(otherUser || { email: otherUserId }),
        time: formatDateTimeLabel(session.date),
        duration: formatDurationLabel(session.duration),
      };
    });

  const ownSkillRecords = ownSkillMap.get(user.userId) || [];
  const ownSkills = getCombinedSkillNames(user, ownSkillRecords);
  const completedSessions = sessions.filter((session) => session.status === 'COMPLETED').length;
  const acceptedSessions = sessions.filter((session) => session.status === 'ACCEPTED').length;
  const ratingSummary = userRatingMap.get(user.userId) || {
    averageRating: 0,
    totalReviews: 0,
  };

  const recommendedSkills = mentorDirectory.slice(0, 4).map((mentor) => ({
    id: mentor.id,
    initials: mentor.initials,
    title: mentor.skills[0] || mentor.specialty,
    mentor: mentor.name,
    rating: mentor.rating,
    price: mentor.price,
  }));

  const baseOverview = {
    welcome: {
      firstName: user.firstName || 'Member',
      isFirstVisit: !user.lastLogin,
    },
    role: isMentorUser(user) ? 'mentor' : 'learner',
    creditsAvailable: readDecimalValue(user.timeCredits),
    xp,
    upcomingSessions,
    recommendedSkills,
  };

  if (isMentorUser(user)) {
    const validationOverview = await getMentorValidationOverview(user.userId);

    return {
      ...baseOverview,
      recommendedSkills: [],
      validationOverview: validationOverview.summary,
      pendingValidationRequests: validationOverview.recentPending,
      recentValidationActivity: validationOverview.recentActivity,
      stats: [
        buildXpStatCard(xp),
        {
          id: 'pending-validations',
          label: 'Pending reviews',
          value: String(validationOverview.summary.pending),
          note: 'Awaiting your decision',
          icon: 'validation-pending',
        },
        {
          id: 'validated-skills',
          label: 'Skills validated',
          value: String(validationOverview.summary.validated),
          note:
            validationOverview.summary.validated > 0
              ? `Avg score ${validationOverview.summary.averageValidationScore}/100`
              : 'No validations yet',
          icon: 'validation-approved',
        },
        {
          id: 'rejected-validations',
          label: 'Requests rejected',
          value: String(validationOverview.summary.rejected),
          note: 'Learners cannot teach these skills',
          icon: 'validation-rejected',
        },
        {
          id: 'total-validations',
          label: 'Total requests',
          value: String(validationOverview.summary.total),
          note: `${completedSessions} sessions completed`,
          icon: 'validation',
        },
      ],
    };
  }

  return {
    ...baseOverview,
    stats: [
      buildXpStatCard(xp),
      {
        id: 'credits',
        label: 'Credits Balance',
        value: String(readDecimalValue(user.timeCredits)),
        note: 'Available now',
        icon: 'credits',
      },
      {
        id: 'sessions',
        label: 'Sessions Completed',
        value: String(completedSessions),
        note: `${acceptedSessions} active`,
        icon: 'sessions',
      },
      {
        id: 'skills',
        label: 'Skills Listed',
        value: String(ownSkills.length),
        note: `${ownSkillRecords.filter((skill) => skill.validationStatus === 'VALIDATED').length} validated`,
        icon: 'skills',
      },
      {
        id: 'rating',
        label: 'Community Rating',
        value: ratingSummary.averageRating.toFixed(1),
        note: `${ratingSummary.totalReviews} review${ratingSummary.totalReviews === 1 ? '' : 's'}`,
        icon: 'validation',
      },
    ],
  };
};

const getProfile = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);

  // Pipeline: kick off SkillEvidence / MentorCredential as soon as their
  // direct dependencies resolve — don't stall waiting for unrelated queries.
  const skillsAndEvidencePromise = buildSkillRecordsByUserId([user.userId]).then(
    async (skillMap) => {
      const skillRecords = skillMap.get(user.userId) || [];
      const skillIds = skillRecords.map((skill) => skill.skillId);
      const evidenceItems = skillIds.length
        ? await SkillEvidence.find({ skillId: { $in: skillIds } }).lean()
        : [];
      return { skillMap, evidenceItems };
    }
  );

  const credentialsPromise = MentorApplication.find({ userId: user.userId })
    .lean()
    .then(async (mentorApplications) => {
      const applicationIds = mentorApplications.map((application) => application.applicationId);
      const credentialItems = applicationIds.length
        ? await MentorCredential.find({ applicationId: { $in: applicationIds } }).lean()
        : [];
      return { mentorApplications, credentialItems };
    });

  const [
    { skillMap, evidenceItems },
    ratingSummaryMap,
    reviews,
    { mentorApplications, credentialItems },
    locationLabelMap,
    activeRequests,
  ] = await Promise.all([
    skillsAndEvidencePromise,
    buildRatingSummaryMap([user.userId]),
    buildProfileReviews(user.userId),
    credentialsPromise,
    buildLocationLabelMap([user]),
    ValidationRequest.find({ learnerUserId: user.userId }).lean(),
  ]);

  const skillRecords = skillMap.get(user.userId) || [];
  const ratingSummary = ratingSummaryMap.get(user.userId) || {
    averageRating: 0,
    totalReviews: 0,
  };

  const requestMap = new Map(
    activeRequests
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .map((r) => [r.skillId, r])
  );

  const skills =
    skillRecords.length > 0
      ? skillRecords.map((skill) => {
          const req = requestMap.get(skill.skillId);
          let validationState = 'pending';
          if (skill.validationStatus === 'VALIDATED') {
            validationState = 'validated';
          } else if (req?.requestStatus === 'REJECTED') {
            validationState = 'rejected';
          } else if (req && ['PENDING', 'IN_REVIEW'].includes(req.requestStatus)) {
            validationState = 'in_review';
          }
          return {
            id: skill.skillId,
            name: skill.skillName,
            proficiency: toTitleCase(skill.proficiencyLevel),
            validationState,
            validationScore: skill.validationScore || 0,
          };
        })
      : (user.offeredSkills || []).map((skillName) => ({
          id: buildSkillKey(skillName),
          name: skillName,
          proficiency: 'Beginner',
          validationState: 'pending',
          validationScore: 0,
        }));

  const documents = [
    ...(user.resumeStoredName
      ? [
          {
            id: `${user.userId}-resume`,
            fileName: user.resumeFileName || 'Resume.pdf',
            uploadedAt: user.resumeUploadedAt,
            href: buildResumeDownloadUrl(user.resumeStoredName),
          },
        ]
      : []),
    ...credentialItems
      .filter((credential) => ['CV', 'CERTIFICATE', 'PROJECT'].includes(credential.credentialType))
      .map((credential) => ({
        id: credential.credentialId,
        fileName: credential.title,
        uploadedAt: credential.uploadedAt,
        href: credential.credentialUrl,
      })),
  ];

  const links = uniqueLinksByHref([
    ...(user.portfolioUrl
      ? [
          {
            id: `${user.userId}-portfolio`,
            label: 'Portfolio',
            href: user.portfolioUrl,
          },
        ]
      : []),
    ...uniqueStrings(
      [
        ...credentialItems
          .filter((credential) => ['LINKEDIN', 'PORTFOLIO', 'OTHER'].includes(credential.credentialType))
          .map((credential) =>
            JSON.stringify({
              id: credential.credentialId,
              label: credential.title,
              href: credential.credentialUrl,
            })
          ),
        ...evidenceItems.map((evidence) =>
          JSON.stringify({
            id: evidence.evidenceId,
            label: evidence.title,
            href: evidence.evidenceUrl,
          })
        ),
      ]
    ).map((item) => JSON.parse(item)),
  ]);

  return {
    id: user.userId,
    fullName: buildFullName(user),
    roleLabel: toTitleCase(user.role),
    profilePicture: user.profilePicture || '',
    rating: ratingSummary.averageRating,
    location: locationLabelMap.get(user.userId) || 'Location not set',
    memberSince: user.createdAt,
    credits: readDecimalValue(user.timeCredits),
    about: user.bio || '',
    languages: user.languages || [],
    responseTime: 'Usually replies within 24 hours',
    skills,
    portfolio: {
      documents,
      links,
    },
    reviews,
    badges: Array.isArray(user.badges) ? user.badges : [],
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
  };
};

const getExploreDirectory = async (currentUser) => {
  ensureAuthenticatedUser(currentUser);
  const mentors = await buildMentorDirectory(currentUser.userId);
  const categories = uniqueStrings(['All', ...mentors.map((mentor) => mentor.category)]);

  return {
    categories,
    mentors,
  };
};

const getValidationData = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);
  const [skillMap, mentorDirectory, sessions, activeRequests, globalSkillCatalog] = await Promise.all([
    buildSkillRecordsByUserId([user.userId]),
    buildMentorDirectory(user.userId),
    Session.find({
      $or: [{ teacherId: user.userId }, { learnerId: user.userId }],
    }).lean(),
    ValidationRequest.find({ learnerUserId: user.userId }).lean(),
    buildGlobalSkillCatalog(),
  ]);

  const skillRecords = skillMap.get(user.userId) || [];
  const skillIds = skillRecords.map((skill) => skill.skillId);
  const evidenceItems = skillIds.length
    ? await SkillEvidence.find({ skillId: { $in: skillIds } }).lean()
    : [];
  const evidenceCountMap = new Map();

  evidenceItems.forEach((evidence) => {
    evidenceCountMap.set(
      evidence.skillId,
      (evidenceCountMap.get(evidence.skillId) || 0) + 1
    );
  });

  const requestMap = new Map(
    activeRequests
      .sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))
      .map((request) => [request.skillId, request])
  );

  const derivedSkills =
    skillRecords.length > 0
      ? skillRecords
      : (user.offeredSkills || []).map((skillName) => ({
          skillId: '',
          skillName,
          categoryName: 'General',
          proficiencyLevel: 'BEGINNER',
          validationStatus: 'UNVALIDATED',
          validationScore: 0,
        }));

  const profileSkillOptions = derivedSkills.map((skill) => {
    const evidenceCount = skill.skillId ? evidenceCountMap.get(skill.skillId) || 0 : 0;
    const activeRequest = skill.skillId ? requestMap.get(skill.skillId) : null;

    return {
      id: buildSkillKey(skill.skillName),
      skillId: skill.skillId || '',
      label: skill.skillName,
      description: `${toTitleCase(skill.proficiencyLevel)}${skill.categoryName ? ` - ${skill.categoryName}` : ''}`,
      evidenceCount,
      hasExistingEvidence: evidenceCount > 0,
      requestStatus: activeRequest?.requestStatus || '',
      validationStatus: skill.validationStatus || 'UNVALIDATED',
      canTeach: skill.validationStatus === 'VALIDATED',
      isProfileSkill: true,
      isCatalogSkill: true,
    };
  });

  const profileSkillNameSet = new Set(
    profileSkillOptions.map((skill) => buildNormalizedSkillNameKey(skill.label))
  );
  const skillOptions = [
    ...profileSkillOptions,
    ...globalSkillCatalog.filter((skill) => {
      return !profileSkillNameSet.has(buildNormalizedSkillNameKey(skill.label));
    }),
  ];

  const mentorOptions = mentorDirectory.map((mentor) => ({
    id: mentor.id,
    initials: mentor.initials,
    name: mentor.name,
    specialty: mentor.specialty,
    rating: mentor.rating,
    skillIds: mentor.skillIds,
  }));

  const skills = derivedSkills.map((skill) => {
    const evidenceCount = skill.skillId ? evidenceCountMap.get(skill.skillId) || 0 : 0;
    const activeRequest = skill.skillId ? requestMap.get(skill.skillId) : null;
    let status = 'ready';

    if (skill.validationStatus === 'VALIDATED') {
      status = 'validated';
    } else if (activeRequest?.requestStatus === 'REJECTED') {
      status = 'rejected';
    } else if (activeRequest && ['PENDING', 'IN_REVIEW'].includes(activeRequest.requestStatus)) {
      status = 'in_review';
    } else if (evidenceCount === 0) {
      status = 'missing_evidence';
    }

    return {
      id: skill.skillId || buildSkillKey(skill.skillName),
      name: skill.skillName,
      category: skill.categoryName || 'General',
      level: toTitleCase(skill.proficiencyLevel),
      status,
      validationScore: skill.validationScore || 0,
      canTeach: skill.validationStatus === 'VALIDATED',
      endorsements: Math.max(0, Math.round((skill.validationScore || 0) / 20)),
      evidenceCount,
    };
  });

  const completedSessions = sessions.filter((session) => session.status === 'COMPLETED').length;
  const hasActiveRequest = activeRequests.some((request) =>
    ['PENDING', 'IN_REVIEW'].includes(request.requestStatus)
  );

  return {
    intro: {
      title: 'Validate your skills with real platform data',
      description:
        'Choose one of your backend skills, attach proof of work, and send a validation request to an available mentor.',
      benefits: [
        'Increase trust around your public profile.',
        'Make your strongest skills easier to discover.',
        'Turn completed work and session history into proof.',
      ],
    },
    queue: {
      title: 'Skills ready for validation',
      description: 'These skills are loaded from your current backend profile and evidence records.',
    },
    requestFlow: {
      title: 'Request Skill Validation',
      steps: [
        { key: 'select-skill', label: 'Select Skill' },
        { key: 'choose-mentor', label: 'Choose Mentor' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'submit', label: 'Submit' },
      ],
      skillOptions,
      mentorOptions,
      evidenceTips: [
        'Add a portfolio link, repository, or public project.',
        'Mention concrete outcomes or session context in your note.',
        'Pick a mentor whose expertise matches your selected skill.',
      ],
    },
    skills,
    checklist: {
      title: 'Validation checklist',
      description: 'Use your actual backend data to see what is still missing.',
      steps: [
        {
          id: 'proof-of-work',
          title: 'Attach proof of work',
          description: 'At least one saved evidence link helps reviewers validate faster.',
          complete: evidenceItems.length > 0,
        },
        {
          id: 'session-history',
          title: 'Show session history',
          description: 'Completed sessions make your skill story more credible.',
          complete: completedSessions > 0,
        },
        {
          id: 'peer-request',
          title: 'Send a mentor request',
          description: 'An open request confirms that a review is in progress.',
          complete: hasActiveRequest,
        },
      ],
    },
    reviewPanel: {
      title: 'How review works',
      description:
        'Reviewers compare the selected skill, your evidence, and your platform activity before validating it.',
      points: [
        'Mentors receive a notification when a new request is submitted.',
        'Evidence can be updated later by sending a stronger link.',
        'Validated skills will appear with a validated status in the profile section.',
      ],
    },
  };
};

const createValidationRequest = async (currentUser, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalizedMentorUserId = payload.mentorUserId?.trim();
  const normalizedSkillId = payload.skillId?.trim();
  const normalizedSkillName = payload.skillName?.trim();
  const normalizedPortfolioLink = payload.portfolioLink?.trim() || '';
  const normalizedNote = payload.note?.trim() || '';

  if (!normalizedMentorUserId) {
    throw new ApiError(400, 'mentorUserId is required', 'VALIDATION_ERROR');
  }

  if (!normalizedSkillId && !normalizedSkillName) {
    throw new ApiError(400, 'skillId or skillName is required', 'VALIDATION_ERROR');
  }

  const mentor = await User.findOne({
    userId: normalizedMentorUserId,
    role: 'MENTOR',
    accountStatus: 'ACTIVE',
  });

  if (!mentor) {
    throw new ApiError(404, 'Mentor not found', 'USER_NOT_FOUND');
  }

  let skill = null;

  if (normalizedSkillId) {
    skill = await Skill.findOne({
      skillId: normalizedSkillId,
      userId: user.userId,
    });
  }

  if (!skill && normalizedSkillName) {
    skill = await Skill.findOne({
      userId: user.userId,
      skillName: new RegExp(`^${escapeRegExp(normalizedSkillName)}$`, 'i'),
    });
  }

  if (!skill) {
    if (!normalizedSkillName) {
      throw new ApiError(404, 'Skill not found for the current user', 'SKILL_NOT_FOUND');
    }

    const fallbackCategory = await ensureDefaultSkillCategory();

    skill = await Skill.create({
      skillId: `SKILL-${randomUUID()}`,
      userId: user.userId,
      categoryId: fallbackCategory.categoryId,
      skillName: normalizedSkillName,
      proficiencyLevel: 'BEGINNER',
      selfDeclared: true,
      validationStatus: 'UNVALIDATED',
      validationScore: 0,
    });
  }

  const existingOpenRequest = await ValidationRequest.findOne({
    skillId: skill.skillId,
    learnerUserId: user.userId,
    requestStatus: { $in: ['PENDING', 'IN_REVIEW'] },
  });

  if (existingOpenRequest) {
    throw new ApiError(
      409,
      'A validation request for this skill is already in progress',
      'VALIDATION_REQUEST_EXISTS'
    );
  }

  if (normalizedPortfolioLink) {
    const existingEvidence = await SkillEvidence.findOne({
      skillId: skill.skillId,
      evidenceUrl: normalizedPortfolioLink,
    });

    if (!existingEvidence) {
      await SkillEvidence.create({
        evidenceId: `EVD-${randomUUID()}`,
        skillId: skill.skillId,
        evidenceType: 'PORTFOLIO_LINK',
        evidenceUrl: normalizedPortfolioLink,
        title: `${skill.skillName} portfolio`,
        description: normalizedNote,
      });
    }
  }

  const request = await ValidationRequest.create({
    requestId: `VAL-${randomUUID()}`,
    skillId: skill.skillId,
    learnerUserId: user.userId,
    mentorUserId: mentor.userId,
    requestStatus: 'PENDING',
    portfolioLink: normalizedPortfolioLink,
    requestNote: normalizedNote,
    proofFileName: payload.proofFileName || '',
    proofStoredName: payload.proofStoredName || '',
    proofMimeType: payload.proofMimeType || '',
  });

  if (skill.validationStatus !== 'PENDING') {
    skill.validationStatus = 'PENDING';
    skill.lastUpdated = new Date();
    await skill.save();
  }

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: mentor.userId,
    notificationType: 'VALIDATION_REQUEST',
    title: 'New validation request',
    description: `${buildFullName(user)} requested validation for ${skill.skillName}.`,
    relatedEntityId: request.requestId,
  });

  return {
    requestId: request.requestId,
    skillId: request.skillId,
    mentorUserId: request.mentorUserId,
    status: request.requestStatus,
    submittedAt: request.submittedAt,
  };
};

module.exports = {
  getOverview,
  getProfile,
  getExploreDirectory,
  getValidationData,
  createValidationRequest,
};
