const fetch = globalThis.fetch;

async function test() {
    // Get Suffolk, VA coordinates
    const nr = await fetch(
        'https://nominatim.openstreetmap.org/search?q=Suffolk,Virginia,USA&format=json&limit=1',
        { headers: { 'User-Agent': 'HoopConnect/1.0' } }
    );
    const nd = await nr.json();
    console.log('Suffolk coords:', nd[0].lat, nd[0].lon);

    const lat = nd[0].lat;
    const lng = nd[0].lon;

    // Search Overpass for courts within 10km
    const query = `[out:json][timeout:10];(
        node["leisure"="pitch"](around:10000,${lat},${lng});
        way["leisure"="pitch"](around:10000,${lat},${lng});
        node["leisure"="sports_centre"](around:10000,${lat},${lng});
        way["leisure"="sports_centre"](around:10000,${lat},${lng});
    );out center;`;

    const or2 = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const od = await or2.json();
    console.log('Overpass results:', od.elements.length, 'courts found');
    if (od.elements.length > 0) {
        od.elements.slice(0, 3).forEach(e => {
            console.log(' -', e.tags?.name || e.tags?.sport || 'unnamed', e.lat || e.center?.lat);
        });
    }
}

test().catch(console.error);
