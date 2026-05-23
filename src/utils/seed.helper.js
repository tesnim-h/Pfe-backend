const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const City = require('../models/City');
const Conversation = require('../models/Conversation');
const Country = require('../models/Country');
const CreditBalance = require('../models/CreditBalance');
const CreditTransaction = require('../models/CreditTransaction');
const Learner = require('../models/Learner');
const Mentor = require('../models/Mentor');
const MentorApplication = require('../models/MentorApplication');
const MentorCredential = require('../models/MentorCredential');
const MentorSkill = require('../models/MentorSkill');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const PlatformStatistics = require('../models/PlatformStatistics');
const Session = require('../models/Session');
const SessionRequest = require('../models/SessionRequest');
const SessionReview = require('../models/SessionReview');
const Skill = require('../models/Skill');
const SkillCategory = require('../models/SkillCategory');
const SkillEvidence = require('../models/SkillEvidence');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const ValidationRequest = require('../models/ValidationRequest');

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';

const decimal = (value) => mongoose.Types.Decimal128.fromString(String(value));

const baseDate = new Date('2026-04-20T09:00:00.000Z');

const at = (dayOffset = 0, hourOffset = 0, minuteOffset = 0) =>
  new Date(
    baseDate.getTime() +
      dayOffset * 24 * 60 * 60 * 1000 +
      hourOffset * 60 * 60 * 1000 +
      minuteOffset * 60 * 1000
  );

const ids = {
  countries: {
    dz: 'COUNTRY-DZ',
    fr: 'COUNTRY-FR',
  },
  cities: {
    algiers: 'CITY-ALG-001',
    oran: 'CITY-ORN-001',
    paris: 'CITY-PAR-001',
  },
  users: {
    admin: 'USER-ADMIN-001',
    mentor: 'USER-MENTOR-001',
    learner: 'USER-LEARNER-001',
  },

  categories: {
    technology: 'CATEGORY-TECH-001',
    web: 'CATEGORY-WEB-001',
    data: 'CATEGORY-DATA-001',
    design: 'CATEGORY-DESIGN-001',
  },
  skills: {
    node: 'SKILL-NODE-001',
    mongo: 'SKILL-MONGO-001',
    react: 'SKILL-REACT-001',
  },
  mentorSkills: {
    node: 'MENTOR-SKILL-001',
    mongo: 'MENTOR-SKILL-002',
  },
  application: 'MENTOR-APPLICATION-001',
  credentials: {
    linkedin: 'MENTOR-CREDENTIAL-001',
    portfolio: 'MENTOR-CREDENTIAL-002',
  },
  evidence: 'SKILL-EVIDENCE-001',
  validationRequest: 'VALIDATION-REQUEST-001',
  conversation: 'CONVERSATION-001',
  messages: {
    first: 'MESSAGE-001',
    second: 'MESSAGE-002',
    third: 'MESSAGE-003',
  },
  sessionRequest: 'SESSION-REQUEST-001',
  session: 'SESSION-001',
  review: 'SESSION-REVIEW-001',
  notifications: {
    session: 'NOTIFICATION-001',
    message: 'NOTIFICATION-002',
    validation: 'NOTIFICATION-003',
  },
  audit: 'AUDIT-001',
  balances: {
    admin: 'BALANCE-001',
    mentor: 'BALANCE-002',
    learner: 'BALANCE-003',
  },
  transactions: {
    learnerInitial: 'TRANSACTION-001',
    mentorInitial: 'TRANSACTION-002',
    learnerSpend: 'TRANSACTION-003',
    mentorEarn: 'TRANSACTION-004',
  },
  settings: {
    initialCredits: 'SETTING-001',
  },
  stats: 'PLATFORM-STATISTICS-001',
};

