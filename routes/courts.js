// ============================================================
// Court Submission Routes — community court submissions + admin review
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/sanitize');

// ---- File upload config ----
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'courts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `court-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
    }
});

// Admin check middleware
function requireAdmin(req, res, next) {
    if (!req.session?.user) return res.status(401).json({ error: 'Not logged in.' });
    if (!req.session.user.is_admin) return res.status(403).json({ error: 'Admin access required.' });
    next();
}

// ---------- Submit a new court ----------
router.post('/', requireAuth, upload.single('photo'), sanitizeInput({
    court_name: 'text',
    address: 'optional_text',
    city: 'text',
    state: 'text',
    latitude: 'latitude',
    longitude: 'longitude',
    indoor_outdoor: 'enum:indoor,outdoor',
    sport_ids: 'optional_text',
    notes: 'optional_text'
}), async (req, res) => {
    try {
        const { court_name, address, city, state, latitude, longitude, indoor_outdoor, sport_ids, notes } = req.body;

        if (!court_name || !city || !state || !latitude || !longitude) {
            return res.status(400).json({ error: 'Court name, city, state, and coordinates are required.' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid coordinates.' });
        }

        const photoPath = req.file ? `/uploads/courts/${req.file.filename}` : null;

        const [result] = await pool.query(
            `INSERT INTO court_submissions (user_id, court_name, address, city, state, latitude, longitude, indoor_outdoor, sport_ids, notes, photo_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.session.user.user_id, court_name.trim(), address?.trim() || null, city.trim(), state.trim(),
             lat, lng, indoor_outdoor || 'outdoor', sport_ids || null, notes?.trim() || null, photoPath]
        );

        res.status(201).json({ message: 'Court submitted for review!', submission_id: result.insertId });
    } catch (err) {
        console.error('Court submission error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get my submissions ----------
router.get('/my', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM court_submissions WHERE user_id = ? ORDER BY created_at DESC`,
            [req.session.user.user_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Admin: Get all pending submissions ----------
router.get('/admin/pending', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT cs.*, u.username, u.first_name
            FROM court_submissions cs
            JOIN users u ON cs.user_id = u.user_id
            WHERE cs.status = 'pending'
            ORDER BY cs.created_at ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Admin: Get all submissions (any status) ----------
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT cs.*, u.username, u.first_name
            FROM court_submissions cs
            JOIN users u ON cs.user_id = u.user_id
            ORDER BY cs.created_at DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Admin: Approve a submission ----------
router.put('/admin/:id/approve', requireAdmin, sanitizeInput({
    admin_notes: 'optional_text'
}), async (req, res) => {
    try {
        const subId = parseInt(req.params.id, 10);
        const [[sub]] = await pool.query('SELECT * FROM court_submissions WHERE submission_id = ?', [subId]);
        if (!sub) return res.status(404).json({ error: 'Submission not found.' });
        if (sub.status !== 'pending') return res.status(400).json({ error: 'Already reviewed.' });

        // Insert into locations table
        const [locResult] = await pool.query(
            `INSERT INTO locations (location_name, address, city, state, latitude, longitude, indoor_outdoor, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [sub.court_name, sub.address, sub.city, sub.state, sub.latitude, sub.longitude, sub.indoor_outdoor,
             sub.notes ? `Community submitted. ${sub.notes}` : 'Community submitted court.']
        );

        // Add sport associations if provided
        if (sub.sport_ids) {
            const ids = sub.sport_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            for (const sid of ids) {
                await pool.query(
                    'INSERT IGNORE INTO location_sports (location_id, sport_id) VALUES (?, ?)',
                    [locResult.insertId, sid]
                ).catch(() => {});
            }
        }

        // Mark submission as approved
        await pool.query(
            `UPDATE court_submissions SET status = 'approved', admin_notes = ?, reviewed_at = NOW() WHERE submission_id = ?`,
            [req.body.admin_notes || null, subId]
        );

        // Notify submitter
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'court_approved', 'Court Approved! ✅', ?, '/explore')`,
            [sub.user_id, `Your court "${sub.court_name}" has been approved and is now on the map!`]
        ).catch(() => {});

        res.json({ message: 'Court approved and added to the map!', location_id: locResult.insertId });
    } catch (err) {
        console.error('Approve error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Admin: Reject a submission ----------
router.put('/admin/:id/reject', requireAdmin, sanitizeInput({
    reason: 'optional_text'
}), async (req, res) => {
    try {
        const subId = parseInt(req.params.id, 10);
        const [[sub]] = await pool.query('SELECT * FROM court_submissions WHERE submission_id = ?', [subId]);
        if (!sub) return res.status(404).json({ error: 'Submission not found.' });
        if (sub.status !== 'pending') return res.status(400).json({ error: 'Already reviewed.' });

        await pool.query(
            `UPDATE court_submissions SET status = 'rejected', admin_notes = ?, reviewed_at = NOW() WHERE submission_id = ?`,
            [req.body.reason || null, subId]
        );

        // Notify submitter
        const reason = req.body.reason ? ` Reason: ${req.body.reason}` : '';
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'court_rejected', 'Court Submission Update', ?, '/submit-court')`,
            [sub.user_id, `Your court "${sub.court_name}" was not approved.${reason}`]
        ).catch(() => {});

        res.json({ message: 'Submission rejected.' });
    } catch (err) {
        console.error('Reject error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
