// ============================================================
// Input Sanitization Middleware
// Prevents XSS attacks and validates/sanitizes user inputs
// ============================================================
const validator = require('validator');

// Input sanitization rules
const sanitizeRules = {
    // Basic text fields - allow common characters but strip HTML/script
    text: (value) => {
        if (typeof value !== 'string') return value;
        return validator.escape(value.trim());
    },

    // HTML content - more permissive but still safe
    html: (value) => {
        if (typeof value !== 'string') return value;
        // Allow basic HTML tags but escape dangerous ones
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
            .trim();
    },

    // Email validation and sanitization
    email: (value) => {
        if (typeof value !== 'string') return value;
        const clean = validator.normalizeEmail(value.trim());
        if (!clean || !validator.isEmail(clean)) {
            throw new Error('Invalid email format');
        }
        return clean;
    },

    // Username validation
    username: (value) => {
        if (typeof value !== 'string') return value;
        const clean = value.trim();
        if (!validator.isLength(clean, { min: 3, max: 50 })) {
            throw new Error('Username must be 3-50 characters');
        }
        if (!validator.matches(clean, /^[a-zA-Z0-9_-]+$/)) {
            throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }
        return clean;
    },

    // Password validation (doesn't sanitize, just validates)
    password: (value) => {
        if (typeof value !== 'string') return value;
        if (!validator.isLength(value, { min: 8 })) {
            throw new Error('Password must be at least 8 characters');
        }
        // Check for at least one uppercase, lowercase, and number
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            throw new Error('Password must contain uppercase, lowercase, and number');
        }
        return value; // Don't trim passwords
    },

    // Name fields
    name: (value) => {
        if (typeof value !== 'string') return value;
        const clean = validator.escape(value.trim());
        if (!validator.isLength(clean, { min: 1, max: 100 })) {
            throw new Error('Name must be 1-100 characters');
        }
        return clean;
    },

    // URL validation
    url: (value) => {
        if (typeof value !== 'string' || !value.trim()) return value;
        const clean = value.trim();
        if (!validator.isURL(clean, { protocols: ['http', 'https'], require_protocol: true })) {
            throw new Error('Invalid URL format');
        }
        return clean;
    },

    // Phone number (basic validation)
    phone: (value) => {
        if (typeof value !== 'string' || !value.trim()) return value;
        const clean = value.replace(/[^\d+\-\s()]/g, '').trim();
        if (clean && !validator.isMobilePhone(clean, 'any')) {
            throw new Error('Invalid phone number format');
        }
        return clean;
    },

    // Numeric fields
    number: (value) => {
        const num = Number(value);
        if (isNaN(num)) {
            throw new Error('Must be a valid number');
        }
        return num;
    },

    // Integer fields
    integer: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num !== Number(value)) {
            throw new Error('Must be a valid integer');
        }
        return num;
    },

    // Boolean fields
    boolean: (value) => {
        if (typeof value === 'string') {
            return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);
    },

    // Location/address fields
    location: (value) => {
        if (typeof value !== 'string') return value;
        const clean = validator.escape(value.trim());
        if (!validator.isLength(clean, { max: 200 })) {
            throw new Error('Location must be less than 200 characters');
        }
        return clean;
    },

    // Bio/description fields
    bio: (value) => {
        if (typeof value !== 'string') return value;
        const clean = validator.escape(value.trim());
        if (!validator.isLength(clean, { max: 500 })) {
            throw new Error('Bio must be less than 500 characters');
        }
        return clean;
    },

    // Coordinate fields
    latitude: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < -90 || num > 90) {
            throw new Error('Latitude must be between -90 and 90');
        }
        return num;
    },

    longitude: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < -180 || num > 180) {
            throw new Error('Longitude must be between -180 and 180');
        }
        return num;
    },

    // Date validation
    date: (value) => {
        if (typeof value !== 'string') return value;
        const clean = value.trim();
        if (!validator.isISO8601(clean) && !validator.matches(clean, /^\d{4}-\d{2}-\d{2}$/)) {
            throw new Error('Invalid date format (use YYYY-MM-DD)');
        }
        return clean;
    },

    // Time validation
    time: (value) => {
        if (typeof value !== 'string') return value;
        const clean = value.trim();
        if (!validator.matches(clean, /^\d{2}:\d{2}(:\d{2})?$/)) {
            throw new Error('Invalid time format (use HH:MM or HH:MM:SS)');
        }
        return clean;
    },

    // Optional time validation
    optional_time: (value) => {
        if (value === undefined || value === null || value === '') return value;
        return sanitizeRules.time(value);
    },

    // Optional text validation
    optional_text: (value) => {
        if (value === undefined || value === null || value === '') return value;
        return sanitizeRules.text(value);
    },

    // Optional integer validation
    optional_integer: (value) => {
        if (value === undefined || value === null || value === '') return value;
        return sanitizeRules.integer(value);
    },

    // Optional enum validation
    optional_enum: (value, options) => {
        if (value === undefined || value === null || value === '') return value;
        return sanitizeRules.enum(value, options);
    },

    // Enum validation (requires options parameter)
    enum: (value, options) => {
        if (typeof value !== 'string') {
            throw new Error('Enum value must be a string');
        }
        const clean = value.trim().toLowerCase();
        if (!options || !options.includes(clean)) {
            throw new Error(`Value must be one of: ${options.join(', ')}`);
        }
        return clean;
    }
};

