jest.mock('../../../src/models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../src/models/SystemSettings', () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/models/CreditBalance', () => ({
  create: jest.fn(),
}));

jest.mock('../../../src/models/SystemSettings', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../src/utils/hash', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

jest.mock('../../../src/utils/jwt', () => ({
  signAccessToken: jest.fn(),
}));

jest.mock('../../../src/utils/token', () => ({
  generateOtp: jest.fn(),
  hashOtp: jest.fn(),
}));

jest.mock('../../../src/utils/email', () => jest.fn());

const User = require('../../../src/models/User');
const CreditBalance = require('../../../src/models/CreditBalance');
const SystemSettings = require('../../../src/models/SystemSettings');
const { hashPassword } = require('../../../src/utils/hash');
const { signAccessToken } = require('../../../src/utils/jwt');
const { generateOtp } = require('../../../src/utils/token');
const sendEmail = require('../../../src/utils/email');
const authService = require('../../../src/services/auth.service');

describe('auth.service', () => {
  const originalClientUrl = process.env.CLIENT_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'http://localhost:3000';
    SystemSettings.findOne.mockResolvedValue(null);
    CreditBalance.create.mockImplementation(async (payload) => payload);
  });

  afterAll(() => {
    process.env.CLIENT_URL = originalClientUrl;
  });

  describe('register', () => {
    it('initializes new users with 10 time credits', async () => {
      User.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue('hashed-password');
      signAccessToken.mockReturnValue('signed-access-token');

      User.create.mockImplementation(async (payload) => {
        return {
          ...payload,
          toObject() {
            return { ...this };
          },
        };
      });

      const result = await authService.register({
        email: 'new.user@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.user@example.com',
          firstName: 'New',
          lastName: 'User',
          timeCredits: expect.anything(),
        })
      );

      const createdUserPayload = User.create.mock.calls[0][0];
      expect(createdUserPayload.timeCredits.toString()).toBe('10');
      expect(CreditBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: createdUserPayload.userId,
          currentBalance: 10,
          totalEarned: 10,
          totalSpent: 0,
        })
      );
      expect(result.user.timeCredits.toString()).toBe('10');
      expect(result.accessToken).toBe('signed-access-token');
    });
  });

  describe('forgotPassword', () => {
    it('returns the generic success message when the email does not exist', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await authService.forgotPassword('missing@example.com');

      expect(result).toEqual({
        message: 'If that email exists, a verification code has been sent.',
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns a debug code when SMTP is not configured in development', async () => {
      const userDoc = {
        email: 'member@example.com',
        save: jest.fn().mockResolvedValue(undefined),
      };

      User.findOne.mockResolvedValue(userDoc);
      generateOtp.mockReturnValue({
        code: '123456',
        hashedCode: 'hashed-otp-code',
        expires: new Date('2030-01-01T00:00:00.000Z'),
      });
      sendEmail.mockResolvedValue({ delivery: 'console' });

      const result = await authService.forgotPassword('member@example.com');

      expect(userDoc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@example.com',
          subject: 'Your Password Reset Code',
          text: expect.stringContaining('123456'),
        })
      );
      expect(result).toEqual({
        message: 'SMTP is not configured in development. The verification code was printed in the backend console.',
        debugCode: '123456',
      });
    });
  });
});
