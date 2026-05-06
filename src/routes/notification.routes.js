const express = require('express');

const notificationController = require('../controllers/notification.controller');
const protect = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllNotificationsAsRead);
router.patch('/:id/read', notificationController.markNotificationAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
