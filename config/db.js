// ============================================================
// Database connection pool (mysql2)
// ============================================================
const mysql = require('mysql2/promise');
const winston = require('winston');
require('dotenv').config();

// Create logger for database operations
const dbLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'hoopconnect-db' },
    transports: [
        new winston.transports.File({ filename: 'logs/db.log', options: { flags: 'w' } }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', options: { flags: 'w' } }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    dbLogger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hoopconnect',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Log pool creation
dbLogger.info('Database connection pool created', {
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'hoopconnect',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    connectionLimit: 10
});

// Log connection events
pool.on('connection', (connection) => {
    dbLogger.info('New database connection established', {
        threadId: connection.threadId,
        state: connection.state
    });
});

pool.on('error', (err) => {
    dbLogger.error('Database pool error', { 
        error: err.message, 
        code: err.code,
        stack: err.stack,
        fatal: err.fatal
    });
});

// Test database connection on startup
pool.query('SELECT 1')
    .then(() => {
        dbLogger.info('Database connection test successful');
    })
    .catch((err) => {
        dbLogger.error('Database connection test failed', {
            error: err.message,
            code: err.code,
            stack: err.stack
        });
    });

// Simple query caching wrapper
const queryCache = new Map();
const QUERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

pool.cachedQuery = async (sql, params = [], cacheKey = null, ttl = QUERY_CACHE_TTL) => {
    // Only cache SELECT queries
    if (!sql.trim().toUpperCase().startsWith('SELECT') || !cacheKey) {
        return pool.query(sql, params);
    }

    const fullKey = `query:${cacheKey}`;
    const cached = queryCache.get(fullKey);

    if (cached && Date.now() < cached.expiresAt) {
        dbLogger.debug('Database query cache hit', { cacheKey, sql: sql.substring(0, 100) });
        return cached.result;
    }

    dbLogger.debug('Database query cache miss', { cacheKey, sql: sql.substring(0, 100) });
    const result = await pool.query(sql, params);

    queryCache.set(fullKey, {
        result,
        expiresAt: Date.now() + ttl
    });

    return result;
};

// Clear query cache (useful after data modifications)
pool.clearQueryCache = () => {
    queryCache.clear();
    dbLogger.info('Database query cache cleared');
};

// Periodic cleanup of expired cache entries
setInterval(() => {
    const now = Date.now();
    for (const [key, item] of queryCache.entries()) {
        if (now > item.expiresAt) {
            queryCache.delete(key);
        }
    }
}, 10 * 60 * 1000); // Clean up every 10 minutes

module.exports = pool;
