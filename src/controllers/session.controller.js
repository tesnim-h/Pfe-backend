const sessionService = require('../services/session.service');
const ApiResponse = require('../utils/ApiResponse');
const { emitSessionUpdate } = require('../sockets/gateway');

// POST /sessions/open
const createPublicSession = async (req, res, next) => {
  try {
    const session = await sessionService.createPublicSession(req.user, req.body);
    emitSessionUpdate(session);
    res.status(201).json(new ApiResponse(201, session, 'Session created successfully'));
  } catch (error) {
    next(error);
  }
};

// POST /sessions/request
const requestSession = async (req, res, next) => {
  try {
    const session = await sessionService.requestSession(req.user, req.body);
    emitSessionUpdate(session);
    res.status(201).json(new ApiResponse(201, session, 'Session requested successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /sessions
const listSessions = async (req, res, next) => {
  try {
    const sessions = await sessionService.listSessionsForUser(req.user, req.query);
    res.status(200).json(new ApiResponse(200, sessions, 'Sessions fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /sessions/explore
const listSessionsDirectory = async (req, res, next) => {
  try {
    const sessions = await sessionService.listSessionsDirectory(req.user, req.query);
    res.status(200).json(new ApiResponse(200, sessions, 'Sessions directory fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /sessions/:id/accept
const acceptSession = async (req, res, next) => {
  try {
    const session = await sessionService.acceptSession(req.user, req.params.id);
    emitSessionUpdate(session);
    res.status(200).json(new ApiResponse(200, session, 'Session accepted successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /sessions/:id/reject
const rejectSession = async (req, res, next) => {
  try {
    const session = await sessionService.rejectSession(req.user, req.params.id);
    emitSessionUpdate(session);
    res.status(200).json(new ApiResponse(200, session, 'Session rejected successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /sessions/:id/cancel
const cancelSession = async (req, res, next) => {
  try {
    const session = await sessionService.cancelSession(req.user, req.params.id);
    emitSessionUpdate(session);
    res.status(200).json(new ApiResponse(200, session, 'Session request cancelled successfully'));
  } catch (error) {
    next(error);
  }
};

// DELETE /sessions/:id
const deleteSession = async (req, res, next) => {
  try {
    const session = await sessionService.deleteSession(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, session, 'Session deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /sessions/:id/complete — teacher marks session done; awaits learner confirmation.
const completeSession = async (req, res, next) => {
  try {
    const session = await sessionService.completeSession(req.user, req.params.id, req.body);
    emitSessionUpdate(session);
    res.status(200).json(new ApiResponse(200, session, 'Session marked complete — awaiting learner confirmation'));
  } catch (error) {
    next(error);
  }
};

// PATCH /sessions/:id/confirm — learner confirms; triggers atomic credit transfer + XP.
const confirmCompletion = async (req, res, next) => {
  try {
    const session = await sessionService.confirmCompletion(req.user, req.params.id);
    emitSessionUpdate(session);
    res.status(200).json(new ApiResponse(200, session, 'Session confirmed — credits transferred successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /sessions/teachers
const getTeacherDirectory = async (req, res, next) => {
  try {
    const teachers = await sessionService.getTeacherDirectory(req.user);
    res.status(200).json(new ApiResponse(200, teachers, 'Teacher directory fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// POST /sessions/:id/join
const joinPublicSession = async (req, res, next) => {
  try {
    const session = await sessionService.joinPublicSession(req.user, req.params.id);
    res.status(201).json(new ApiResponse(201, session, 'Join request sent successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /sessions/can-host
const getCanHost = async (req, res, next) => {
  try {
    const result = await sessionService.canHostSession(req.user);
    res.status(200).json(new ApiResponse(200, result, 'Can host status fetched'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPublicSession,
  joinPublicSession,
  requestSession,
  listSessions,
  listSessionsDirectory,
  acceptSession,
  rejectSession,
  cancelSession,
  deleteSession,
  completeSession,
  confirmCompletion,
  getTeacherDirectory,
  getCanHost,
};
