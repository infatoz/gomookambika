import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Crosshair,
  MapPin,
  Navigation,
  Compass,
  Layers,
  ExternalLink,
  CheckCircle2,
  Car,
  Plane,
  Landmark,
  Train,
  Mountain,
} from 'lucide-react';
import { api } from '@/lib/api';

export interface Coords {
  lat: number;
  lng: number;
}

export interface MapLocationPoint {
  _id?: string;
  name?: string;
  address?: string | { line1?: string; city?: string; state?: string };
  type?: string;
  lat: number;
  lng: number;
}

export interface AdminLocationItem {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  address?: { line1?: string; city?: string; state?: string };
  geoPoint?: { coordinates: [number, number] }; // [lng, lat]
}

interface UberMapProps {
  pickupCoords?: Coords | null;
  dropCoords?: Coords | null;
  pickupLocation?: MapLocationPoint | null;
  dropLocation?: MapLocationPoint | null;
  adminLocations?: AdminLocationItem[];
  onSelectCoords?: (coords: Coords) => void;
  onSelectLocation?: (
    location: { _id?: string; name: string; lat: number; lng: number },
    type: 'pickup' | 'drop'
  ) => void;
  className?: string;
}

// Available OpenStreetMap Tile Providers (No Google Maps API Required)
const OSM_TILE_LAYERS = {
  standard: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  humanitarian: {
    name: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Tiles style by Humanitarian OSM Team',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  carto_osm: {
    name: 'OSM Clean (Voyager)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
};

// Simulated nearby available taxis around Kollur temple zone
const SAMPLE_TAXIS = [
  { id: 't1', lat: 13.8665, lng: 74.8118, type: 'sedan', angle: 45 },
  { id: 't2', lat: 13.8631, lng: 74.8152, type: 'suv', angle: 120 },
  { id: 't3', lat: 13.8698, lng: 74.8142, type: 'hatchback', angle: 270 },
  { id: 't4', lat: 13.8741, lng: 74.6369, type: 'auto', angle: 90 },
];

export function UberMap({
  pickupCoords,
  dropCoords,
  pickupLocation,
  dropLocation,
  adminLocations = [],
  onSelectCoords,
  onSelectLocation,
  className = 'h-full w-full',
}: UberMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  // Markers & Layers refs
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropMarkerRef = useRef<L.Marker | null>(null);
  const clickedMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const adminMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const taxiMarkersGroupRef = useRef<L.LayerGroup | null>(null);

  // UI state
  const [activeLayer, setActiveLayer] = useState<'standard' | 'humanitarian' | 'carto_osm'>('standard');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [, setGeocodingLoading] = useState(false);

  // Default center: Kollur Sri Mookambika Temple
  const defaultCenter: [number, number] = [13.8647, 74.8135];

  // Switch Tile Layer
  const setTileLayer = useCallback((layerKey: 'standard' | 'humanitarian' | 'carto_osm') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const cfg = OSM_TILE_LAYERS[layerKey];
    const newLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      attribution: cfg.attribution,
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
    setActiveLayer(layerKey);
    setLayerMenuOpen(false);
  }, []);

  // ─── 1. INITIALIZE OPENSTREETMAP LEAFLET MAP ───
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    // Default: Official OpenStreetMap Standard Tile Layer
    const defaultOsmCfg = OSM_TILE_LAYERS.standard;
    const initialTileLayer = L.tileLayer(defaultOsmCfg.url, {
      maxZoom: defaultOsmCfg.maxZoom,
      subdomains: defaultOsmCfg.subdomains,
      attribution: defaultOsmCfg.attribution,
    }).addTo(map);
    currentTileLayerRef.current = initialTileLayer;

    // Zoom controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Groups for POIs and Taxis
    adminMarkersGroupRef.current = L.layerGroup().addTo(map);
    taxiMarkersGroupRef.current = L.layerGroup().addTo(map);

    // Nearby Taxis on OpenStreetMap
    SAMPLE_TAXIS.forEach(taxi => {
      const taxiIcon = L.divIcon({
        className: 'custom-taxi-marker',
        html: `
          <div style="transform: rotate(${taxi.angle}deg); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <div style="background: #ffffff; border: 2px solid #000000; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 15px;">
              🚕
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker([taxi.lat, taxi.lng], { icon: taxiIcon }).addTo(taxiMarkersGroupRef.current!);
    });

    // ─── CLICK TO SELECT LOCATION ON OPENSTREETMAP ───
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (onSelectCoords) {
        onSelectCoords({ lat, lng });
      }

      // Temporary marker with loading popup
      if (clickedMarkerRef.current) {
        map.removeLayer(clickedMarkerRef.current);
      }

      const tempIcon = L.divIcon({
        className: 'osm-selected-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.4)); animation: bounce 0.4s ease;">
            <div style="background: #2563EB; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 999px; margin-bottom: 3px; white-space: nowrap;">
              SELECTED POINT
            </div>
            <div style="width: 22px; height: 22px; background: #2563EB; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 2px #2563EB;"></div>
          </div>
        `,
        iconSize: [60, 48],
        iconAnchor: [30, 44],
      });

      const marker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      clickedMarkerRef.current = marker;

      marker
        .bindPopup(
          `
          <div style="font-family: inherit; min-width: 180px; padding: 4px;">
            <div style="font-weight: 700; font-size: 13px; color: #111827;">Fetching OpenStreetMap details...</div>
            <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
          </div>
        `,
          { closeButton: true }
        )
        .openPopup();

      // Reverse geocode via OpenStreetMap API
      try {
        setGeocodingLoading(true);
        const res = await api.get<{
          success: boolean;
          data: { displayName?: string; city?: string; state?: string };
        }>(`/map/reverse-geocode?lat=${lat}&lng=${lng}`);

        const resolvedName =
          res.data?.displayName?.split(',').slice(0, 3).join(', ') ||
          `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = 'inherit';
        popupContent.style.minWidth = '220px';
        popupContent.style.padding = '4px';

        popupContent.innerHTML = `
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #2563EB; letter-spacing: 0.05em; margin-bottom: 2px;">
            OpenStreetMap Point
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0F172A; line-height: 1.3;">
            ${resolvedName}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 3px;">
            Coordinates: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E
          </div>
          <div style="display: flex; gap: 6px; margin-top: 10px;">
            <button id="osm-btn-pickup" style="flex: 1; padding: 6px 10px; background: #000000; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Set Pickup
            </button>
            <button id="osm-btn-drop" style="flex: 1; padding: 6px 10px; background: #059669; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Set Drop
            </button>
          </div>
          <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank" rel="noreferrer" style="display: block; font-size: 10px; color: #475569; margin-top: 8px; text-decoration: underline; text-align: center;">
            View full OpenStreetMap record
          </a>
        `;

        popupContent.querySelector('#osm-btn-pickup')?.addEventListener('click', () => {
          if (onSelectLocation) {
            onSelectLocation({ name: resolvedName, lat, lng }, 'pickup');
          }
          marker.closePopup();
        });

        popupContent.querySelector('#osm-btn-drop')?.addEventListener('click', () => {
          if (onSelectLocation) {
            onSelectLocation({ name: resolvedName, lat, lng }, 'drop');
          }
          marker.closePopup();
        });

        marker.setPopupContent(popupContent);
      } catch {
        marker.setPopupContent(`
          <div style="font-size: 12px; color: #111;">
            <strong>Selected Point</strong><br/>
            Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}<br/>
            <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank">Open on OpenStreetMap</a>
          </div>
        `);
      } finally {
        setGeocodingLoading(false);
      }
    });

    mapInstanceRef.current = map;

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onSelectCoords, onSelectLocation]);

  // ─── 2. RENDER ADMIN LISTED LOCATIONS ON OPENSTREETMAP ───
  useEffect(() => {
    const group = adminMarkersGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!adminLocations || adminLocations.length === 0) return;

    adminLocations.forEach(loc => {
      if (!loc.geoPoint?.coordinates || loc.geoPoint.coordinates.length < 2) return;
      const [lng, lat] = loc.geoPoint.coordinates;

      let iconSymbol = '📍';
      let iconColor = '#000000';
      if (loc.type === 'TEMPLE') {
        iconSymbol = '🛕';
        iconColor = '#D97706';
      } else if (loc.type === 'AIRPORT') {
        iconSymbol = '✈️';
        iconColor = '#2563EB';
      } else if (loc.type === 'RAILWAY_STATION') {
        iconSymbol = '🚆';
        iconColor = '#7C3AED';
      } else if (loc.type === 'TOURIST_LOCATION') {
        iconSymbol = '🏖️';
        iconColor = '#EA580C';
      } else if (loc.type === 'TAXI_STAND') {
        iconSymbol = '🚖';
        iconColor = '#059669';
      }

      const poiIcon = L.divIcon({
        className: 'osm-admin-poi-pin',
        html: `
          <div style="display: flex; align-items: center; gap: 4px; background: #ffffff; border: 1.5px solid ${iconColor}; border-radius: 999px; padding: 2px 7px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); white-space: nowrap; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size: 13px;">${iconSymbol}</span>
            <span style="font-size: 11px; font-weight: 700; color: #0f172a; max-width: 110px; overflow: hidden; text-overflow: ellipsis;">${loc.name}</span>
          </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [60, 14],
      });

      const marker = L.marker([lat, lng], { icon: poiIcon });

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'inherit';
      popupContent.style.minWidth = '220px';
      popupContent.style.padding = '4px';

      popupContent.innerHTML = `
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${iconColor}; letter-spacing: 0.05em; margin-bottom: 2px;">
          Verified ${loc.type?.replace('_', ' ') || 'Location'}
        </div>
        <div style="font-weight: 700; font-size: 14px; color: #0F172A; line-height: 1.3;">
          ${loc.name}
        </div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
          ${loc.address?.city || 'Udupi / Kundapura Region'}
        </div>
        <div style="font-size: 10px; font-family: monospace; color: #94A3B8; margin-top: 3px;">
          GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 10px;">
          <button id="osm-poi-pickup" style="flex: 1; padding: 6px 10px; background: #000000; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Set as Pickup
          </button>
          <button id="osm-poi-drop" style="flex: 1; padding: 6px 10px; background: #059669; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Set as Drop
          </button>
        </div>
        <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank" rel="noreferrer" style="display: block; font-size: 10px; color: #475569; margin-top: 8px; text-decoration: underline; text-align: center;">
          Open in OpenStreetMap
        </a>
      `;

      popupContent.querySelector('#osm-poi-pickup')?.addEventListener('click', () => {
        if (onSelectLocation) {
          onSelectLocation({ _id: loc._id, name: loc.name, lat, lng }, 'pickup');
        }
        marker.closePopup();
      });

      popupContent.querySelector('#osm-poi-drop')?.addEventListener('click', () => {
        if (onSelectLocation) {
          onSelectLocation({ _id: loc._id, name: loc.name, lat, lng }, 'drop');
        }
        marker.closePopup();
      });

      marker.bindPopup(popupContent);
      marker.addTo(group);
    });
  }, [adminLocations, onSelectLocation]);

  // ─── 3. UPDATE SELECTED PICKUP & DROP LOCATIONS ON OPENSTREETMAP ───
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const pLat = pickupLocation?.lat ?? pickupCoords?.lat;
    const pLng = pickupLocation?.lng ?? pickupCoords?.lng;
    const pName = pickupLocation?.name || 'Selected Pickup Point';

    const dLat = dropLocation?.lat ?? dropCoords?.lat;
    const dLng = dropLocation?.lng ?? dropCoords?.lng;
    const dName = dropLocation?.name || 'Selected Destination';

    // ─── Pickup Marker on OpenStreetMap ───
    if (pLat && pLng) {
      const pickupIcon = L.divIcon({
        className: 'osm-pickup-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35));">
            <div style="background: #000000; color: #ffffff; font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 999px; margin-bottom: 2px; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
              PICKUP
            </div>
            <div style="width: 20px; height: 20px; background: #000000; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 2px #000000;"></div>
          </div>
        `,
        iconSize: [60, 44],
        iconAnchor: [30, 40],
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 4px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; letter-spacing: 0.05em;">
            Selected Pickup on OpenStreetMap
          </div>
          <div style="font-weight: 700; font-size: 14px; color: #0F172A; margin-top: 2px;">
            ${pName}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
            GPS: ${pLat.toFixed(4)}° N, ${pLng.toFixed(4)}° E
          </div>
          <a href="https://www.openstreetmap.org/?mlat=${pLat}&mlon=${pLng}#map=16/${pLat}/${pLng}" target="_blank" rel="noreferrer" style="display: inline-block; font-size: 11px; color: #2563EB; margin-top: 6px; text-decoration: underline;">
            Inspect on OpenStreetMap.org ↗
          </a>
        </div>
      `;

      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pLat, pLng], { icon: pickupIcon })
          .bindPopup(popupHtml)
          .addTo(map);
      } else {
        pickupMarkerRef.current.setLatLng([pLat, pLng]);
        pickupMarkerRef.current.setPopupContent(popupHtml);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // ─── Drop Marker on OpenStreetMap ───
    if (dLat && dLng) {
      const dropIcon = L.divIcon({
        className: 'osm-drop-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35));">
            <div style="background: #DC2626; color: #ffffff; font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 999px; margin-bottom: 2px; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%; display: inline-block;"></span>
              DESTINATION
            </div>
            <div style="width: 18px; height: 18px; background: #DC2626; border: 3px solid #ffffff; border-radius: 4px; box-shadow: 0 0 0 2px #DC2626;"></div>
          </div>
        `,
        iconSize: [70, 44],
        iconAnchor: [35, 40],
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 4px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #DC2626; letter-spacing: 0.05em;">
            Selected Destination on OpenStreetMap
          </div>
          <div style="font-weight: 700; font-size: 14px; color: #0F172A; margin-top: 2px;">
            ${dName}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
            GPS: ${dLat.toFixed(4)}° N, ${dLng.toFixed(4)}° E
          </div>
          <a href="https://www.openstreetmap.org/?mlat=${dLat}&mlon=${dLng}#map=16/${dLat}/${dLng}" target="_blank" rel="noreferrer" style="display: inline-block; font-size: 11px; color: #2563EB; margin-top: 6px; text-decoration: underline;">
            Inspect on OpenStreetMap.org ↗
          </a>
        </div>
      `;

      if (!dropMarkerRef.current) {
        dropMarkerRef.current = L.marker([dLat, dLng], { icon: dropIcon })
          .bindPopup(popupHtml)
          .addTo(map);
      } else {
        dropMarkerRef.current.setLatLng([dLat, dLng]);
        dropMarkerRef.current.setPopupContent(popupHtml);
      }
    } else if (dropMarkerRef.current) {
      map.removeLayer(dropMarkerRef.current);
      dropMarkerRef.current = null;
    }

    // ─── Driving Route on OpenStreetMap (via OSRM) ───
    if (pLat && pLng && dLat && dLng) {
      // Fetch accurate OSRM road coordinates
      api
        .get<{
          success: boolean;
          data?: {
            distanceKm?: number;
            durationMinutes?: number;
            coordinates?: [number, number][];
          };
        }>(`/map/route?fromLat=${pLat}&fromLng=${pLng}&toLat=${dLat}&toLng=${dLng}`)
        .then(res => {
          if (!mapInstanceRef.current) return;
          const roadPoints = res.data?.coordinates;
          if (res.data?.distanceKm && res.data?.durationMinutes) {
            setRouteInfo({
              distanceKm: res.data.distanceKm,
              durationMinutes: res.data.durationMinutes,
            });
          }

          let latlngs: [number, number][];
          if (roadPoints && roadPoints.length > 2) {
            latlngs = roadPoints;
          } else {
            // Smooth curve fallback
            const midLat = (pLat + dLat) / 2 + 0.005;
            const midLng = (pLng + dLng) / 2 + 0.008;
            latlngs = [
              [pLat, pLng],
              [midLat, midLng],
              [dLat, dLng],
            ];
          }

          if (!routePolylineRef.current) {
            routePolylineRef.current = L.polyline(latlngs, {
              color: '#0F172A',
              weight: 5,
              opacity: 0.9,
              lineJoin: 'round',
            }).addTo(mapInstanceRef.current);
          } else {
            routePolylineRef.current.setLatLngs(latlngs);
          }

          // Auto-fit bounds
          mapInstanceRef.current.fitBounds(L.latLngBounds(latlngs), {
            paddingTopLeft: [50, 50],
            paddingBottomRight: [50, 260],
            maxZoom: 15,
          });
        })
        .catch(() => {
          // Haversine fallback
          const latlngs: [number, number][] = [
            [pLat, pLng],
            [dLat, dLng],
          ];
          if (!routePolylineRef.current) {
            routePolylineRef.current = L.polyline(latlngs, {
              color: '#0F172A',
              weight: 5,
              opacity: 0.9,
            }).addTo(map);
          } else {
            routePolylineRef.current.setLatLngs(latlngs);
          }
          map.fitBounds(L.latLngBounds(latlngs), {
            paddingTopLeft: [50, 50],
            paddingBottomRight: [50, 260],
          });
        });
    } else {
      setRouteInfo(null);
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }

      // If only one location selected, smoothly fly to it
      if (pLat && pLng) {
        map.setView([pLat, pLng], 14, { animate: true });
      } else if (dLat && dLng) {
        map.setView([dLat, dLng], 14, { animate: true });
      }
    }
  }, [
    pickupCoords?.lat,
    pickupCoords?.lng,
    pickupLocation?.lat,
    pickupLocation?.lng,
    pickupLocation?.name,
    dropCoords?.lat,
    dropCoords?.lng,
    dropLocation?.lat,
    dropLocation?.lng,
    dropLocation?.name,
  ]);

  const handleLocateMe = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          mapInstanceRef.current?.setView([lat, lng], 15, { animate: true });
          if (onSelectCoords) {
            onSelectCoords({ lat, lng });
          }
        },
        () => {
          // If denied, fallback to Kollur temple
          mapInstanceRef.current?.setView(defaultCenter, 14, { animate: true });
        }
      );
    }
  };

  const handleZoomToPickup = () => {
    const pLat = pickupLocation?.lat ?? pickupCoords?.lat;
    const pLng = pickupLocation?.lng ?? pickupCoords?.lng;
    if (pLat && pLng && mapInstanceRef.current) {
      mapInstanceRef.current.setView([pLat, pLng], 16, { animate: true });
      pickupMarkerRef.current?.openPopup();
    }
  };

  const handleZoomToDrop = () => {
    const dLat = dropLocation?.lat ?? dropCoords?.lat;
    const dLng = dropLocation?.lng ?? dropCoords?.lng;
    if (dLat && dLng && mapInstanceRef.current) {
      mapInstanceRef.current.setView([dLat, dLng], 16, { animate: true });
      dropMarkerRef.current?.openPopup();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Leaflet map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* ─── TOP LEFT: OPENSTREETMAP BRANDING BADGE ─── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 shadow-lg text-[11px] font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>OpenStreetMap (OSM)</span>
          <span className="text-[10px] text-slate-400 font-normal border-l border-slate-700 pl-2">
            No Google Maps Required
          </span>
        </div>

        {routeInfo && (
          <div className="bg-white/95 text-neutral-900 backdrop-blur-md px-3 py-1 rounded-xl border border-neutral-200 shadow-md text-xs font-mono font-bold flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-emerald-600" />
            <span>{routeInfo.distanceKm} km</span>
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-600 font-sans font-medium text-[11px]">
              ~{routeInfo.durationMinutes} mins drive
            </span>
          </div>
        )}
      </div>

      {/* ─── TOP RIGHT: LAYER SWITCHER & ACTIONS ─── */}
      <div className="absolute top-4 right-14 z-20 flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayerMenuOpen(!layerMenuOpen)}
            className="h-9 px-3 bg-white/95 hover:bg-white text-neutral-800 rounded-xl shadow-md border border-neutral-200 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            title="Choose OpenStreetMap Tile Style"
          >
            <Layers className="w-3.5 h-3.5 text-neutral-600" />
            <span className="hidden sm:inline">OSM Layers</span>
          </button>

          {layerMenuOpen && (
            <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-2 w-52 space-y-1 animate-scale-up z-30">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                OpenStreetMap Styles
              </div>
              {(Object.keys(OSM_TILE_LAYERS) as Array<keyof typeof OSM_TILE_LAYERS>).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTileLayer(key)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    activeLayer === key
                      ? 'bg-neutral-900 text-white font-bold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{OSM_TILE_LAYERS[key].name}</span>
                  {activeLayer === key && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── BOTTOM RIGHT: MAP NAVIGATION TOOLS ─── */}
      <div className="absolute bottom-6 right-5 z-20 flex flex-col gap-2">
        {/* Zoom to Destination button */}
        {(dropLocation || dropCoords) && (
          <button
            type="button"
            onClick={handleZoomToDrop}
            className="w-10 h-10 bg-white hover:bg-neutral-50 text-rose-600 rounded-full shadow-lg flex items-center justify-center border border-neutral-200 active:scale-95 transition-all"
            title="Focus on Destination"
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}

        {/* Zoom to Pickup button */}
        {(pickupLocation || pickupCoords) && (
          <button
            type="button"
            onClick={handleZoomToPickup}
            className="w-10 h-10 bg-white hover:bg-neutral-50 text-neutral-900 rounded-full shadow-lg flex items-center justify-center border border-neutral-200 active:scale-95 transition-all"
            title="Focus on Pickup"
          >
            <MapPin className="w-4 h-4 text-emerald-600" />
          </button>
        )}

        {/* GPS Locate Me Floating Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          className="w-11 h-11 bg-white hover:bg-neutral-50 text-neutral-900 rounded-full shadow-xl flex items-center justify-center border border-neutral-200 active:scale-95 transition-all"
          title="Locate me (GPS)"
        >
          <Crosshair className="w-5 h-5 text-neutral-800" />
        </button>
      </div>

      {/* ─── BOTTOM LEFT: INTERACTION HINT ─── */}
      <div className="absolute bottom-3 left-4 z-20 hidden md:flex items-center gap-2 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-lg border border-neutral-200 text-[10px] text-neutral-600 shadow-xs pointer-events-none">
        <span>💡 Click anywhere on map to select a point on OpenStreetMap</span>
      </div>
    </div>
  );
}
