// ============================================================
// User Routes — Profile view / edit
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/sanitize');

// ---- Avatar upload config ----
const avatarDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `avatar-${req.session.user.user_id}-${Date.now()}${ext}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
    }
});

// ---------- Get current user profile ----------
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id, username, email, first_name, last_name, display_name,
                    age, city, state, bio, skill_level, availability, profile_image, is_pro, pro_since, created_at
             FROM users WHERE user_id = ?`,
            [req.session.user.user_id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

        // Get user sports
        const [sports] = await pool.query(
            `SELECT s.sport_id, s.sport_name
             FROM user_sports us JOIN sports s ON us.sport_id = s.sport_id
             WHERE us.user_id = ?`,
            [req.session.user.user_id]
        );

        res.json({ ...rows[0], sports });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get profile viewers (Pro feature) ----------
router.get('/profile/viewers', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;

        // Check pro status
        const [[user]] = await pool.query('SELECT is_pro FROM users WHERE user_id = ?', [uid]);
        if (!user?.is_pro) {
            return res.status(403).json({ error: 'Pro feature. Upgrade to see who viewed your profile.' });
        }

        const [rows] = await pool.query(`
            SELECT pv.viewed_at, u.user_id, u.username, u.display_name, u.first_name
            FROM profile_views pv
            JOIN users u ON pv.viewer_id = u.user_id
            WHERE pv.viewed_id = ?
            ORDER BY pv.viewed_at DESC
            LIMIT 20
        `, [uid]);

        const [[countRow]] = await pool.query(
            'SELECT COUNT(*) as total FROM profile_views WHERE viewed_id = ?', [uid]
        );

        res.json({ total_views: countRow.total, recent_viewers: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get any user by id ----------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id, username, display_name, first_name, city, state,
                    bio, skill_level, availability, is_pro, created_at
             FROM users WHERE user_id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

        const [sports] = await pool.query(
            `SELECT s.sport_id, s.sport_name
             FROM user_sports us JOIN sports s ON us.sport_id = s.sport_id
             WHERE us.user_id = ?`,
            [req.params.id]
        );

        // Track profile view (non-blocking)
        const viewerId = req.session?.user?.user_id || null;
        const viewedId = parseInt(req.params.id, 10);
        if (viewerId && viewerId !== viewedId) {
            pool.query(
                'INSERT INTO profile_views (viewer_id, viewed_id) VALUES (?, ?)',
                [viewerId, viewedId]
            ).catch(() => {});
        }

        res.json({ ...rows[0], sports });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Upload profile picture ----------
router.post('/profile/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });

        const uid = req.session.user.user_id;
        const imagePath = `/uploads/avatars/${req.file.filename}`;

        // Delete old avatar file if exists
        const [old] = await pool.query('SELECT profile_image FROM users WHERE user_id = ?', [uid]);
        if (old[0]?.profile_image) {
            const oldPath = path.join(__dirname, '..', 'public', old[0].profile_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await pool.query('UPDATE users SET profile_image = ? WHERE user_id = ?', [imagePath, uid]);
        res.json({ message: 'Profile picture updated.', profile_image: imagePath });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Remove profile picture ----------
router.delete('/profile/avatar', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [old] = await pool.query('SELECT profile_image FROM users WHERE user_id = ?', [uid]);
        if (old[0]?.profile_image) {
            const oldPath = path.join(__dirname, '..', 'public', old[0].profile_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await pool.query('UPDATE users SET profile_image = NULL WHERE user_id = ?', [uid]);
        res.json({ message: 'Profile picture removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Update profile ----------
router.put('/profile', requireAuth, sanitizeInput({
    first_name: 'name',
    last_name: 'name',
    display_name: 'name',
    age: { type: 'integer', min: 13, max: 120 },
    city: 'location',
    state: 'text',
    bio: 'bio',
    skill_level: { type: 'text', options: ['beginner', 'intermediate', 'advanced', 'any'] },
    availability: 'text',
    sport_ids: (value) => Array.isArray(value) ? value.map(id => parseInt(id)).filter(id => !isNaN(id)) : []
}), async (req, res) => {
    try {
        const { first_name, last_name, display_name, age, city, state, bio, skill_level, availability, sport_ids } = req.body;
        const uid = req.session.user.user_id;

        await pool.query(
            `UPDATE users SET first_name=?, last_name=?, display_name=?, age=?, city=?, state=?,
             bio=?, skill_level=?, availability=? WHERE user_id=?`,
            [first_name, last_name || null, display_name || null, age || null, city || null,
             state || null, bio || null, skill_level || 'any', availability || null, uid]
        );

        // Update preferred sports
        if (Array.isArray(sport_ids)) {
            await pool.query('DELETE FROM user_sports WHERE user_id = ?', [uid]);
            for (const sid of sport_ids) {
                await pool.query('INSERT INTO user_sports (user_id, sport_id) VALUES (?, ?)', [uid, sid]);
            }
        }

        // Update session
        req.session.user.first_name = first_name;
        res.json({ message: 'Profile updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Change email ----------
router.put('/email', requireAuth, sanitizeInput({
    new_email: 'email',
    password: 'text'
}), async (req, res) => {
    try {
        const { new_email, password } = req.body;

        // Verify password
        const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [uid]);
        const bcrypt = require('bcrypt');
        const match = await bcrypt.compare(password, rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'Incorrect password.' });

        // Check if email already taken
        const [dup] = await pool.query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [new_email, uid]);
        if (dup.length > 0) return res.status(409).json({ error: 'Email already in use.' });

        await pool.query('UPDATE users SET email = ? WHERE user_id = ?', [new_email, uid]);
        req.session.user.email = new_email;
        res.json({ message: 'Email updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Change password ----------
router.put('/password', requireAuth, sanitizeInput({
    current_password: 'text',
    new_password: 'password'
}), async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [uid]);
        const bcrypt = require('bcrypt');
        const match = await bcrypt.compare(current_password, rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'Incorrect current password.' });

        const hash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, uid]);
        res.json({ message: 'Password updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
