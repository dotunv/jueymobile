import * as Location from 'expo-location';

export interface LocationContext {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  accuracy?: number;
}

export class LocationService {
  /**
   * Requests location permissions and retrieves the current device location.
   * Returns null if permission denied or error occurs.
   */
  static async getCurrentLocation(): Promise<LocationContext | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address, placeName;
      try {
        const [reverse] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        address = reverse?.street ? `${reverse.street}, ${reverse.city}` : undefined;
        placeName = reverse?.name;
      } catch {}
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address,
        placeName,
        accuracy: loc.coords.accuracy,
      };
    } catch (e) {
      console.error('LocationService error:', e);
      return null;
    }
  }

  // Future: Add privacy toggles, battery optimization, and background location support
} 