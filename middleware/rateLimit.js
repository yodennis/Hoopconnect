// ============================================================
// Rate Limiting Middleware — in-memory sliding window with memory management
// ============================================================
const rateLimitStore = new Map();
const MAX_STORE_SIZE = 10000; // Maximum number of keys to store

function rateLimit({ windowMs = 60000, max = 60, message = 'Too many requests, please try again later.' } = {}) {
    return (req, res, next) => {
        const key = (req.session?.user?.user_id || req.ip) + ':' + req.baseUrl;
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, []);
        }

        const hits = rateLimitStore.get(key).filter(t => t > windowStart);
        hits.push(now);
        rateLimitStore.set(key, hits);

        if (hits.length > max) {
            return res.status(429).json({ error: message });
        }

        next();
    };
}

// More aggressive cleanup every 2 minutes
setInterval(() => {
    const now = Date.now();
    const cutoff = now - 300000; // 5 minutes ago

    // Clean up expired entries
    for (const [key, hits] of rateLimitStore.entries()) {
        const filtered = hits.filter(t => t > cutoff);
        if (filtered.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, filtered);
        }
    }

    // If store is still too large, remove oldest entries
    if (rateLimitStore.size > MAX_STORE_SIZE) {
        const entries = Array.from(rateLimitStore.entries());
        // Sort by oldest hit time
        entries.sort((a, b) => {
            const aOldest = Math.min(...a[1]);
            const bOldest = Math.min(...b[1]);
            return aOldest - bOldest;
        });

        // Remove oldest 20% of entries
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            rateLimitStore.delete(entries[i][0]);
        }
    }
}, 120000); // Run every 2 minutes

module.exports = { rateLimit };
