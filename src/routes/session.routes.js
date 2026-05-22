const express = require('express');

const sessionController = require('../controllers/session.controller');
const protect = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  createPublicSessionSchema,
  createSessionRequestSchema,
  completeSessionSchema,
} = require('../validators/session.validator');

const router = express.Router();

router.use(protect);

router.get('/teachers', sessionController.getTeacherDirectory);
router.get('/can-host', sessionController.getCanHost);
router.get('/', sessionController.listSessions);
router.get('/explore', sessionController.listSessionsDirectory);
router.post('/open', validate(createPublicSessionSchema), sessionController.createPublicSession);
router.post('/request', validate(createSessionRequestSchema), sessionController.requestSession);
router.patch('/:id/accept', sessionController.acceptSession);
router.patch('/:id/reject', sessionController.rejectSession);
router.patch('/:id/cancel', sessionController.cancelSession);
router.post('/:id/join', sessionController.joinPublicSession);
router.delete('/:id', sessionController.deleteSession);
router.patch('/:id/complete', validate(completeSessionSchema), sessionController.completeSession);
router.patch('/:id/confirm', sessionController.confirmCompletion);

module.exports = router;
