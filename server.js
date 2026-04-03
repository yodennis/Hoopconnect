// ============================================================
// HoopConnect — Main Express Server
// ============================================================
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const winston = require('winston');
const path    = require('path');
const http    = require('http');
const https   = require('https');
const fs      = require('fs');

const app    = express();
const PORT   = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// ---- Logging ----
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'hoopconnect' },
    transports: [
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            options: { flags: 'w' },
            tailable: true
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            options: { flags: 'w' },
            tailable: true
        }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// ---- SSL Configuration ----
let sslOptions = {};
if (USE_HTTPS) {
    logger.info('HTTPS enabled, configuring SSL certificates', { useHttps: USE_HTTPS, nodeEnv: process.env.NODE_ENV });
    try {
        // In production, use proper SSL certificates
        if (process.env.NODE_ENV === 'production') {
            sslOptions = {
                key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/ssl/private/hoopconnect.key'),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/ssl/certs/hoopconnect.crt'),
                ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined
            };
        } else {
            // In development, create self-signed certificate
            const selfsigned = require('selfsigned');
            const attrs = [{ name: 'commonName', value: 'localhost' }];
            const pems = selfsigned.generate(attrs, { days: 365 });
            sslOptions = {
                key: pems.private,
                cert: pems.cert
            };
            logger.warn('Using self-signed certificate for development. This will show security warnings in browsers.');
        }
    } catch (error) {
        logger.error('Failed to load SSL certificates', { error: error.message });
        logger.warn('HTTPS disabled due to SSL certificate error');
        process.env.USE_HTTPS = 'false';
    }
} else {
    logger.info('HTTPS disabled, using HTTP only', { useHttps: USE_HTTPS });
}

// ---- Create Servers ----
const server = USE_HTTPS ? https.createServer(sslOptions, app) : http.createServer(app);

// ---- Socket.IO ----
let io;
try {
    const { Server } = require('socket.io');
    io = new Server(server);

    io.on('connection', (socket) => {
        const session = socket.request.session;
        const userId = session?.user?.user_id;

        if (!userId) {
            socket.disconnect();
            return;
        }

        socket.on('join', (requestedUserId) => {
            // Only allow joining your own room
            if (requestedUserId && requestedUserId === userId) {
                socket.join(`user_${userId}`);
            }
        });

        socket.on('send_message', (data) => {
            // Validate that sender is the authenticated user
            if (data.sender_id === userId && data.receiver_id) {
                io.to(`user_${data.receiver_id}`).emit('new_message', data);
            }
        });

        socket.on('typing', (data) => {
            if (data.sender_id === userId && data.receiver_id) {
                io.to(`user_${data.receiver_id}`).emit('user_typing', { sender_id: userId });
            }
        });

        socket.on('stop_typing', (data) => {
            if (data.sender_id === userId && data.receiver_id) {
                io.to(`user_${data.receiver_id}`).emit('user_stop_typing', { sender_id: userId });
            }
        });
    });
    app.set('io', io);
} catch (e) {
    logger.error('Socket.IO initialization failed:', e);
    console.log('Socket.IO not installed, real-time messaging disabled. Run: npm install socket.io');
}

// ---- Rate Limiting ----
const { rateLimit } = require('./middleware/rateLimit');

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Check for required environment variables
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET environment variable is required in production');
    process.exit(1);
}
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('SESSION_SECRET environment variable is required in production'); })() : 'dev-secret'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: USE_HTTPS || process.env.NODE_ENV === 'production', // Secure when using HTTPS or in production
        maxAge: 1000 * 60 * 60 * 4   // 4 hours
    }
});
app.use(sessionMiddleware);

// Share session with Socket.IO
if (io) {
    io.engine.use(sessionMiddleware);
}

// ---- CSRF Protection ----
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }

    // Generate token for GET requests
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }

    // Validate token for state-changing requests
    const token = req.body._csrf || req.headers['x-csrf-token'] || req.headers['csrf-token'];
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: 'CSRF token validation failed' });
    }

    next();
}

// Make CSRF token available to all responses
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Make session user available to all responses
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ---- Request Logging ----
app.use((req, res, next) => {
    const start = Date.now();
    const userId = req.session?.user?.user_id;

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            userId,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });

    next();
});

