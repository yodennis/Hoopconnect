// ============================================================
// Auth Routes — Register / Login / Logout
// ============================================================
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const nodemailer = require('nodemailer');
const winston = require('winston');
const pool    = require('../config/db');
const { sanitizeInput } = require('../middleware/sanitize');

const SALT_ROUNDS = 10;

// Create logger for authentication operations
const authLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'hoopconnect-auth' },
    transports: [
        new winston.transports.File({ filename: 'logs/auth.log', options: { flags: 'w' } }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', options: { flags: 'w' } }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    authLogger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// Email transporter for password reset
let emailTransporter;
try {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    authLogger.info('Email transporter initialized', { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT });
} catch (error) {
    authLogger.error('Failed to initialize email transporter', { error: error.message });
    emailTransporter = null;
}

// ---------- Register ----------
router.post('/register', sanitizeInput({
    username: 'username',
    email: 'email',
    password: 'password',
    first_name: 'name',
    last_name: 'name',
    city: 'location',
    state: 'text',
    agreed_to_terms: 'boolean'
}), async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, city, state, agreed_to_terms } = req.body;
        if (first_name.length > 50) {
            return res.status(400).json({ error: 'First name is too long.' });
        }
        if (last_name && last_name.length > 50) {
            return res.status(400).json({ error: 'Last name is too long.' });
        }
        if (city && city.length > 100) {
            return res.status(400).json({ error: 'City name is too long.' });
        }
        if (state && state.length > 50) {
            return res.status(400).json({ error: 'State name is too long.' });
        }

        // Check duplicates
        const [existing] = await pool.query(
            'SELECT user_id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email already taken.' });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const [result] = await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, city, state, agreed_to_terms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, email, password_hash, first_name, last_name || null, city || null, state || null, agreed_to_terms ? 1 : 0]
        );

        req.session.user = { user_id: result.insertId, username, first_name, email, is_pro: false, is_admin: false, dark_mode: false };
        authLogger.info('User registration successful', {
            userId: result.insertId,
            username,
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.json({ message: 'Registration successful.', user: req.session.user });
    } catch (err) {
        authLogger.error('User registration failed', {
            error: err.message,
            stack: err.stack,
            username,
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error during registration.', details: err.message });
    }
});

// ---------- Login ----------
router.post('/login', sanitizeInput({
    email: 'email',
    password: 'text' // Don't validate password format on login
}), async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            authLogger.warn('Login failed - user not found', {
                email,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            authLogger.warn('Login failed - invalid password', {
                userId: user.user_id,
                email,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            first_name: user.first_name,
            email: user.email,
            is_pro: !!user.is_pro,
            is_admin: !!user.is_admin,
            dark_mode: !!user.dark_mode
        };
        authLogger.info('User login successful', {
            userId: user.user_id,
            username: user.username,
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.json({ message: 'Login successful.', user: req.session.user });
    } catch (err) {
        authLogger.error('Login error', {
            error: err.message,
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ---------- Forgot Password ----------
router.post('/forgot-password', sanitizeInput({
    email: 'email'
}), async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        // Check if user exists
        const [rows] = await pool.query('SELECT user_id, username, first_name FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            // Don't reveal if email exists or not for security
            authLogger.info('Password reset requested for non-existent email', { email, ip: req.ip });
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const user = rows[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save token to database
        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.user_id, resetToken, expiresAt]
        );

        // Send email
        if (!emailTransporter) {
            authLogger.error('Email transporter not available for password reset');
            return res.status(500).json({ error: 'Email service is currently unavailable. Please try again later.' });
        }

        const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        try {
            await emailTransporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: email,
                subject: 'HoopConnect - Password Reset Request',
                html: `
                    <h2>Password Reset Request</h2>
                    <p>Hello ${user.first_name},</p>
                    <p>You requested a password reset for your HoopConnect account.</p>
                    <p>Click the link below to reset your password:</p>
                    <p><a href="${resetUrl}">${resetUrl}</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this reset, please ignore this email.</p>
                    <br>
                    <p>Best regards,<br>HoopConnect Team</p>
                `
            });

            authLogger.info('Password reset email sent', {
                userId: user.user_id,
                email,
                ip: req.ip
            });
        } catch (emailError) {
            authLogger.error('Failed to send password reset email', {
                error: emailError.message,
                userId: user.user_id,
                email
            });
            return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
        }

        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (err) {
        authLogger.error('Forgot password error', {
            error: err.message,
            email,
            ip: req.ip
        });
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Server error during password reset request.' });
    }
});

// ---------- Reset Password ----------
router.post('/reset-password', sanitizeInput({
    token: 'text',
    newPassword: 'password'
}), async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Find valid token
        const [tokenRows] = await pool.query(
            'SELECT prt.*, u.email, u.username FROM password_reset_tokens prt JOIN users u ON prt.user_id = u.user_id WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used_at IS NULL',
            [token]
        );

        if (tokenRows.length === 0) {
            authLogger.warn('Invalid or expired password reset token used', { token, ip: req.ip });
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        const tokenData = tokenRows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update user password
        await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, tokenData.user_id]);

        // Mark token as used
        await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_id = ?', [tokenData.token_id]);

        // Clean up expired tokens
        await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');

        authLogger.info('Password reset successful', {
            userId: tokenData.user_id,
            username: tokenData.username,
            email: tokenData.email,
            ip: req.ip
        });

        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (err) {
        authLogger.error('Reset password error', {
            error: err.message,
            token,
            ip: req.ip
        });
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server error during password reset.' });
    }
});

// ---------- Logout ----------
router.post('/logout', (req, res) => {
    const userId = req.session.user?.user_id;
    const username = req.session.user?.username;
    req.session.destroy(() => {
        authLogger.info('User logout successful', {
            userId,
            username,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.json({ message: 'Logged out.' });
    });
});

// ---------- Current session ----------
router.get('/me', (req, res) => {
    if (req.session.user) {
        return res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
    }
    res.json({ user: null, csrfToken: req.session.csrfToken });
});

module.exports = router;
