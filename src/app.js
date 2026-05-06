const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/error.middleware');
const notFound = require('./middleware/notFound.middleware');
const sanitizeRequest = require('./middleware/sanitize.middleware');

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const isDevelopment = process.env.NODE_ENV === 'development';
const corsAllowlist = new Set(
  [
    ...allowedOrigins,
    ...(isDevelopment ? developmentOrigins : []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsAllowlist.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeRequest);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// API routes
app.use('/api/v1', routes);
app.use('/api/admin', adminRoutes);

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