const buildSeedCollections = async () => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const countries = [
    {
      countryId: ids.countries.dz,
      code: 'DZ',
      name: 'Algeria',
      phoneCode: '+213',
      currency: 'DZD',
      isActive: true,
    },
    {
      countryId: ids.countries.fr,
      code: 'FR',
      name: 'France',
      phoneCode: '+33',
      currency: 'EUR',
      isActive: true,
    },
  ];

  const cities = [
    {
      cityId: ids.cities.algiers,
      countryId: ids.countries.dz,
      name: 'Algiers',
      latitude: decimal('36.7538'),
      longitude: decimal('3.0588'),
      isActive: true,
    },
    {
      cityId: ids.cities.oran,
      countryId: ids.countries.dz,
      name: 'Oran',
      latitude: decimal('35.6981'),
      longitude: decimal('-0.6348'),
      isActive: true,
    },
    {
      cityId: ids.cities.paris,
      countryId: ids.countries.fr,
      name: 'Paris',
      latitude: decimal('48.8566'),
      longitude: decimal('2.3522'),
      isActive: true,
    },
  ];

  const users = [
    {
      userId: ids.users.admin,
      email: 'admin@fenneky.dev',
      passwordHash,
      firstName: 'Nora',
      lastName: 'Admin',
      profilePicture: '',
      bio: 'Platform administrator responsible for trust and governance.',
      countryId: ids.countries.dz,
      cityId: ids.cities.algiers,
      languages: ['fr', 'en', 'ar'],
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      createdAt: at(-120),
      lastLogin: at(-1, 2),
      timeCredits: decimal('0'),
    },
    {
      userId: ids.users.mentor,
      email: 'mentor@fenneky.dev',
      passwordHash,
      firstName: 'Yacine',
      lastName: 'Bensaid',
      profilePicture: '',
      bio: 'Backend mentor focused on Node.js, APIs, and MongoDB.',
      countryId: ids.countries.dz,
      cityId: ids.cities.oran,
      languages: ['fr', 'en'],
      role: 'MENTOR',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      createdAt: at(-100),
      lastLogin: at(-1, 1),
      timeCredits: decimal('12'),
    },
    {
      userId: ids.users.learner,
      email: 'learner@fenneky.dev',
      passwordHash,
      firstName: 'Lina',
      lastName: 'Mekki',
      profilePicture: '',
      bio: 'Frontend learner working toward stronger React and API skills.',
      countryId: ids.countries.dz,
      cityId: ids.cities.algiers,
      languages: ['fr', 'en'],
      role: 'LEARNER',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      createdAt: at(-75),
      lastLogin: at(-1, 4),
      timeCredits: decimal('4'),
    },
  ];

  const learners = [
    {
      userId: ids.users.mentor,
      learningGoals: 'Keep exploring system design and mentoring workflows.',
      preferredLearningStyle: 'Project-based',
      totalSessionsAttended: 3,
      totalSessionsTaught: 6,
      averageRatingAsTeacher: 4.9,
      averageRatingAsLearner: 4.7,
      profileCompleted: true,
    },
    {
      userId: ids.users.learner,
      learningGoals: 'Build production-ready full-stack applications.',
      preferredLearningStyle: 'Hands-on',
      totalSessionsAttended: 4,
      totalSessionsTaught: 0,
      averageRatingAsTeacher: 0,
      averageRatingAsLearner: 4.8,
      profileCompleted: true,
    },
  ];

  const admins = [
    {
      userId: ids.users.admin,
      assignedSkillCategoryId: ids.categories.technology,
      skillName: 'Platform governance',
      permissions: [
        'manage_users',
        'manage_admins',
        'moderate_users',
        'review_reports',
        'verify_mentors',
        'manage_categories',
        'manage_settings',
        'view_dashboard',
        'view_audit_logs',
      ],
      assignedDate: at(-90),
      lastActiveDate: at(-1, 2),
    },
  ];

  const skillCategories = [
    {
      categoryId: ids.categories.technology,
      categoryName: 'Technology',
      parentCategoryId: '',
      description: 'Technical skills across software, data, and digital tools.',
      iconUrl: '',
      assignedAdminUserId: ids.users.admin,
      createdAt: at(-120),
      isActive: true,
    },
    {
      categoryId: ids.categories.web,
      categoryName: 'Web Development',
      parentCategoryId: ids.categories.technology,
      description: 'Frontend, backend, and API development skills.',
      iconUrl: '',
      assignedAdminUserId: ids.users.admin,
      createdAt: at(-115),
      isActive: true,
    },
    {
      categoryId: ids.categories.data,
      categoryName: 'Data & Databases',
      parentCategoryId: ids.categories.technology,
      description: 'Database design, querying, and data modeling.',
      iconUrl: '',
      assignedAdminUserId: ids.users.admin,
      createdAt: at(-115),
      isActive: true,
    },
    {
      categoryId: ids.categories.design,
      categoryName: 'Product Design',
      parentCategoryId: '',
      description: 'UI, UX, research, and product discovery skills.',
      iconUrl: '',
      assignedAdminUserId: ids.users.admin,
      createdAt: at(-110),
      isActive: true,
    },
  ];

  const mentors = [
    {
      userId: ids.users.mentor,
      verificationStatus: 'VERIFIED',
      totalValidationsPerformed: 4,
      averageValidationRating: decimal('4.8'),
      verifiedAt: at(-60),
      verifiedBy: ids.users.admin,
      suspendedAt: null,
      suspensionReason: '',
    },
  ];

  const skills = [
    {
      skillId: ids.skills.node,
      userId: ids.users.mentor,
      categoryId: ids.categories.web,
      skillName: 'Node.js Backend Development',
      proficiencyLevel: 'EXPERT',
      description: 'Designing REST APIs, service layers, and production-ready backend flows.',
      yearsOfExperience: 5,
      selfDeclared: false,
      validationStatus: 'VALIDATED',
      validationScore: 95,
      validatedBy: ids.users.mentor,
      validatedAt: at(-55),
      createdAt: at(-95),
      lastUpdated: at(-10),
    },
    {
      skillId: ids.skills.mongo,
      userId: ids.users.mentor,
      categoryId: ids.categories.data,
      skillName: 'MongoDB Data Modeling',
      proficiencyLevel: 'ADVANCED',
      description: 'Schema design, indexing strategy, and document relationships.',
      yearsOfExperience: 4,
      selfDeclared: false,
      validationStatus: 'VALIDATED',
      validationScore: 91,
      validatedBy: ids.users.mentor,
      validatedAt: at(-54),
      createdAt: at(-95),
      lastUpdated: at(-8),
    },
    {
      skillId: ids.skills.react,
      userId: ids.users.learner,
      categoryId: ids.categories.web,
      skillName: 'React Fundamentals',
      proficiencyLevel: 'INTERMEDIATE',
      description: 'Building reusable components, pages, and API-connected UIs.',
      yearsOfExperience: 1,
      selfDeclared: true,
      validationStatus: 'PENDING',
      validationScore: 0,
      createdAt: at(-20),
      lastUpdated: at(-2),
    },
  ];

  const mentorSkills = [
    {
      mentorSkillId: ids.mentorSkills.node,
      userId: ids.users.mentor,
      skillCategoryId: ids.categories.web,
      skillName: 'Node.js Backend Development',
      verificationDate: at(-60),
      verifiedBy: ids.users.admin,
      isActive: true,
    },
    {
      mentorSkillId: ids.mentorSkills.mongo,
      userId: ids.users.mentor,
      skillCategoryId: ids.categories.data,
      skillName: 'MongoDB Data Modeling',
      verificationDate: at(-60),
      verifiedBy: ids.users.admin,
      isActive: true,
    },
  ];

  const mentorApplications = [
    {
      applicationId: ids.application,
      userId: ids.users.learner,
      skillCategoryId: ids.categories.web,
      skillName: 'Frontend Mentoring',
      applicationStatus: 'PENDING',
      submittedAt: at(-5),
      professionalStatement:
        'I enjoy helping beginners structure React projects and component libraries.',
      yearsOfExperience: 2,
      previousApplications: 0,
    },
  ];

  const mentorCredentials = [
    {
      credentialId: ids.credentials.linkedin,
      applicationId: ids.application,
      credentialType: 'LINKEDIN',
      credentialUrl: 'https://www.linkedin.com/in/lina-mekki',
      title: 'LinkedIn profile',
      description: 'Professional profile highlighting frontend work.',
      uploadedAt: at(-5, 1),
      isVerified: false,
    },
    {
      credentialId: ids.credentials.portfolio,
      applicationId: ids.application,
      credentialType: 'PORTFOLIO',
      credentialUrl: 'https://portfolio.lina.dev',
      title: 'Frontend portfolio',
      description: 'Selected projects built with React and modern UI patterns.',
      uploadedAt: at(-5, 2),
      isVerified: false,
    },
  ];

  const skillEvidence = [
    {
      evidenceId: ids.evidence,
      skillId: ids.skills.react,
      evidenceType: 'GITHUB_REPO',
      evidenceUrl: 'https://github.com/lina/react-learning-dashboard',
      title: 'React learning dashboard',
      description: 'Practice project showing state management and API usage.',
      uploadedAt: at(-4),
      isVerified: false,
    },
  ];

  const validationRequests = [
    {
      requestId: ids.validationRequest,
      skillId: ids.skills.react,
      learnerUserId: ids.users.learner,
      mentorUserId: ids.users.mentor,
      requestStatus: 'IN_REVIEW',
      submittedAt: at(-3),
      validationFeedback: 'Waiting for mentor review and live walkthrough.',
    },
  ];

  const conversations = [
    {
      conversationId: ids.conversation,
      participant1Id: ids.users.mentor,
      participant2Id: ids.users.learner,
      createdAt: at(-7),
      lastMessageAt: at(-1, 5),
      isActive: true,
    },
  ];

  const messages = [
    {
      messageId: ids.messages.first,
      conversationId: ids.conversation,
      senderId: ids.users.learner,
      content: 'Hi Yacine, can we review hooks and API calls during the next session?',
      isRead: true,
      createdAt: at(-2, 1),
    },
    {
      messageId: ids.messages.second,
      conversationId: ids.conversation,
      senderId: ids.users.mentor,
      content: 'Yes, bring your current component and we will refactor it together.',
      isRead: true,
      createdAt: at(-2, 2),
    },
    {
      messageId: ids.messages.third,
      conversationId: ids.conversation,
      senderId: ids.users.learner,
      content: 'Perfect, I also added a repo link for the validation request.',
      isRead: false,
      createdAt: at(-1, 5),
    },
  ];

  const sessionRequests = [
    {
      requestId: ids.sessionRequest,
      learnerId: ids.users.learner,
      teacherId: ids.users.mentor,
      skillId: ids.skills.node,
      requestStatus: 'COMPLETED',
      preferredDuration: 90,
      scheduledDate: at(-1, 6),
      proposedByTeacher: at(-3),
      responseDate: at(-2, 4),
      createdAt: at(-3, -1),
    },
  ];

  const sessions = [
    {
      sessionId: ids.session,
      requestId: ids.sessionRequest,
      learnerId: ids.users.learner,
      teacherId: ids.users.mentor,
      skillId: ids.skills.node,
      sessionStatus: 'COMPLETED',
      startTime: at(-1, 6),
      endTime: at(-1, 7, 30),
      actualDuration: 90,
      creditsExchanged: 6,
      completedAt: at(-1, 7, 30),
      createdAt: at(-3),
    },
  ];

  const sessionReviews = [
    {
      reviewId: ids.review,
      sessionId: ids.session,
      reviewerId: ids.users.learner,
      reviewedId: ids.users.mentor,
      rating: 5,
      comment: 'Clear explanations, good pace, and actionable backend feedback.',
      createdAt: at(-1, 9),
      isPublic: true,
    },
  ];

  const notifications = [
    {
      notificationId: ids.notifications.session,
      userId: ids.users.learner,
      notificationType: 'SESSION_REQUEST',
      title: 'Session completed',
      description: 'Your mentoring session was completed and credits were exchanged.',
      relatedEntityId: ids.session,
      isRead: true,
      createdAt: at(-1, 8),
    },
    {
      notificationId: ids.notifications.message,
      userId: ids.users.mentor,
      notificationType: 'MESSAGE',
      title: 'New message from Lina',
      description: 'The learner added details about the upcoming validation review.',
      relatedEntityId: ids.messages.third,
      isRead: false,
      createdAt: at(-1, 5),
    },
    {
      notificationId: ids.notifications.validation,
      userId: ids.users.mentor,
      notificationType: 'VALIDATION_REQUEST',
      title: 'Validation request assigned',
      description: 'A React skill validation request is waiting for your review.',
      relatedEntityId: ids.validationRequest,
      isRead: false,
      createdAt: at(-3, 1),
    },
  ];

  const auditLogs = [
    {
      auditId: ids.audit,
      adminUserId: ids.users.admin,
      userId: ids.users.mentor,
      actionType: 'MENTOR_VERIFIED',
      targetEntityId: ids.users.mentor,
      targetEntityType: 'Mentor',
      details: {
        verificationStatus: 'VERIFIED',
        categories: [ids.categories.web, ids.categories.data],
      },
      reason: 'Initial onboarding review passed.',
      timestamp: at(-60),
      ipAddress: '',
    },
  ];

  const creditBalances = [
    {
      balanceId: ids.balances.admin,
      userId: ids.users.admin,
      currentBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      lastUpdated: at(-1),
      updatedBy: ids.users.admin,
    },
    {
      balanceId: ids.balances.mentor,
      userId: ids.users.mentor,
      currentBalance: 12,
      totalEarned: 12,
      totalSpent: 0,
      lastUpdated: at(-1, 8),
      updatedBy: ids.users.admin,
    },
    {
      balanceId: ids.balances.learner,
      userId: ids.users.learner,
      currentBalance: 4,
      totalEarned: 10,
      totalSpent: 6,
      lastUpdated: at(-1, 8),
      updatedBy: ids.users.admin,
    },
  ];

  const creditTransactions = [
    {
      fromUser: ids.users.learner,
      toUser: ids.users.mentor,
      amount: 6,
      sessionId: ids.session,
      type: 'TRANSFER',
      createdAt: at(-1, 8),
    },
  ];

  const systemSettings = [
    {
      settingId: ids.settings.initialCredits,
      settingKey: 'initial_credit_allocation',
      settingValue: '10',
      description: 'Default credits assigned to new active users.',
      updatedBy: ids.users.admin,
      updatedAt: at(-20),
    },
  ];

  const platformStatistics = [
    {
      statId: ids.stats,
      totalUsers: users.length,
      totalLearners: learners.length,
      totalMentors: mentors.length,
      totalVerifiedMentors: mentors.filter(
        (mentorRecord) => mentorRecord.verificationStatus === 'VERIFIED'
      ).length,
      totalSessions: sessions.length,
      totalCreditsInCirculation: creditBalances.reduce(
        (total, balance) => total + balance.currentBalance,
        0
      ),
      validationRequestsCompleted: validationRequests.filter((request) =>
        ['VALIDATED', 'REJECTED'].includes(request.requestStatus)
      ).length,
      averageSessionRating:
        sessionReviews.reduce((total, review) => total + review.rating, 0) /
        sessionReviews.length,
      mentorApplicationsReceived: mentorApplications.length,
      mentorApplicationsApproved: mentorApplications.filter(
        (application) => application.applicationStatus === 'APPROVED'
      ).length,
      mentorApplicationsRejected: mentorApplications.filter(
        (application) => application.applicationStatus === 'REJECTED'
      ).length,
      lastUpdated: at(),
    },
  ];

  return [
    {
      name: 'countries',
      model: Country,
      key: 'countryId',
      docs: countries,
    },
    {
      name: 'cities',
      model: City,
      key: 'cityId',
      docs: cities,
    },
    {
      name: 'users',
      model: User,
      key: 'userId',
      docs: users,
    },
    {
      name: 'learners',
      model: Learner,
      key: 'userId',
      docs: learners,
    },
    {
      name: 'admins',
      model: Admin,
      key: 'userId',
      docs: admins,
    },
    {
      name: 'skill categories',
      model: SkillCategory,
      key: 'categoryId',
      docs: skillCategories,
    },
    {
      name: 'mentors',
      model: Mentor,
      key: 'userId',
      docs: mentors,
    },
    {
      name: 'skills',
      model: Skill,
      key: 'skillId',
      docs: skills,
    },
    {
      name: 'mentor skills',
      model: MentorSkill,
      key: 'mentorSkillId',
      docs: mentorSkills,
    },
    {
      name: 'mentor applications',
      model: MentorApplication,
      key: 'applicationId',
      docs: mentorApplications,
    },
    {
      name: 'mentor credentials',
      model: MentorCredential,
      key: 'credentialId',
      docs: mentorCredentials,
    },
    {
      name: 'skill evidence',
      model: SkillEvidence,
      key: 'evidenceId',
      docs: skillEvidence,
    },
    {
      name: 'validation requests',
      model: ValidationRequest,
      key: 'requestId',
      docs: validationRequests,
    },
    {
      name: 'conversations',
      model: Conversation,
      key: 'conversationId',
      docs: conversations,
    },
    {
      name: 'messages',
      model: Message,
      key: 'messageId',
      docs: messages,
    },
    {
      name: 'session requests',
      model: SessionRequest,
      key: 'requestId',
      docs: sessionRequests,
    },
    {
      name: 'sessions',
      model: Session,
      key: 'sessionId',
      docs: sessions,
    },
    {
      name: 'session reviews',
      model: SessionReview,
      key: 'reviewId',
      docs: sessionReviews,
    },
    {
      name: 'notifications',
      model: Notification,
      key: 'notificationId',
      docs: notifications,
    },
    {
      name: 'audit logs',
      model: AuditLog,
      key: 'auditId',
      docs: auditLogs,
    },
    {
      name: 'credit balances',
      model: CreditBalance,
      key: 'balanceId',
      docs: creditBalances,
    },
    {
      name: 'credit transactions',
      model: CreditTransaction,
      key: 'sessionId',
      docs: creditTransactions,
    },
    {
      name: 'system settings',
      model: SystemSettings,
      key: 'settingId',
      docs: systemSettings,
    },
    {
      name: 'platform statistics',
      model: PlatformStatistics,
      key: 'statId',
      docs: platformStatistics,
    },
  ];
};