// Sanitize object recursively
function sanitizeObject(obj, schema) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
        const rule = schema[key];

        if (rule) {
            try {
                let actualRule = rule;
                let isOptional = false;

                if (typeof rule === 'string') {
                    // Check for optional_ prefix
                    if (rule.startsWith('optional_')) {
                        isOptional = true;
                        actualRule = rule.substring(9); // Remove 'optional_' prefix
                    }

                    // Skip validation if optional field is missing/empty
                    if (isOptional && (value === undefined || value === null || value === '')) {
                        continue;
                    }

                    // Handle enum:option1,option2 format
                    if (actualRule.startsWith('enum:')) {
                        const parts = actualRule.split(':');
                        const options = parts[1].split(',');
                        sanitized[key] = sanitizeRules.enum(value, options);
                    } else {
                        // Use predefined rule
                        sanitized[key] = sanitizeRules[actualRule](value);
                    }
                } else if (typeof rule === 'function') {
                    // Custom sanitization function
                    sanitized[key] = rule(value);
                } else if (typeof rule === 'object' && rule.type) {
                    // Advanced rule with options
                    const sanitizer = sanitizeRules[rule.type];
                    if (sanitizer) {
                        let result = sanitizer(value);

                        // Apply additional constraints
                        if (rule.min !== undefined && result < rule.min) {
                            throw new Error(`Value must be at least ${rule.min}`);
                        }
                        if (rule.max !== undefined && result > rule.max) {
                            throw new Error(`Value must be at most ${rule.max}`);
                        }
                        if (rule.options && !rule.options.includes(result)) {
                            throw new Error(`Value must be one of: ${rule.options.join(', ')}`);
                        }

                        sanitized[key] = result;
                    }
                }
            } catch (error) {
                throw new Error(`${key}: ${error.message}`);
            }
        } else {
            // No sanitization rule - still escape strings to be safe
            sanitized[key] = typeof value === 'string' ? validator.escape(value) : value;
        }
    }

    return sanitized;
}

// Middleware function
function sanitizeInput(schema) {
    return (req, res, next) => {
        try {
            // Sanitize body
            if (req.body && Object.keys(req.body).length > 0) {
                req.body = sanitizeObject(req.body, schema);
            }

            // Sanitize query parameters
            if (req.query && Object.keys(req.query).length > 0) {
                req.query = sanitizeObject(req.query, schema);
            }

            // Sanitize route parameters
            if (req.params && Object.keys(req.params).length > 0) {
                req.params = sanitizeObject(req.params, schema);
            }

            next();
        } catch (error) {
            return res.status(400).json({
                error: 'Input validation failed',
                details: error.message
            });
        }
    };
}

// Export both the middleware factory and the rules for custom use
module.exports = {
    sanitizeInput,
    sanitizeRules,
    sanitizeObject
};