// Apply rate limiting to auth endpoints
const authLimiter = rateLimit({ windowMs: 60000, max: 10, message: 'Too many attempts, try again in a minute.' });
const apiLimiter = rateLimit({ windowMs: 60000, max: 100 });
const msgLimiter = rateLimit({ windowMs: 60000, max: 30, message: 'Slow down! Too many messages.' });

// ---- API Routes ----
app.use('/api/auth',      authLimiter, require('./routes/auth'));
app.use('/api/users',     apiLimiter, csrfProtection, require('./routes/users'));
app.use('/api/sports',    require('./routes/sports'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/teams',     apiLimiter, csrfProtection, require('./routes/teams'));
app.use('/api/games',     apiLimiter, csrfProtection, require('./routes/games'));
app.use('/api/requests',  apiLimiter, csrfProtection, require('./routes/requests'));
app.use('/api/reports',   csrfProtection, require('./routes/reports'));
app.use('/api/reviews',   apiLimiter, csrfProtection, require('./routes/reviews'));
app.use('/api/nearby',    require('./routes/nearby'));
app.use('/api/pro',       require('./routes/pro'));
app.use('/api/support',   require('./routes/support'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/notifications', csrfProtection, require('./routes/notifications'));
app.use('/api/courts',        csrfProtection, require('./routes/courts'));
app.use('/api/messages',      msgLimiter, csrfProtection, require('./routes/messages'));
app.use('/api/follows',       apiLimiter, require('./routes/follows'));
app.use('/api/court-reviews', require('./routes/court-reviews'));
app.use('/api/blocks',        apiLimiter, require('./routes/blocks'));
app.use('/api/checkins',      require('./routes/checkins'));
app.use('/api/achievements',  require('./routes/achievements'));
app.use('/api/scoring',       require('./routes/scoring'));
app.use('/api/tournaments',   require('./routes/tournaments'));
app.use('/api/activity',      require('./routes/activity'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/waitlist',      require('./routes/waitlist'));
app.use('/api/game-comments', require('./routes/game-comments'));
app.use('/api/challenges',    require('./routes/challenges'));
app.use('/api/invites',       require('./routes/invites'));
app.use('/api/compare',       require('./routes/compare'));
app.use('/api/weather',       require('./routes/weather'));
app.use('/api/recommendations', require('./routes/recommendations'));

// ---- Page Routes (serve HTML) ----
app.use('/', require('./routes/pages'));

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
    logger.error('Unhandled application error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.session?.user?.user_id
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorResponse = {
        error: 'An unexpected error occurred. Please try again later.',
        timestamp: new Date().toISOString()
    };

    if (isDevelopment) {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack;
    }

    res.status(500).json(errorResponse);
});

// ---- 404 Handler ----
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found.',
        timestamp: new Date().toISOString()
    });
});

// ---- Error Handling ----
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});

// ---- Start Server ----
if (USE_HTTPS) {
    // Start HTTPS server
    server.listen(HTTPS_PORT, () => {
        logger.info(`HoopConnect HTTPS server started on port ${HTTPS_PORT}`, {
            port: HTTPS_PORT,
            environment: process.env.NODE_ENV || 'development',
            protocol: 'https'
        });
        console.log(`HoopConnect HTTPS server running at https://localhost:${HTTPS_PORT}`);
    });

    // Optional: Also start HTTP server for redirects to HTTPS
    if (process.env.REDIRECT_HTTP_TO_HTTPS === 'true') {
        const httpApp = express();
        httpApp.use((req, res) => {
            res.redirect(`https://${req.headers.host}${req.url}`);
        });
        const httpServer = http.createServer(httpApp);
        httpServer.listen(PORT, () => {
            logger.info(`HTTP redirect server started on port ${PORT} (redirecting to HTTPS)`, {
                port: PORT,
                protocol: 'http-redirect'
            });
        });
    }
} else {
    // Start HTTP server only
    server.listen(PORT, () => {
        logger.info(`HoopConnect HTTP server started on port ${PORT}`, {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            protocol: 'http'
        });
        console.log(`HoopConnect HTTP server running at http://localhost:${PORT}`);
    });
}
