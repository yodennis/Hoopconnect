async function test() {
    const lat = 40.7128, lng = -74.006, radius = 3000;

    // Simple query first
    const q1 = `[out:json][timeout:15];(
        node["leisure"="pitch"](around:${radius},${lat},${lng});
        way["leisure"="pitch"](around:${radius},${lat},${lng});
    );out center;`;

    console.log('Testing simple pitch query for NYC...');
    const r1 = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q1),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const d1 = await r1.json();
    console.log('Simple pitches:', d1.elements?.length || 0);

    // Full query
    const q2 = `[out:json][timeout:15];(
        node["leisure"="pitch"](around:${radius},${lat},${lng});
        way["leisure"="pitch"](around:${radius},${lat},${lng});
        relation["leisure"="pitch"](around:${radius},${lat},${lng});
        node["leisure"="sports_centre"](around:${radius},${lat},${lng});
        way["leisure"="sports_centre"](around:${radius},${lat},${lng});
        node["sport"](around:${radius},${lat},${lng});
        way["sport"](around:${radius},${lat},${lng});
        node["leisure"="playground"]["sport"](around:${radius},${lat},${lng});
        way["leisure"="playground"]["sport"](around:${radius},${lat},${lng});
        node["leisure"="fitness_centre"](around:${radius},${lat},${lng});
        way["leisure"="fitness_centre"](around:${radius},${lat},${lng});
        node["leisure"="recreation_ground"](around:${radius},${lat},${lng});
        way["leisure"="recreation_ground"](around:${radius},${lat},${lng});
    );out center;`;

    console.log('Testing full query for NYC...');
    try {
        const r2 = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(q2),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: AbortSignal.timeout(20000)
        });
        if (!r2.ok) {
            console.log('Full query HTTP error:', r2.status, await r2.text().then(t => t.slice(0, 200)));
        } else {
            const d2 = await r2.json();
            console.log('Full query results:', d2.elements?.length || 0);
        }
    } catch (e) {
        console.log('Full query error:', e.message);
    }
}

test();
