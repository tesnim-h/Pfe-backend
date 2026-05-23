const express = require('express');
const request = require('supertest');

jest.mock('../../src/middleware/auth.middleware', () => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '').trim();

    if (token === 'admin-token') {
      req.user = { userId: 'USR-ADMIN', role: 'admin', accountStatus: 'ACTIVE' };
      return next();
    }

    if (token === 'admin-limited-token') {
      req.user = { userId: 'USR-ADMIN-LIMITED', role: 'ADMIN', accountStatus: 'ACTIVE' };
      return next();
    }

    if (token === 'user-token') {
      req.user = { userId: 'USR-USER-1', role: 'user', accountStatus: 'ACTIVE' };
      return next();
    }

    return next(new Error('Unauthorized test token'));
  };
});

jest.mock('../../src/models/User', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../src/models/Admin', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../src/models/AuditLog', () => ({
  find: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../src/models/Report', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
}));

jest.mock('../../src/models/MentorApplication', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../../src/models/CreditBalance', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../src/models/CreditTransaction', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../../src/models/Session', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../../src/models/SystemSettings', () => {
  const SystemSettings = jest.fn(function SystemSettings(doc) {
    return doc;
  });

  SystemSettings.find = jest.fn();
  SystemSettings.findOne = jest.fn();
  SystemSettings.countDocuments = jest.fn();

  return SystemSettings;
});

const User = require('../../src/models/User');
const Admin = require('../../src/models/Admin');
const AuditLog = require('../../src/models/AuditLog');
const Report = require('../../src/models/Report');
const SystemSettings = require('../../src/models/SystemSettings');
const MentorApplication = require('../../src/models/MentorApplication');
const CreditBalance = require('../../src/models/CreditBalance');
const CreditTransaction = require('../../src/models/CreditTransaction');
const Session = require('../../src/models/Session');
const adminRoutes = require('../../src/routes/admin');
const errorHandler = require('../../src/middleware/error.middleware');

const sortItems = (items, sortSpec = {}) => {
  const [field, direction] = Object.entries(sortSpec)[0] || [];

  if (!field) {
    return [...items];
  }

  return [...items].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue > rightValue) {
      return direction > 0 ? 1 : -1;
    }

    return direction > 0 ? -1 : 1;
  });
};

const matchesValue = (actual, expected) => {
  if (expected instanceof RegExp) {
    return expected.test(String(actual || ''));
  }

  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$in' in expected) {
      return expected.$in.includes(actual);
    }

    if ('$ne' in expected) {
      return actual !== expected.$ne;
    }
  }

  if (Array.isArray(actual)) {
    return actual.includes(expected);
  }

  return actual === expected;
};

const matchesFilter = (entity, filter = {}) => {
  if (!filter || !Object.keys(filter).length) {
    return true;
  }

  if (Array.isArray(filter.$and)) {
    return filter.$and.every((clause) => matchesFilter(entity, clause));
  }

  const restEntries = Object.entries(filter).filter(([key]) => key !== '$or' && key !== '$and');
  const restMatches = restEntries.every(([key, expected]) => matchesValue(entity[key], expected));

  if (!restMatches) {
    return false;
  }

  if (Array.isArray(filter.$or)) {
    return filter.$or.some((clause) => matchesFilter(entity, clause));
  }

  return true;
};

const createQueryChain = (items) => {
  let currentItems = [...items];

  const chain = {
    sort: jest.fn().mockImplementation((sortSpec) => {
      currentItems = sortItems(currentItems, sortSpec);
      return chain;
    }),
    skip: jest.fn().mockImplementation((count) => {
      currentItems = currentItems.slice(count);
      return chain;
    }),
    limit: jest.fn().mockImplementation((count) => {
      currentItems = currentItems.slice(0, count);
      return chain;
    }),
    lean: jest.fn().mockImplementation(() => Promise.resolve(currentItems)),
    then: (resolve, reject) => Promise.resolve(currentItems).then(resolve, reject),
    catch: (reject) => Promise.resolve(currentItems).catch(reject),
  };

  return chain;
};

