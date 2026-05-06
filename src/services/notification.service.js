const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
};

const mapNotificationType = (notificationType) => {
  switch (notificationType) {
    case 'SESSION_REQUEST':
      return 'session';
    case 'VALIDATION_REQUEST':
      return 'request';
    case 'MESSAGE':
      return 'message';
    case 'SYSTEM':
      return 'credits';
    case 'ADMIN_ACTION':
      return 'validated';
    default:
      return 'session';
  }
};

const serializeNotification = (notification) => {
  return {
    id: notification.notificationId,
    type: mapNotificationType(notification.notificationType),
    title: notification.title,
    message: notification.description || '',
    read: Boolean(notification.isRead),
    createdAt: notification.createdAt,
    relatedEntityId: notification.relatedEntityId || '',
  };
};

const listNotifications = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);
  const notifications = await Notification.find({ userId: user.userId })
    .sort({ createdAt: -1 })
    .lean();

  return notifications.map(serializeNotification);
};

const getOwnedNotification = async (currentUser, notificationId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalizedNotificationId = notificationId?.trim();

  if (!normalizedNotificationId) {
    throw new ApiError(400, 'Notification id is required', 'VALIDATION_ERROR');
  }

  const notification = await Notification.findOne({
    notificationId: normalizedNotificationId,
    userId: user.userId,
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }

  return notification;
};

const markNotificationAsRead = async (currentUser, notificationId) => {
  const notification = await getOwnedNotification(currentUser, notificationId);

  if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }

  return serializeNotification(notification);
};

const markAllNotificationsAsRead = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);

  await Notification.updateMany(
    {
      userId: user.userId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
      },
    }
  );

  return listNotifications(user);
};

const deleteNotification = async (currentUser, notificationId) => {
  const notification = await getOwnedNotification(currentUser, notificationId);
  await notification.deleteOne();

  return {
    id: notification.notificationId,
    deleted: true,
  };
};

module.exports = {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
