// ============================================================
// In-Memory Cache Middleware
// ============================================================
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL

class MemoryCache {
    constructor() {
        this.cache = new Map();
        // Clean up expired entries every 10 minutes
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    set(key, value, ttl = CACHE_TTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    size() {
        return this.cache.size;
    }
}

const memoryCache = new MemoryCache();

// Cache middleware for Express routes
function cacheMiddleware(ttl = CACHE_TTL) {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = `${req.originalUrl}:${JSON.stringify(req.query)}`;
        const cached = memoryCache.get(key);

        if (cached) {
            // Return cached response
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        // Cache the response
        const originalJson = res.json;
        res.json = function(data) {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                memoryCache.set(key, data, ttl);
            }
            res.set('X-Cache', 'MISS');
            originalJson.call(this, data);
        };

        next();
    };
}

// Cache for database queries
const dbCache = {
    get: (key) => memoryCache.get(`db:${key}`),
    set: (key, value, ttl = CACHE_TTL) => memoryCache.set(`db:${key}`, value, ttl),
    delete: (key) => memoryCache.delete(`db:${key}`),
    clear: () => {
        // Clear only DB cache entries
        for (const key of memoryCache.cache.keys()) {
            if (key.startsWith('db:')) {
                memoryCache.delete(key);
            }
        }
    }
};

module.exports = {
    MemoryCache,
    cacheMiddleware,
    dbCache,
    memoryCache
};