describe('admin routes RBAC, moderation, and audit flows', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use(errorHandler);

  let users;
  let adminProfiles;
  let auditLogs;
  let reports;
  let settings;

  const asDocument = (collectionName, entity) => {
    const collectionMap = {
      users: () => users,
      adminProfiles: () => adminProfiles,
      auditLogs: () => auditLogs,
      reports: () => reports,
      settings: () => settings,
    };
    const setCollectionMap = {
      users: (next) => {
        users = next;
      },
      adminProfiles: (next) => {
        adminProfiles = next;
      },
      auditLogs: (next) => {
        auditLogs = next;
      },
      reports: (next) => {
        reports = next;
      },
      settings: (next) => {
        settings = next;
      },
    };
    const getKey = {
      users: 'userId',
      adminProfiles: 'userId',
      auditLogs: 'auditId',
      reports: 'reportId',
      settings: 'settingId',
    };

    return {
      ...entity,
      save: jest.fn().mockImplementation(async function save() {
        const collection = collectionMap[collectionName]();
        const key = getKey[collectionName];
        const index = collection.findIndex((item) => item[key] === this[key]);
        const plain = this.toObject();

        if (index === -1) {
          setCollectionMap[collectionName]([...collection, plain]);
          return;
        }

        const nextCollection = [...collection];
        nextCollection[index] = plain;
        setCollectionMap[collectionName](nextCollection);
      }),
      deleteOne: jest.fn().mockImplementation(async function deleteOne() {
        const collection = collectionMap[collectionName]();
        const key = getKey[collectionName];
        setCollectionMap[collectionName](collection.filter((item) => item[key] !== this[key]));
      }),
      toObject: jest.fn().mockImplementation(function toObject() {
        const { save, deleteOne, toObject, ...plain } = this;
        return { ...plain };
      }),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    users = [
      {
        userId: 'USR-ADMIN',
        email: 'admin@test.com',
        passwordHash: 'secret',
        firstName: 'Admin',
        lastName: 'Owner',
        role: 'admin',
        accountStatus: 'ACTIVE',
        createdAt: new Date('2026-05-01T09:00:00.000Z'),
      },
      {
        userId: 'USR-ADMIN-2',
        email: 'admin2@test.com',
        passwordHash: 'secret',
        firstName: 'Second',
        lastName: 'Admin',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        createdAt: new Date('2026-05-02T09:00:00.000Z'),
      },
      {
        userId: 'USR-ADMIN-LIMITED',
        email: 'limited-admin@test.com',
        passwordHash: 'secret',
        firstName: 'Limited',
        lastName: 'Admin',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        createdAt: new Date('2026-05-03T09:00:00.000Z'),
      },
      {
        userId: 'USR-USER-1',
        email: 'user1@test.com',
        passwordHash: 'secret',
        firstName: 'Regular',
        lastName: 'User',
        role: 'user',
        accountStatus: 'ACTIVE',
        createdAt: new Date('2026-05-04T09:00:00.000Z'),
      },
      {
        userId: 'USR-USER-2',
        email: 'user2@test.com',
        passwordHash: 'secret',
        firstName: 'Another',
        lastName: 'User',
        role: 'LEARNER',
        accountStatus: 'ACTIVE',
        createdAt: new Date('2026-05-05T09:00:00.000Z'),
      },
    ];

    adminProfiles = [
      {
        userId: 'USR-ADMIN',
        permissions: [
          'manage_users',
          'manage_admins',
          'moderate_users',
          'review_reports',
          'manage_settings',
          'view_dashboard',
          'view_audit_logs',
        ],
        assignedDate: new Date('2026-04-01T09:00:00.000Z'),
        lastActiveDate: new Date('2026-05-01T09:00:00.000Z'),
      },
      {
        userId: 'USR-ADMIN-2',
        permissions: [
          'manage_users',
          'manage_admins',
          'moderate_users',
          'review_reports',
          'manage_settings',
          'view_dashboard',
          'view_audit_logs',
        ],
        assignedDate: new Date('2026-04-05T09:00:00.000Z'),
        lastActiveDate: new Date('2026-05-01T10:00:00.000Z'),
      },
      {
        userId: 'USR-ADMIN-LIMITED',
        permissions: ['manage_users'],
        assignedDate: new Date('2026-04-10T09:00:00.000Z'),
        lastActiveDate: new Date('2026-05-01T11:00:00.000Z'),
      },
    ];

    auditLogs = [
      {
        auditId: 'AUD-1',
        adminUserId: 'USR-ADMIN',
        userId: 'USR-USER-1',
        actionType: 'ADMIN_USER_UPDATED',
        targetEntityId: 'USR-USER-1',
        targetEntityType: 'User',
        details: {},
        reason: '',
        timestamp: new Date('2026-05-01T12:00:00.000Z'),
        ipAddress: '',
      },
    ];

    reports = [
      {
        reportId: 'RPT-1',
        reporterId: 'USR-USER-1',
        reportedUserId: 'USR-USER-2',
        violationType: 'SPAM',
        description: 'Spam behavior',
        evidence: [],
        reportStatus: 'PENDING',
        assignedTo: '',
        resolution: '',
        createdAt: new Date('2026-05-02T12:00:00.000Z'),
      },
    ];

    settings = [
      {
        settingId: 'SETTING-001',
        settingKey: 'initial_credit_allocation',
        settingValue: '14',
        description: 'Default credits assigned to new active users.',
        updatedBy: 'USR-ADMIN',
        updatedAt: new Date('2026-05-01T13:00:00.000Z'),
      },
    ];

    User.find.mockImplementation((filter = {}) => {
      return createQueryChain(users.filter((user) => matchesFilter(user, filter)).map((user) => {
        return asDocument('users', user);
      }));
    });

    User.countDocuments.mockImplementation(async (filter = {}) => {
      return users.filter((user) => matchesFilter(user, filter)).length;
    });

    User.findOne.mockImplementation(async (filter = {}) => {
      const user = users.find((candidate) => matchesFilter(candidate, filter));
      return user ? asDocument('users', user) : null;
    });

    Admin.find.mockImplementation(async (filter = {}) => {
      return adminProfiles
        .filter((profile) => matchesFilter(profile, filter))
        .map((profile) => asDocument('adminProfiles', profile));
    });

    Admin.findOne.mockImplementation(async (filter = {}) => {
      const adminProfile = adminProfiles.find((candidate) => matchesFilter(candidate, filter));
      return adminProfile ? asDocument('adminProfiles', adminProfile) : null;
    });

    Admin.create.mockImplementation(async (payload) => {
      adminProfiles.push({ ...payload });
      return asDocument('adminProfiles', payload);
    });

    AuditLog.find.mockImplementation((filter = {}) => {
      return createQueryChain(
        auditLogs.filter((auditLog) => matchesFilter(auditLog, filter)).map((auditLog) => {
          return asDocument('auditLogs', auditLog);
        })
      );
    });

    AuditLog.countDocuments.mockImplementation(async (filter = {}) => {
      return auditLogs.filter((auditLog) => matchesFilter(auditLog, filter)).length;
    });

    AuditLog.create.mockImplementation(async (payload) => {
      auditLogs.push({ ...payload });
      return asDocument('auditLogs', payload);
    });

    Report.find.mockImplementation((filter = {}) => {
      return createQueryChain(reports.filter((report) => matchesFilter(report, filter)).map((report) => {
        return asDocument('reports', report);
      }));
    });

    Report.countDocuments.mockImplementation(async (filter = {}) => {
      return reports.filter((report) => matchesFilter(report, filter)).length;
    });

    Report.findOne.mockImplementation(async (filter = {}) => {
      const report = reports.find((candidate) => matchesFilter(candidate, filter));
      return report ? asDocument('reports', report) : null;
    });

    SystemSettings.mockImplementation(function MockSystemSettings(doc) {
      return asDocument('settings', doc);
    });

    SystemSettings.find.mockImplementation((filter = {}) => {
      return createQueryChain(
        settings.filter((setting) => matchesFilter(setting, filter)).map((setting) => {
          return asDocument('settings', setting);
        })
      );
    });

    SystemSettings.countDocuments.mockImplementation(async (filter = {}) => {
      return settings.filter((setting) => matchesFilter(setting, filter)).length;
    });

    SystemSettings.findOne.mockImplementation(async (filter = {}) => {
      const setting = settings.find((candidate) => matchesFilter(candidate, filter));
      return setting ? asDocument('settings', setting) : null;
    });

    MentorApplication.countDocuments.mockResolvedValue(0);
    CreditBalance.aggregate.mockResolvedValue([]);
    CreditTransaction.countDocuments.mockResolvedValue(0);
    Session.countDocuments.mockResolvedValue(0);
    Report.distinct.mockResolvedValue(['USR-USER-2']);
  });

  it('blocks normal user from admin endpoints', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks admins that do not have the required fine-grained permission', async () => {
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer admin-limited-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows full admins to manage users, moderation, settings, reports, and audit flows', async () => {
    const listResponse = await request(app)
      .get('/api/admin/users?page=1&limit=10')
      .set('Authorization', 'Bearer admin-token');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(5);
    expect(listResponse.body.data.items[0].passwordHash).toBeUndefined();

    const getSingleResponse = await request(app)
      .get('/api/admin/users/USR-USER-1')
      .set('Authorization', 'Bearer admin-token');

    expect(getSingleResponse.status).toBe(200);
    expect(getSingleResponse.body.data.userId).toBe('USR-USER-1');

    const updateResponse = await request(app)
      .put('/api/admin/users/USR-USER-1')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Updated Name',
        email: 'updated-user@test.com',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.firstName).toBe('Updated');
    expect(updateResponse.body.data.lastName).toBe('Name');
    expect(updateResponse.body.data.email).toBe('updated-user@test.com');

    const roleResponse = await request(app)
      .patch('/api/admin/users/USR-USER-1/role')
      .set('Authorization', 'Bearer admin-token')
      .send({
        role: 'ADMIN',
      });

    expect(roleResponse.status).toBe(200);
    expect(roleResponse.body.data.role).toBe('ADMIN');
    expect(roleResponse.body.data.adminProfile.permissions).toContain('manage_users');

    const permissionsResponse = await request(app)
      .patch('/api/admin/users/USR-ADMIN-2/permissions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        permissions: ['manage_users', 'view_dashboard'],
      });

    expect(permissionsResponse.status).toBe(200);
    expect(permissionsResponse.body.data.permissions).toEqual([
      'manage_users',
      'view_dashboard',
    ]);

    const statusResponse = await request(app)
      .patch('/api/admin/users/USR-USER-2/status')
      .set('Authorization', 'Bearer admin-token')
      .send({
        accountStatus: 'SUSPENDED',
        reason: 'Repeated spam',
      });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.accountStatus).toBe('SUSPENDED');

    const dashboardResponse = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer admin-token');

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.users.total).toBe(5);
    expect(dashboardResponse.body.data.users.admins).toBe(4);
    expect(dashboardResponse.body.data.users.suspended).toBe(1);

    const auditLogsResponse = await request(app)
      .get('/api/admin/audit-logs?page=1&limit=20')
      .set('Authorization', 'Bearer admin-token');

    expect(auditLogsResponse.status).toBe(200);
    expect(auditLogsResponse.body.data.items.length).toBeGreaterThan(1);

    const reportsResponse = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', 'Bearer admin-token');

    expect(reportsResponse.status).toBe(200);
    expect(reportsResponse.body.data.items).toHaveLength(1);

    const updateReportResponse = await request(app)
      .patch('/api/admin/reports/RPT-1')
      .set('Authorization', 'Bearer admin-token')
      .send({
        reportStatus: 'UNDER_REVIEW',
        resolution: '',
      });

    expect(updateReportResponse.status).toBe(200);
    expect(updateReportResponse.body.data.reportStatus).toBe('UNDER_REVIEW');
    expect(updateReportResponse.body.data.assignedTo).toBe('USR-ADMIN');

    const settingsResponse = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', 'Bearer admin-token');

    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.data).toHaveLength(1);

    const updateSettingResponse = await request(app)
      .put('/api/admin/settings/initial_credit_allocation')
      .set('Authorization', 'Bearer admin-token')
      .send({
        value: 20,
        description: 'Updated by admin',
      });

    expect(updateSettingResponse.status).toBe(200);
    expect(updateSettingResponse.body.data.settingValue).toBe('20');
    expect(updateSettingResponse.body.data.description).toBe('Updated by admin');

    const deleteSelfResponse = await request(app)
      .delete('/api/admin/users/USR-ADMIN')
      .set('Authorization', 'Bearer admin-token');

    expect(deleteSelfResponse.status).toBe(400);
    expect(deleteSelfResponse.body.error.code).toBe('SELF_DELETE_FORBIDDEN');

    const deleteOtherResponse = await request(app)
      .delete('/api/admin/users/USR-USER-2')
      .set('Authorization', 'Bearer admin-token');

    expect(deleteOtherResponse.status).toBe(200);
    expect(deleteOtherResponse.body.data.userId).toBe('USR-USER-2');
  });

  it('protects self-demotion, self-deactivation, and the last active admin', async () => {
    const selfRoleResponse = await request(app)
      .patch('/api/admin/users/USR-ADMIN/role')
      .set('Authorization', 'Bearer admin-token')
      .send({
        role: 'user',
      });

    expect(selfRoleResponse.status).toBe(400);
    expect(selfRoleResponse.body.error.code).toBe('SELF_ROLE_CHANGE_FORBIDDEN');

    const selfStatusResponse = await request(app)
      .patch('/api/admin/users/USR-ADMIN/status')
      .set('Authorization', 'Bearer admin-token')
      .send({
        accountStatus: 'SUSPENDED',
      });

    expect(selfStatusResponse.status).toBe(400);
    expect(selfStatusResponse.body.error.code).toBe('SELF_STATUS_CHANGE_FORBIDDEN');

    users = users.map((user) => {
      if (user.userId === 'USR-ADMIN') {
        return { ...user, accountStatus: 'SUSPENDED' };
      }

      if (user.userId === 'USR-ADMIN-LIMITED') {
        return { ...user, accountStatus: 'SUSPENDED' };
      }

      return user;
    });

    const lastAdminResponse = await request(app)
      .patch('/api/admin/users/USR-ADMIN-2/status')
      .set('Authorization', 'Bearer admin-token')
      .send({
        accountStatus: 'BANNED',
      });

    expect(lastAdminResponse.status).toBe(400);
    expect(lastAdminResponse.body.error.code).toBe('LAST_ADMIN_PROTECTED');
  });
});
