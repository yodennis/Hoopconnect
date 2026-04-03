// ============================================================
// Nearby Routes — find courts/fields via Overpass API + DB
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ALLOWED_SPORTS = ['basketball', 'soccer', 'football', 'tennis', 'volleyball', 'baseball', 'softball', 'badminton', 'pickleball', 'multi'];

router.get('/', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radius = Math.min(Math.max(parseInt(req.query.radius) || 5000, 500), 25000);
        const sport = (req.query.sport || '').toLowerCase().trim();

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Valid lat and lng are required.' });
        }
        if (sport && !ALLOWED_SPORTS.includes(sport)) {
            return res.status(400).json({ error: 'Invalid sport filter.' });
        }

        // Build Overpass query — search pitches, sports centres, recreation grounds
        const sf = sport && sport !== 'multi' ? `["sport"~"${sport}",i]` : '';
        const a = `around:${radius},${lat},${lng}`;

        // When a sport filter is active, also search for standalone sport=X tags
        // When no filter, search pitches + sports centres + recreation grounds
        const query = sport && sport !== 'multi'
            ? `[out:json][timeout:15];(
                node["leisure"="pitch"]${sf}(${a});
                way["leisure"="pitch"]${sf}(${a});
                node["sport"~"${sport}",i]["leisure"](${a});
                way["sport"~"${sport}",i]["leisure"](${a});
                node["leisure"="sports_centre"](${a});
                way["leisure"="sports_centre"](${a});
              );out center;`
            : `[out:json][timeout:15];(
                node["leisure"="pitch"](${a});
                way["leisure"="pitch"](${a});
                node["leisure"="sports_centre"](${a});
                way["leisure"="sports_centre"](${a});
                node["leisure"="recreation_ground"](${a});
                way["leisure"="recreation_ground"](${a});
              );out center;`;

        let overpassResults = [];
        try {
            const response = await fetch(OVERPASS_URL, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(query),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: AbortSignal.timeout(18000)
            });
            if (response.ok) {
                const data = await response.json();
                // Deduplicate by element id
                const seen = new Set();
                overpassResults = (data.elements || []).filter(el => {
                    const key = `${el.type}-${el.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            } else {
                console.warn('Overpass HTTP', response.status);
            }
        } catch (e) {
            console.warn('Overpass error:', e.message);
        }

        // Fetch database locations nearby
        const latRange = radius / 111000;
        const lngRange = radius / (111000 * Math.cos(lat * Math.PI / 180));
        const [dbLocations] = await pool.query(
            `SELECT l.*, GROUP_CONCAT(s.sport_name SEPARATOR ', ') AS sports_supported
             FROM locations l
             LEFT JOIN location_sports ls ON l.location_id = ls.location_id
             LEFT JOIN sports s ON ls.sport_id = s.sport_id
             WHERE l.latitude BETWEEN ? AND ? AND l.longitude BETWEEN ? AND ?
             GROUP BY l.location_id`,
            [lat - latRange, lat + latRange, lng - lngRange, lng + lngRange]
        );

        res.json({ overpass: overpassResults, database: dbLocations });
    } catch (err) {
        console.error('Nearby error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
