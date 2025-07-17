import * as Location from 'expo-location';
import { usePermissionsStore } from '@/lib/permissionsStore';
import React, { useState } from 'react';
import PermissionPrompt from '@/components/PermissionPrompt';

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
   * Now checks app permission store before requesting system permission.
   */
  static async getCurrentLocationWithPrompt(showPrompt: (show: boolean) => void): Promise<LocationContext | null> {
    const perm = usePermissionsStore.getState().permissions.location;
    if (perm !== 'granted') {
      showPrompt(true);
      return null;
    }
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
}

// Usage in UI:
// const [showLocationPrompt, setShowLocationPrompt] = useState(false);
// <PermissionPrompt
//   visible={showLocationPrompt}
//   onClose={() => setShowLocationPrompt(false)}
//   permission="location"
//   title="Location Permission Required"
//   description="Allow access to your location for context-aware features like smart reminders and suggestions."
//   onGrant={() => usePermissionsStore.getState().setPermission('location', 'granted')}
//   onDeny={() => usePermissionsStore.getState().setPermission('location', 'denied')}
// /> 