const upsertCollection = async ({ model, key, docs, name }, logger) => {
  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { [key]: doc[key] },
      update: { $set: doc },
      upsert: true,
    },
  }));

  await model.bulkWrite(operations, { ordered: true });
  logger.log(`Seeded ${docs.length} ${name}.`);
};

const seedDatabase = async ({ reset = false, logger = console } = {}) => {
  const collections = await buildSeedCollections();

  if (reset) {
    for (const collection of [...collections].reverse()) {
      await collection.model.deleteMany({});
      logger.log(`Cleared ${collection.name}.`);
    }
  }

  for (const collection of collections) {
    await upsertCollection(collection, logger);
  }

  logger.log('');
  logger.log('Seed completed successfully.');
  logger.log(`Default password: ${DEFAULT_PASSWORD}`);
  logger.log('Demo accounts:');
  logger.log('  admin@fenneky.dev');
  logger.log('  mentor@fenneky.dev');
  logger.log('  learner@fenneky.dev');
};

const shouldSeedDatabase = async () => {
  const collections = await buildSeedCollections();

  for (const collection of collections) {
    const currentCount = await collection.model.countDocuments();
    if (currentCount < collection.docs.length) {
      return true;
    }
  }

  return false;
};

module.exports = {
  seedDatabase,
  shouldSeedDatabase,
  DEFAULT_PASSWORD,
};
