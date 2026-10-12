import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Crosshair } from 'lucide-react';

interface Coords {
  lat: number;
  lng: number;
}

interface UberMapProps {
  pickupCoords?: Coords | null;
  dropCoords?: Coords | null;
  onSelectCoords?: (coords: Coords) => void;
  className?: string;
}

// Simulated active taxis around Kollur / Byndoor area
const SAMPLE_TAXIS = [
  { id: 't1', lat: 13.8665, lng: 74.8118, type: 'sedan', angle: 45 },
  { id: 't2', lat: 13.8631, lng: 74.8152, type: 'suv', angle: 120 },
  { id: 't3', lat: 13.8698, lng: 74.8142, type: 'hatchback', angle: 270 },
  { id: 't4', lat: 13.8741, lng: 74.6369, type: 'auto', angle: 90 }, // Byndoor Railway Station
];

export function UberMap({
  pickupCoords,
  dropCoords,
  onSelectCoords,
  className = 'h-full w-full',
}: UberMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const taxiMarkersRef = useRef<L.Marker[]>([]);

  // Default center: Kollur Temple
  const defaultCenter: [number, number] = [13.8647, 74.8135];

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Clean modern map tiles (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Zoom controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    // Add Simulated Nearby Taxis with custom isometric vehicle markers
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

      const marker = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon }).addTo(map);
      taxiMarkersRef.current.push(marker);
    });

    // Optional click to set location
    map.on('click', e => {
      if (onSelectCoords) {
        onSelectCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    // Invalidate size on resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Pickup & Destination Markers and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Pickup Marker
    if (pickupCoords) {
      const pickupIcon = L.divIcon({
        className: 'uber-pickup-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));">
            <div style="background: #000000; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 999px; margin-bottom: 2px; white-space: nowrap;">
              PICKUP
            </div>
            <div style="width: 18px; height: 18px; background: #000000; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 2px #000000;"></div>
          </div>
        `,
        iconSize: [50, 40],
        iconAnchor: [25, 36],
      });

      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lng], {
          icon: pickupIcon,
        }).addTo(map);
      } else {
        pickupMarkerRef.current.setLatLng([pickupCoords.lat, pickupCoords.lng]);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // 2. Destination Marker
    if (dropCoords) {
      const dropIcon = L.divIcon({
        className: 'uber-drop-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));">
            <div style="background: #000000; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 999px; margin-bottom: 2px; white-space: nowrap;">
              DROP
            </div>
            <div style="width: 16px; height: 16px; background: #000000; border: 3px solid #ffffff; border-radius: 3px; box-shadow: 0 0 0 2px #000000;"></div>
          </div>
        `,
        iconSize: [50, 40],
        iconAnchor: [25, 36],
      });

      if (!dropMarkerRef.current) {
        dropMarkerRef.current = L.marker([dropCoords.lat, dropCoords.lng], {
          icon: dropIcon,
        }).addTo(map);
      } else {
        dropMarkerRef.current.setLatLng([dropCoords.lat, dropCoords.lng]);
      }
    } else if (dropMarkerRef.current) {
      map.removeLayer(dropMarkerRef.current);
      dropMarkerRef.current = null;
    }

    // 3. Route Polyline
    if (pickupCoords && dropCoords) {
      // Create a smooth curved route via intermediate points
      const midLat = (pickupCoords.lat + dropCoords.lat) / 2 + 0.005;
      const midLng = (pickupCoords.lng + dropCoords.lng) / 2 + 0.008;

      const latlngs: [number, number][] = [
        [pickupCoords.lat, pickupCoords.lng],
        [midLat, midLng],
        [dropCoords.lat, dropCoords.lng],
      ];

      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(latlngs, {
          color: '#000000',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(latlngs);
      }

      // Auto fit map bounds with comfortable padding for bottom sheet
      map.fitBounds(L.latLngBounds(latlngs), {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, 280],
        maxZoom: 15,
      });
    } else if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;

      if (pickupCoords) {
        map.setView([pickupCoords.lat, pickupCoords.lng], 14, { animate: true });
      }
    }
  }, [pickupCoords, dropCoords]);

  const handleLocateMe = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(pos => {
        mapInstanceRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15, {
          animate: true,
        });
      });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Locate Me Floating Action Button */}
      <button
        type="button"
        onClick={handleLocateMe}
        className="absolute bottom-6 right-5 z-20 w-11 h-11 bg-white hover:bg-neutral-100 text-black rounded-full shadow-xl flex items-center justify-center border border-neutral-200 active:scale-95 transition-all"
        title="Locate me"
      >
        <Crosshair className="w-5 h-5 text-neutral-800" />
      </button>
    </div>
  );
}
