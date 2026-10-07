import { useState, useRef, useCallback } from 'react';

export interface OsmResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export function useOsmSearch() {
  const [results, setResults]   = useState<OsmResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState('');
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 3) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q, format: 'json', addressdetails: '1', limit: '6',
          countrycodes: 'in',   // restrict to India
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'en' },
        });
        const data: OsmResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 380);
  }, []);

  const clear = () => { setResults([]); setQuery(''); };

  return { results, loading, query, search, clear };
}

/** Parse OSM result into our form's address shape */
export function parseOsmAddress(r: OsmResult) {
  const a = r.address;
  const city = a.city || a.town || a.village || a.county || '';
  const line1 = [a.road, a.suburb].filter(Boolean).join(', ');
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
