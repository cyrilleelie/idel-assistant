/**
 * Geocoding via Google Maps Geocoding API.
 * Results are cached in-memory to avoid duplicate requests.
 * Uses the same Loader instance as the map component.
 */
import { Loader } from '@googlemaps/js-api-loader';

const cache = new Map();

let geocoderInstance = null;

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  version: 'weekly',
});

async function getGeocoder() {
  if (geocoderInstance) return geocoderInstance;
  const { Geocoder } = await loader.importLibrary('geocoding');
  geocoderInstance = new Geocoder();
  return geocoderInstance;
}

/**
 * Geocode an address string to [lat, lon] or null.
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;

  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const geocoder = await getGeocoder();
    const { results } = await geocoder.geocode({
      address: address.trim(),
      region: 'fr',
    });
    if (results && results.length > 0) {
      const loc = results[0].geometry.location;
      const coords = [loc.lat(), loc.lng()];
      cache.set(key, coords);
      return coords;
    }
    cache.set(key, null);
    return null;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/**
 * Geocode multiple addresses in sequence.
 * @param {Array<{id: string, address: string}>} items
 * @returns {Promise<Map<string, [number, number]>>} id -> [lat, lon]
 */
export async function geocodeBatch(items) {
  const results = new Map();
  for (const { id, address } of items) {
    const coords = await geocodeAddress(address);
    if (coords) results.set(id, coords);
  }
  return results;
}

/**
 * Compute travel times between origins and destinations via Distance Matrix API.
 * @param {Array<{lat: number, lng: number}>} origins
 * @param {Array<{lat: number, lng: number}>} destinations
 * @returns {Promise<Array<Array<number|null>>>} rows[i][j] = duration in seconds (or null)
 */
export async function getDistanceMatrix(origins, destinations) {
  try {
    const { DistanceMatrixService } = await loader.importLibrary('routes');
    const service = new DistanceMatrixService();
    const response = await service.getDistanceMatrix({
      origins,
      destinations,
      travelMode: 'DRIVING',
    });
    return response.rows.map(row =>
      row.elements.map(el => el.status === 'OK' ? el.duration.value : null)
    );
  } catch {
    return origins.map(() => destinations.map(() => null));
  }
}

/** Expose the loader so the map component can reuse it. */
export { loader };
