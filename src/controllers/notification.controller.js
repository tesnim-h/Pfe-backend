const notificationService = require('../services/notification.service');
const ApiResponse = require('../utils/ApiResponse');

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.listNotifications(req.user);
    res.status(200).json(new ApiResponse(200, notifications, 'Notifications fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationAsRead(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const notifications = await notificationService.markAllNotificationsAsRead(req.user);
    res.status(200).json(new ApiResponse(200, notifications, 'All notifications marked as read'));
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Notification deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
