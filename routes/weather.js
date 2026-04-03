// ============================================================
// Weather Proxy Route (uses Open-Meteo, no API key needed)
// ============================================================
const express = require('express');
const router  = express.Router();
const https   = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('Invalid JSON')); }
            });
        }).on('error', reject);
    });
}

// GET /api/weather?lat=X&lng=Y&date=YYYY-MM-DD
router.get('/', async (req, res) => {
    try {
        const { lat, lng, date } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required.' });

        const targetDate = date || new Date().toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const diffDays = Math.ceil((new Date(targetDate) - new Date(today)) / 86400000);

        // Open-Meteo supports 16-day forecast
        if (diffDays < 0 || diffDays > 15) {
            return res.json({ available: false, message: 'Weather only available for next 16 days.' });
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${targetDate}&end_date=${targetDate}`;

        const data = await fetchJSON(url);

        if (!data.daily || !data.daily.time || !data.daily.time.length) {
            return res.json({ available: false });
        }

        const weatherCodes = {
            0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
            55: 'Dense drizzle', 61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
            81: 'Moderate showers', 82: 'Violent showers', 95: 'Thunderstorm',
            96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail'
        };

        const code = data.daily.weathercode[0];
        res.json({
            available: true,
            date: targetDate,
            temp_high: data.daily.temperature_2m_max[0],
            temp_low: data.daily.temperature_2m_min[0],
            precipitation_chance: data.daily.precipitation_probability_max[0],
            condition: weatherCodes[code] || 'Unknown',
            code
        });
    } catch (err) {
        console.error(err);
        res.json({ available: false });
    }
});

module.exports = router;
