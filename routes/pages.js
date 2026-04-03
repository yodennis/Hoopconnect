// ============================================================
// Page Routes — serves HTML files
// ============================================================
const express = require('express');
const router  = express.Router();
const path    = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const pub = (file) => path.join(__dirname, '..', 'public', file);

// Public pages
router.get('/',           (req, res) => res.sendFile(pub('index.html')));
router.get('/explore',    (req, res) => res.sendFile(pub('explore.html')));
router.get('/login',      (req, res) => res.sendFile(pub('login.html')));
router.get('/register',   (req, res) => res.sendFile(pub('register.html')));
router.get('/games',      (req, res) => res.sendFile(pub('games.html')));
router.get('/teams',      (req, res) => res.sendFile(pub('teams.html')));
router.get('/team/:id',   (req, res) => res.sendFile(pub('team-detail.html')));
router.get('/game/:id',   (req, res) => res.sendFile(pub('game-detail.html')));
router.get('/player/:id', (req, res) => res.sendFile(pub('player.html')));

// Public pages (continued)
router.get('/pro',        (req, res) => res.sendFile(pub('pro.html')));
router.get('/support',    (req, res) => res.sendFile(pub('support.html')));
router.get('/leaderboard',(req, res) => res.sendFile(pub('leaderboard.html')));
router.get('/forgot-password', (req, res) => res.sendFile(pub('forgot-password.html')));
router.get('/reset-password', (req, res) => res.sendFile(pub('reset-password.html')));

// Protected pages
router.get('/dashboard',     requireAuth, (req, res) => res.sendFile(pub('dashboard.html')));
router.get('/profile',       requireAuth, (req, res) => res.sendFile(pub('profile.html')));
router.get('/settings',      requireAuth, (req, res) => res.sendFile(pub('settings.html')));
router.get('/submit-court',  requireAuth, (req, res) => res.sendFile(pub('submit-court.html')));
router.get('/admin/courts', requireAdmin, (req, res) => res.sendFile(pub('admin-courts.html')));
router.get('/messages',      requireAuth, (req, res) => res.sendFile(pub('messages.html')));
router.get('/activity',      requireAuth, (req, res) => res.sendFile(pub('activity.html')));
router.get('/achievements',  requireAuth, (req, res) => res.sendFile(pub('achievements.html')));
router.get('/analytics',     requireAuth, (req, res) => res.sendFile(pub('analytics.html')));
router.get('/tournaments',   (req, res) => res.sendFile(pub('tournaments.html')));
router.get('/tournament/:id',(req, res) => res.sendFile(pub('tournament-detail.html')));
router.get('/compare',       (req, res) => res.sendFile(pub('compare.html')));
router.get('/invite/:token', (req, res) => res.sendFile(pub('invite.html')));

module.exports = router;
