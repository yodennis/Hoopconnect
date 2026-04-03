// ============================================================
// Support / Tip Jar Routes — one-time donations via Stripe
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL       = process.env.APP_URL || 'http://localhost:3000';

function getStripe() {
    if (!STRIPE_SECRET) return null;
    return require('stripe')(STRIPE_SECRET);
}

// ---------- Create tip checkout session ----------
router.post('/tip', async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ error: 'Payments not configured yet.' });
    }

    const amount = parseInt(req.body.amount, 10);
    if (!amount || amount < 1 || amount > 500) {
        return res.status(400).json({ error: 'Invalid amount.' });
    }

    const message = typeof req.body.message === 'string'
        ? req.body.message.slice(0, 200)
        : '';

    try {
        const userId = req.session?.user?.user_id || null;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `HoopConnect Support — $${amount}` },
                    unit_amount: amount * 100
                },
                quantity: 1
            }],
            success_url: `${APP_URL}/support?success=1`,
            cancel_url:  `${APP_URL}/support?cancelled=1`,
            metadata: {
                type: 'tip',
                user_id: userId ? userId.toString() : 'anonymous',
                message
            }
        });

        // Store the tip in database (pending until webhook confirms)
        await pool.query(
            'INSERT INTO tips (user_id, amount, message, stripe_session_id, status) VALUES (?, ?, ?, ?, ?)',
            [userId, amount, message || null, session.id, 'pending']
        );

        res.json({ url: session.url });
    } catch (err) {
        console.error('Tip checkout error:', err);
        res.status(500).json({ error: 'Payment error.' });
    }
});

// ---------- Stripe webhook for tips ----------
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.sendStatus(400);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch {
        return res.sendStatus(400);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.metadata?.type === 'tip') {
            await pool.query(
                'UPDATE tips SET status = ? WHERE stripe_session_id = ?',
                ['completed', session.id]
            );
        }
    }

    res.sendStatus(200);
});

// ---------- Get recent supporters (public) ----------
router.get('/recent', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.amount, t.message, t.created_at,
                   u.display_name, u.username
            FROM tips t
            LEFT JOIN users u ON t.user_id = u.user_id
            WHERE t.status = 'completed'
            ORDER BY t.created_at DESC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
