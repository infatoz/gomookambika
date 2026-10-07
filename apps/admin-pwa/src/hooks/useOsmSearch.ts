import { useState, useRef, useCallback } from 'react';

/* ─── Types ────────────────────────────────────────────────────────────── */

/** Normalised result shape — works across providers */
export interface OsmResult {
  // Raw display string
  display_name: string;
  // Coordinates
  lat: string;
  lon: string;
  // Structured address (populated by provider parsers)
  address: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  // Source for debugging
  _source?: 'photon' | 'nominatim';
}

/* ─── Photon (Komoot) provider ─────────────────────────────────────────
   - Open source geocoder powered by OSM data
   - No API key required, no strict rate limit
   - Returns GeoJSON FeatureCollection
   - Much faster than Nominatim
   ─────────────────────────────────────────────────────────────────────── */
async function searchPhoton(q: string): Promise<OsmResult[]> {
  const params = new URLSearchParams({
    q,
    limit: '8',
    lang: 'en',
    // Bias results toward India (lat/lon of India center)
    'location_bias_scale': '0.2',
    lat: '20.5937',
    lon: '78.9629',
  });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Photon error');
  const json = await res.json();

  // Photon returns GeoJSON FeatureCollection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.features ?? []).map((f: any): OsmResult => {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry?.coordinates ?? [0, 0];

    // Build display name
    const parts = [
      p.name,
      p.street,
      p.district || p.city || p.town || p.village,
      p.state,
      p.country,
    ].filter(Boolean);

    return {
      display_name: parts.join(', '),
      lat: String(lat),
      lon: String(lon),
      address: {
        road: p.street ?? p.name,
        suburb: p.district,
        city: p.city || p.town || p.village,
        town: p.town,
        village: p.village,
        county: p.county,
        state: p.state,
        country: p.country,
        postcode: p.postcode,
      },
      _source: 'photon',
    };
  });
}

/* ─── Nominatim (OSM) fallback ─────────────────────────────────────────
   Used only when Photon returns 0 results or fails.
   ─────────────────────────────────────────────────────────────────────── */
async function searchNominatim(q: string): Promise<OsmResult[]> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '8',
    // No countrycodes restriction — gives broader results
    'accept-language': 'en',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'GoMookambikaAdmin/1.0' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error('Nominatim error');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  return data.map(r => ({ ...r, _source: 'nominatim' as const }));
}

/* ─── Hook ──────────────────────────────────────────────────────────── */
export function useOsmSearch() {
  const [results, setResults] = useState<OsmResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState('');
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef              = useRef<AbortController | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        // Try Photon first (faster, no rate limit)
        let data = await searchPhoton(q);

        // If Photon returned nothing, fall back to Nominatim
        if (data.length === 0) {
          data = await searchNominatim(q);
        }

        setResults(data);
      } catch {
        // Photon failed — try Nominatim silently
        try {
          const data = await searchNominatim(q);
          setResults(data);
        } catch {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 280); // 280ms debounce — fast enough, avoids hammering
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  return { results, loading, query, search, clear };
}

/* ─── Address parser ────────────────────────────────────────────────── */
export function parseOsmAddress(r: OsmResult) {
  const a = r.address;

  // City: prefer city > town > village > county
  const city = a.city || a.town || a.village || a.county || a.district || '';

  // Street line: road + suburb/neighbourhood
  const line1Parts: string[] = [];
  if (a.road) line1Parts.push(a.road);
  if (a.suburb || a.neighbourhood) line1Parts.push((a.suburb || a.neighbourhood)!);
  const line1 = line1Parts.join(', ');

  return {
    line1,
    city,
    state: a.state ?? 'Karnataka',
    country: a.country ?? 'India',
    latitude: r.lat,
    longitude: r.lon,
    displayName: r.display_name,
  };
}
