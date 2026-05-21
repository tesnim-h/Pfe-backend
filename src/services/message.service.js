const { randomUUID } = require('crypto');

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeUser } = require('./user.service');

const buildConversationParticipants = (userIdA, userIdB) => {
  return [userIdA, userIdB].sort();
};

const buildConversationFilter = (userIdA, userIdB) => {
  const [participant1Id, participant2Id] = buildConversationParticipants(userIdA, userIdB);

  return {
    participant1Id,
    participant2Id,
  };
};

const getActiveUserByUserId = async (userId) => {
  if (!userId || !userId.trim()) {
    throw new ApiError(400, 'User id is required', 'VALIDATION_ERROR');
  }

  const user = await User.findOne({ userId });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new ApiError(403, 'User account is not active', 'USER_NOT_ACTIVE');
  }

  return user;
};

const buildParticipantMap = (users) => {
  return new Map(
    users.map((user) => {
      return [
        user.userId,
        {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
          role: user.role,
          accountStatus: user.accountStatus,
        },
      ];
    })
  );
};

const serializeMessage = (message) => {
  return {
    messageId: message.messageId,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    isRead: message.isRead,
    createdAt: message.createdAt,
  };
};

const buildDisplayName = (user) => {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.userId || 'Someone';
};

const buildMessagePreview = (content = '', maxLength = 120) => {
  const normalizedContent = String(content || '').trim().replace(/\s+/g, ' ');

  if (normalizedContent.length <= maxLength) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, maxLength - 1)}…`;
};

const getOrCreateConversation = async (userIdA, userIdB, lastMessageAt = new Date()) => {
  const filter = buildConversationFilter(userIdA, userIdB);

  try {
    return await Conversation.findOneAndUpdate(
      filter,
      {
        $set: {
          isActive: true,
          lastMessageAt,
        },
        $setOnInsert: {
          conversationId: `CONV-${randomUUID()}`,
          createdAt: lastMessageAt,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Conversation.findOne(filter);
    }

    throw error;
  }
};

const sendMessage = async (currentUser, { recipientUserId, content }) => {
  const senderId = currentUser?.userId;

  if (!senderId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  if (senderId === recipientUserId) {
    throw new ApiError(400, 'You cannot send a message to yourself', 'INVALID_RECIPIENT');
  }

  const recipientUser = await getActiveUserByUserId(recipientUserId);

  const now = new Date();
  const normalizedContent = content.trim();
  const conversation = await getOrCreateConversation(senderId, recipientUserId, now);
  const message = await Message.create({
    messageId: `MSG-${randomUUID()}`,
    conversationId: conversation.conversationId,
    senderId,
    content: normalizedContent,
    isRead: false,
    createdAt: now,
  });

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: recipientUser.userId,
    notificationType: 'MESSAGE',
    title: `New message from ${buildDisplayName(currentUser)}`,
    description: buildMessagePreview(normalizedContent),
    relatedEntityId: message.messageId,
    isRead: false,
    createdAt: now,
  });

  return {
    conversationId: conversation.conversationId,
    message: serializeMessage(message),
  };
};

const listConversations = async (currentUser) => {
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const conversations = await Conversation.find({
    isActive: true,
    $or: [{ participant1Id: currentUserId }, { participant2Id: currentUserId }],
  })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .lean();

  if (!conversations.length) {
    return [];
  }

  const otherParticipantIds = [...new Set(
    conversations.map((conversation) => {
      return conversation.participant1Id === currentUserId
        ? conversation.participant2Id
        : conversation.participant1Id;
    })
  )];

  const [participants, lastMessages, unreadCounts] = await Promise.all([
    User.find({ userId: { $in: otherParticipantIds } }).select('-profilePicture').lean(),
    Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((conversation) => conversation.conversationId) },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: '$conversationId',
          message: { $first: '$$ROOT' },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((conversation) => conversation.conversationId) },
          isRead: false,
          senderId: { $ne: currentUserId },
        },
      },
      {
        $group: {
          _id: '$conversationId',
          unreadCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const participantMap = buildParticipantMap(participants.map((user) => sanitizeUser(user)));
  const lastMessageMap = new Map();
  const unreadCountMap = new Map(
    unreadCounts.map((item) => [item._id, item.unreadCount])
  );

  for (const message of lastMessages) {
    lastMessageMap.set(message._id, serializeMessage(message.message));
  }

  return conversations.map((conversation) => {
    const otherParticipantId =
      conversation.participant1Id === currentUserId
        ? conversation.participant2Id
        : conversation.participant1Id;

    return {
      conversationId: conversation.conversationId,
      otherParticipant: participantMap.get(otherParticipantId) || { userId: otherParticipantId },
      lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
      unreadCount: unreadCountMap.get(conversation.conversationId) || 0,
      lastMessage: lastMessageMap.get(conversation.conversationId) || null,
    };
  });
};

const getConversationWithUser = async (currentUser, otherUserId) => {
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const sanitizedOtherUserId = otherUserId?.trim();

  if (currentUserId === sanitizedOtherUserId) {
    throw new ApiError(400, 'You cannot open a conversation with yourself', 'INVALID_PARTICIPANT');
  }

  const otherUser = await getActiveUserByUserId(sanitizedOtherUserId);
  const conversation = await Conversation.findOne(
    buildConversationFilter(currentUserId, sanitizedOtherUserId)
  ).lean();

  if (!conversation) {
    return {
      conversationId: null,
      participant: {
        userId: otherUser.userId,
        firstName: otherUser.firstName,
        lastName: otherUser.lastName,
        profilePicture: otherUser.profilePicture,
        role: otherUser.role,
        accountStatus: otherUser.accountStatus,
      },
      messages: [],
    };
  }

  const messages = await Message.find({ conversationId: conversation.conversationId })
    .sort({ createdAt: 1 })
    .lean();

  return {
    conversationId: conversation.conversationId,
    participant: {
      userId: otherUser.userId,
      firstName: otherUser.firstName,
      lastName: otherUser.lastName,
      profilePicture: otherUser.profilePicture,
      role: otherUser.role,
      accountStatus: otherUser.accountStatus,
    },
    messages: messages.map(serializeMessage),
  };
};

const markMessageAsRead = async (currentUser, messageId) => {
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const sanitizedMessageId = messageId?.trim();
  const message = await Message.findOne({ messageId: sanitizedMessageId });

  if (!message) {
    throw new ApiError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
  }

  const conversation = await Conversation.findOne({ conversationId: message.conversationId });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  const isParticipant =
    conversation.participant1Id === currentUserId || conversation.participant2Id === currentUserId;

  if (!isParticipant) {
    throw new ApiError(403, 'You are not allowed to access this message', 'FORBIDDEN');
  }

  if (message.senderId !== currentUserId && !message.isRead) {
    message.isRead = true;
    await Promise.all([
      message.save(),
      Notification.updateMany(
        {
          userId: currentUserId,
          notificationType: 'MESSAGE',
          relatedEntityId: message.messageId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
          },
        }
      ),
    ]);
  }

  return serializeMessage(message);
};

const getConversationParticipantUserIds = async (conversationId) => {
  const sanitizedConversationId = conversationId?.trim();

  if (!sanitizedConversationId) {
    throw new ApiError(400, 'Conversation id is required', 'VALIDATION_ERROR');
  }

  const conversation = await Conversation.findOne({ conversationId: sanitizedConversationId });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  return [conversation.participant1Id, conversation.participant2Id];
};

module.exports = {
  sendMessage,
  listConversations,
  getConversationWithUser,
  markMessageAsRead,
  getConversationParticipantUserIds,
};
