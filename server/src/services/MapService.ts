import axios, { AxiosInstance } from 'axios';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline?: string; // Encoded polyline for map rendering
}

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface PlaceResult {
  displayName: string;
  latitude: number;
  longitude: number;
  type?: string;
}

/**
 * MapService — provider abstraction for all geo operations.
 * Currently implements Nominatim (geocoding) + OSRM (routing).
 * Replace implementations here to switch providers without touching other code.
 */
export class MapService {
  private nominatimClient: AxiosInstance;
  private osrmClient: AxiosInstance;

  constructor() {
    this.nominatimClient = axios.create({
      baseURL: config.GEOCODING_BASE_URL,
      headers: {
        'User-Agent': config.GEOCODING_USER_AGENT,
        'Accept-Language': 'en',
      },
      timeout: 10000,
    });

    this.osrmClient = axios.create({
      baseURL: config.ROUTING_BASE_URL,
      timeout: 15000,
    });
  }

  // ─── GEOCODING ───────────────────────────────────────────────

  async geocode(address: string): Promise<GeocodingResult | null> {
    try {
      const response = await this.nominatimClient.get('/search', {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'in',
          addressdetails: 1,
        },
      });

      if (!response.data?.length) return null;
      const result = response.data[0];

      return {
        displayName: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        country: result.address?.country,
        pincode: result.address?.postcode,
      };
    } catch (error) {
      logger.error('Geocoding failed:', error);
      return null;
    }
  }

  // ─── REVERSE GEOCODING ───────────────────────────────────────

  async reverseGeocode(coords: Coordinates): Promise<GeocodingResult | null> {
    try {
      const response = await this.nominatimClient.get('/reverse', {
        params: {
          lat: coords.latitude,
          lon: coords.longitude,
          format: 'json',
          addressdetails: 1,
        },
      });

      if (!response.data?.display_name) return null;
      const result = response.data;

      return {
        displayName: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        country: result.address?.country,
        pincode: result.address?.postcode,
      };
    } catch (error) {
      logger.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  // ─── ROUTING ─────────────────────────────────────────────────

  async route(from: Coordinates, to: Coordinates): Promise<RouteResult | null> {
    try {
      const url = `/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;

      const response = await this.osrmClient.get(url, {
        params: {
          overview: 'simplified',
          geometries: 'polyline',
          steps: false,
        },
      });

      if (response.data?.code !== 'Ok' || !response.data?.routes?.length) {
        logger.warn('OSRM returned no route:', response.data?.code);
        return null;
      }

      const route = response.data.routes[0];
      return {
        distanceKm: Math.round((route.distance / 1000) * 100) / 100,
        durationMinutes: Math.ceil(route.duration / 60),
        polyline: route.geometry,
      };
    } catch (error) {
      logger.error('Routing failed:', error);
      return null;
    }
  }

  // ─── DISTANCE ONLY ───────────────────────────────────────────

  async calculateDistance(from: Coordinates, to: Coordinates): Promise<number> {
    const route = await this.route(from, to);
    if (route) return route.distanceKm;

    // Fallback to straight-line (haversine) if OSRM fails
    logger.warn('OSRM unavailable, using haversine distance');
    return this.haversineDistance(from, to);
  }

  // ─── PLACE SEARCH ────────────────────────────────────────────

  async searchPlaces(query: string, near?: Coordinates): Promise<PlaceResult[]> {
    try {
      const params: Record<string, unknown> = {
        q: query,
        format: 'json',
        limit: 10,
        countrycodes: 'in',
      };

      if (near) {
        // Bias results toward nearby coordinates
        const radius = 0.5; // ~50km bias box
        params.viewbox = `${near.longitude - radius},${near.latitude + radius},${near.longitude + radius},${near.latitude - radius}`;
        params.bounded = 0;
      }

      const response = await this.nominatimClient.get('/search', { params });

      return (response.data || []).map((item: Record<string, unknown>) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat as string),
        longitude: parseFloat(item.lon as string),
        type: item.type,
      }));
    } catch (error) {
      logger.error('Place search failed:', error);
      return [];
    }
  }

  // ─── STRAIGHT-LINE DISTANCE (fallback) ──────────────────────

  haversineDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371; // km
    const dLat = this.toRad(to.latitude - from.latitude);
    const dLon = this.toRad(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(from.latitude)) *
        Math.cos(this.toRad(to.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}

export const mapService = new MapService();
