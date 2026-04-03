// ============================================================
// Pro Membership Routes — Stripe checkout + subscription mgmt
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE  = process.env.STRIPE_PRICE_ID;       // monthly $4.99 price
const APP_URL       = process.env.APP_URL || 'http://localhost:3000';

// Lazy-load Stripe only when key exists
function getStripe() {
    if (!STRIPE_SECRET) return null;
    return require('stripe')(STRIPE_SECRET);
}

// ---------- Get pro status ----------
router.get('/status', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT is_pro, pro_since FROM users WHERE user_id = ?',
            [req.session.user.user_id]
        );
        res.json({ is_pro: !!rows[0]?.is_pro, pro_since: rows[0]?.pro_since });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Create Stripe checkout session ----------
router.post('/checkout', requireAuth, async (req, res) => {
    const stripe = getStripe();
    if (!stripe || !STRIPE_PRICE) {
        return res.status(503).json({ error: 'Payments not configured yet. Contact admin.' });
    }

    try {
        const uid = req.session.user.user_id;
        const [rows] = await pool.query('SELECT email, stripe_customer_id FROM users WHERE user_id = ?', [uid]);
        const user = rows[0];

        let customerId = user.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: uid.toString() } });
            customerId = customer.id;
            await pool.query('UPDATE users SET stripe_customer_id = ? WHERE user_id = ?', [customerId, uid]);
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: STRIPE_PRICE, quantity: 1 }],
            success_url: `${APP_URL}/pro?success=1`,
            cancel_url: `${APP_URL}/pro?cancelled=1`,
            metadata: { user_id: uid.toString() }
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        res.status(500).json({ error: 'Payment error.' });
    }
});

// ---------- Stripe webhook ----------
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.sendStatus(400);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.sendStatus(400);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const uid = session.metadata?.user_id;
        if (uid) {
            await pool.query('UPDATE users SET is_pro = 1, pro_since = NOW() WHERE user_id = ?', [uid]);
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const customerId = sub.customer;
        await pool.query('UPDATE users SET is_pro = 0 WHERE stripe_customer_id = ?', [customerId]);
    }

    res.sendStatus(200);
});

// ---------- Manual pro toggle (dev/admin) ----------
router.post('/activate', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        await pool.query('UPDATE users SET is_pro = 1, pro_since = NOW() WHERE user_id = ?', [uid]);
        res.json({ message: 'Pro activated!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
