// ============================================================
// Error Handling Utilities
// ============================================================
const winston = require('winston');

// Create error logger
const errorLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'hoopconnect-errors' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', options: { flags: 'w' } }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    errorLogger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// Error response utility
function sendError(res, statusCode, message, details = null) {
    const error = {
        error: message,
        timestamp: new Date().toISOString()
    };

    if (details && process.env.NODE_ENV === 'development') {
        error.details = details;
    }

    // Log server errors
    if (statusCode >= 500) {
        errorLogger.error('Server Error', {
            statusCode,
            message,
            details,
            url: res.req?.url,
            method: res.req?.method,
            ip: res.req?.ip,
            userId: res.req?.session?.user?.user_id
        });
    }

    res.status(statusCode).json(error);
}

// Async route wrapper to catch errors
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            errorLogger.error('Unhandled async error', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userId: req.session?.user?.user_id
            });
            sendError(res, 500, 'An unexpected error occurred. Please try again later.');
        });
    };
}

// Validation error helper
function validationError(res, field, message) {
    sendError(res, 400, `Validation error: ${message}`, { field });
}

// Database error handler
function handleDatabaseError(res, err) {
    errorLogger.error('Database error', {
        error: err.message,
        code: err.code,
        sqlState: err.sqlState,
        url: res.req?.url,
        method: res.req?.method
    });

    // Handle specific database errors
    if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 409, 'A record with this information already exists.');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW') {
        return sendError(res, 400, 'Referenced record does not exist.');
    }
    if (err.code === 'ER_DATA_TOO_LONG') {
        return sendError(res, 400, 'Input data is too long.');
    }

    sendError(res, 500, 'Database error occurred. Please try again later.');
}

module.exports = {
    sendError,
    asyncHandler,
    validationError,
    handleDatabaseError,
    errorLogger
};