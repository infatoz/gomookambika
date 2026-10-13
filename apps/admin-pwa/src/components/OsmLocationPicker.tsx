import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface OsmLocationPickerProps {
  latitude: number | string;
  longitude: number | string;
  onChangeCoords?: (lat: number, lng: number) => void;
  radiusMeters?: number;
  height?: string;
  readOnly?: boolean;
}

export function OsmLocationPicker({
  latitude,
  longitude,
  onChangeCoords,
  radiusMeters,
  height = '240px',
  readOnly = false,
}: OsmLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const numLat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const numLng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  const hasCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0;

  const defaultCenter: [number, number] = [13.8647, 74.8135]; // Kollur Sri Mookambika Temple

  // Initialize Leaflet OpenStreetMap
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const initialCenter: [number, number] = hasCoords ? [numLat, numLng] : defaultCenter;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: hasCoords ? 15 : 13,
      zoomControl: true,
      attributionControl: true,
    });

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (!readOnly && onChangeCoords) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        onChangeCoords(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
      });
    }

    mapRef.current = map;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker and circle when coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (hasCoords) {
      const pinIcon = L.divIcon({
        className: 'osm-admin-pin',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));">
            <div style="background: #4F46E5; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 999px; margin-bottom: 2px; white-space: nowrap;">
              LOCATION
            </div>
            <div style="width: 18px; height: 18px; background: #4F46E5; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 2px #4F46E5;"></div>
          </div>
        `,
        iconSize: [50, 40],
        iconAnchor: [25, 36],
      });

      if (!markerRef.current) {
        markerRef.current = L.marker([numLat, numLng], {
          icon: pinIcon,
          draggable: !readOnly,
        }).addTo(map);

        if (!readOnly && onChangeCoords) {
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current!.getLatLng();
            onChangeCoords(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
          });
        }
      } else {
        markerRef.current.setLatLng([numLat, numLng]);
      }

      markerRef.current.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #111;">
          <strong style="color: #4F46E5;">Selected on OpenStreetMap</strong><br/>
          Lat: ${numLat.toFixed(6)}<br/>
          Lng: ${numLng.toFixed(6)}
        </div>
      `);

      // Geofence radius circle if specified
      if (radiusMeters && radiusMeters > 0) {
        if (!circleRef.current) {
          circleRef.current = L.circle([numLat, numLng], {
            radius: radiusMeters,
            color: '#4F46E5',
            fillColor: '#6366F1',
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: '4, 4',
          }).addTo(map);
        } else {
          circleRef.current.setLatLng([numLat, numLng]);
          circleRef.current.setRadius(radiusMeters);
        }
      } else if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }

      map.setView([numLat, numLng], map.getZoom() || 15);
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    }
  }, [numLat, numLng, hasCoords, radiusMeters, readOnly, onChangeCoords]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: 8 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 500,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        color: '#FFFFFF',
        padding: '3px 8px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
        <span>OpenStreetMap (No Google Maps)</span>
      </div>

      {!readOnly && (
        <div style={{
          position: 'absolute',
          bottom: 6,
          left: 8,
          zIndex: 500,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '2px 7px',
          borderRadius: 6,
          fontSize: 10,
          color: '#475569',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          Click or drag marker on OpenStreetMap to pick location
        </div>
      )}
    </div>
  );
}
