// ============================================================
// Auth middleware — protects routes that need a logged-in user
// ============================================================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'You must be logged in.' });
    }
    return res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.is_admin) {
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    return res.status(403).send('Admin access required.');
}

module.exports = { requireAuth, requireAdmin };
