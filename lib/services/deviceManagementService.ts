import { Platform, Dimensions } from 'react-native';
import { TypedStorage, STORAGE_KEYS } from '@/lib/storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import Constants from 'expo-constants';
import * as Battery from 'expo-battery';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web';
  model?: string;
  osVersion?: string;
  appVersion?: string;
  screenSize: {
    width: number;
    height: number;
  };
  lastSeen: number;
  isOnline: boolean;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'none';
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface DevicePreferences {
  deviceId: string;
  userId: string;
  uiScale: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm
      end: string; // HH:mm
    };
  };
  sync: {
    autoSync: boolean;
    syncInterval: number; // minutes
    syncOnWifiOnly: boolean;
    syncMediaQuality: 'high' | 'medium' | 'low';
    backgroundSync: boolean;
  };
  voice: {
    enabled: boolean;
    language: string;
    speed: number; // 0.5 to 2.0
    volume: number; // 0 to 1
  };
  accessibility: {
    largeText: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
  };
  lastUpdated: number;
}

export interface DeviceConflict {
  id: string;
  deviceId: string;
  userId: string;
  entityType: 'task' | 'preference' | 'reminder';
  entityId: string;
  localData: any;
  remoteData: any;
  conflictFields: string[];
  timestamp: number;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merge';
}

export class DeviceManagementService {
  private static instance: DeviceManagementService;
  private deviceInfo: DeviceInfo | null = null;
  private devicePreferences: DevicePreferences | null = null;
  private syncOptimizationEnabled = true;

  static getInstance(): DeviceManagementService {
    if (!DeviceManagementService.instance) {
      DeviceManagementService.instance = new DeviceManagementService();
    }
    return DeviceManagementService.instance;
  }

  /**
   * Initialize device management and load device info
   */
  async initialize(): Promise<DeviceInfo> {
    if (this.deviceInfo) return this.deviceInfo;

    const deviceId = await this.getOrCreateDeviceId();
    const screenSize = Dimensions.get('window');

    this.deviceInfo = {
      id: deviceId,
      name: await this.getDeviceName(),
      platform: Platform.OS as 'ios' | 'android' | 'web',
      model: Platform.OS === 'ios' ? Platform.constants.systemName : undefined,
      osVersion: Platform.Version?.toString(),
      appVersion: Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0', // Dynamically get from app.json
      screenSize,
      lastSeen: Date.now(),
      isOnline: false,
    };

    // Start monitoring device state
    this.startDeviceMonitoring();
    
    // Load device preferences
    await this.loadDevicePreferences();

    return this.deviceInfo;
  }

  /**
   * Get or create a unique device ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    const existingId = await TypedStorage.get('device_id');
    if (existingId) return existingId;

    const newId = uuidv4();
    await TypedStorage.set('device_id', newId);
    return newId;
  }

  /**
   * Get a human-readable device name
   */
  private async getDeviceName(): Promise<string> {
    const savedName = await TypedStorage.get('device_name');
    if (savedName) return savedName;

    const platform = Platform.OS;
    const deviceId = await this.getOrCreateDeviceId();
    const shortId = deviceId.slice(0, 8);
    
    let name = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Device`;
    if (platform === 'ios') {
      name = `iPhone ${shortId}`;
    } else if (platform === 'android') {
      name = `Android ${shortId}`;
    }

    await TypedStorage.set('device_name', name);
    return name;
  }

  /**
   * Start monitoring device state (network, battery, etc.)
   */
  private startDeviceMonitoring(): void {
    // Monitor network connectivity
    NetInfo.addEventListener(state => {
      if (this.deviceInfo) {
        this.deviceInfo.isOnline = state.isConnected || false;
        this.deviceInfo.connectionType = state.type;
        this.deviceInfo.lastSeen = Date.now();
      }
    });

    // Monitor battery (if available)
    if (Platform.OS !== 'web') {
      Battery.getBatteryLevelAsync().then(level => {
        if (this.deviceInfo) this.deviceInfo.batteryLevel = level;
      });
      Battery.getPowerStateAsync().then(state => {
        if (this.deviceInfo) this.deviceInfo.isCharging = state.batteryState === Battery.BatteryState.CHARGING;
      });
      Battery.addBatteryLevelListener(({ batteryLevel }) => {
        if (this.deviceInfo) this.deviceInfo.batteryLevel = batteryLevel;
      });
      Battery.addPowerStateListener(({ batteryState }) => {
        if (this.deviceInfo) this.deviceInfo.isCharging = batteryState === Battery.BatteryState.CHARGING;
      });
    }
  }

  /**
   * Load device-specific preferences
   */
  async loadDevicePreferences(): Promise<DevicePreferences> {
    const deviceId = await this.getOrCreateDeviceId();
    const userId = (await TypedStorage.get('user_id')) || 'anonymous';

    // Try to load from cloud first
    try {
      const { data, error } = await supabase
        .from('device_preferences')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', userId)
        .single();

      if (data && !error) {
        this.devicePreferences = data as DevicePreferences;
        return this.devicePreferences;
      }
    } catch (error) {
      console.log('Failed to load device preferences from cloud:', error);
    }

    // Fallback to local storage
    const localPrefs = await TypedStorage.get('device_preferences');
    if (localPrefs) {
      this.devicePreferences = localPrefs as DevicePreferences;
      return this.devicePreferences;
    }

    // Create default preferences
    this.devicePreferences = this.createDefaultPreferences(deviceId, userId);
    await this.saveDevicePreferences();
    return this.devicePreferences;
  }

  /**
   * Create default device preferences
   */
  private createDefaultPreferences(deviceId: string, userId: string): DevicePreferences {
    return {
      deviceId,
      userId,
      uiScale: 'medium',
      theme: 'auto',
      language: 'en',
      notifications: {
        enabled: true,
        sound: true,
        vibration: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      },
      sync: {
        autoSync: true,
        syncInterval: 5, // 5 minutes
        syncOnWifiOnly: false,
        syncMediaQuality: 'medium',
        backgroundSync: true,
      },
      voice: {
        enabled: true,
        language: 'en',
        speed: 1.0,
        volume: 0.8,
      },
      accessibility: {
        largeText: false,
        highContrast: false,
        reduceMotion: false,
        screenReader: false,
      },
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save device preferences (local and cloud)
   */
  async saveDevicePreferences(): Promise<void> {
    if (!this.devicePreferences) return;

    this.devicePreferences.lastUpdated = Date.now();

    // Save locally
    await TypedStorage.set('device_preferences', this.devicePreferences);

    // Save to cloud if online
    if (this.deviceInfo?.isOnline) {
      try {
        const { error } = await supabase
          .from('device_preferences')
          .upsert(this.devicePreferences, { onConflict: 'device_id,user_id' });

        if (error) {
          console.error('Failed to save device preferences to cloud:', error);
        }
      } catch (error) {
        console.error('Error saving device preferences to cloud:', error);
      }
    }
  }

  /**
   * Update device preferences
   */
  async updateDevicePreferences(updates: Partial<DevicePreferences>): Promise<void> {
    if (!this.devicePreferences) {
      await this.loadDevicePreferences();
    }

    this.devicePreferences = {
      ...this.devicePreferences!,
      ...updates,
    };

    await this.saveDevicePreferences();
  }

  /**
   * Get current device preferences
   */
  getDevicePreferences(): DevicePreferences | null {
    return this.devicePreferences;
  }

  /**
   * Get device-specific sync settings
   */
  getSyncSettings() {
    return this.devicePreferences?.sync || {
      autoSync: true,
      syncInterval: 5,
      syncOnWifiOnly: false,
      syncMediaQuality: 'medium',
      backgroundSync: true,
    };
  }

  /**
   * Check if sync should be optimized based on device conditions
   */
  shouldOptimizeSync(): boolean {
    if (!this.syncOptimizationEnabled) return false;
    if (!this.deviceInfo || !this.devicePreferences) return false;

    const syncSettings = this.devicePreferences.sync;

    // Don't sync if offline
    if (!this.deviceInfo.isOnline) return true;

    // Don't sync on cellular if wifi-only is enabled
    if (syncSettings.syncOnWifiOnly && this.deviceInfo.connectionType === 'cellular') {
      return true;
    }

    // Optimize based on battery level
    if (this.deviceInfo.batteryLevel !== undefined && this.deviceInfo.batteryLevel < 0.2) {
      return true;
    }

    return false;
  }

  /**
   * Get optimized sync interval based on device conditions
   */
  getOptimizedSyncInterval(): number {
    const baseInterval = this.devicePreferences?.sync.syncInterval || 5;
    
    if (!this.deviceInfo?.isOnline) {
      return baseInterval * 4; // 4x longer when offline
    }

    if (this.deviceInfo.connectionType === 'cellular') {
      return baseInterval * 2; // 2x longer on cellular
    }

    if (this.deviceInfo.batteryLevel !== undefined && this.deviceInfo.batteryLevel < 0.3) {
      return baseInterval * 3; // 3x longer when battery is low
    }

    return baseInterval;
  }

  /**
   * Detect and handle device conflicts
   */
  async detectDeviceConflicts(entityType: string, entityId: string, localData: any, remoteData: any): Promise<DeviceConflict | null> {
    if (!this.deviceInfo) return null;

    const conflictFields = this.findConflictFields(localData, remoteData);
    if (conflictFields.length === 0) return null;

    const conflict: DeviceConflict = {
      id: uuidv4(),
      deviceId: this.deviceInfo.id,
      userId: this.devicePreferences?.userId || 'anonymous',
      entityType: entityType as 'task' | 'preference' | 'reminder',
      entityId,
      localData,
      remoteData,
      conflictFields,
      timestamp: Date.now(),
      resolved: false,
    };

    // Save conflict to local storage
    const conflicts = await TypedStorage.get('device_conflicts') || [];
    conflicts.push(conflict);
    await TypedStorage.set('device_conflicts', conflicts);

    // Save to cloud if online
    if (this.deviceInfo.isOnline) {
      try {
        await supabase.from('device_conflicts').insert(conflict);
      } catch (error) {
        console.error('Failed to save conflict to cloud:', error);
      }
    }

    return conflict;
  }

  /**
   * Find fields that have conflicts between local and remote data
   */
  private findConflictFields(localData: any, remoteData: any): string[] {
    const conflicts: string[] = [];
    
    for (const key in localData) {
      if (localData.hasOwnProperty(key) && remoteData.hasOwnProperty(key)) {
        if (JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])) {
          conflicts.push(key);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a device conflict
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): Promise<void> {
    // Update local conflicts
    const conflicts = await TypedStorage.get('device_conflicts') || [];
    const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
    
    if (conflictIndex !== -1) {
      conflicts[conflictIndex].resolved = true;
      conflicts[conflictIndex].resolution = resolution;
      await TypedStorage.set('device_conflicts', conflicts);
    }

    // Update cloud conflicts if online
    if (this.deviceInfo?.isOnline) {
      try {
        await supabase
          .from('device_conflicts')
          .update({ resolved: true, resolution })
          .eq('id', conflictId);
      } catch (error) {
        console.error('Failed to update conflict resolution in cloud:', error);
      }
    }
  }

  /**
   * Get all unresolved conflicts for this device
   */
  async getUnresolvedConflicts(): Promise<DeviceConflict[]> {
    const conflicts = await TypedStorage.get('device_conflicts') || [];
    return conflicts.filter(c => !c.resolved);
  }

  /**
   * Get device-specific UI settings
   */
  getUISettings() {
    return {
      scale: this.devicePreferences?.uiScale || 'medium',
      theme: this.devicePreferences?.theme || 'auto',
      accessibility: this.devicePreferences?.accessibility || {
        largeText: false,
        highContrast: false,
        reduceMotion: false,
        screenReader: false,
      },
    };
  }

  /**
   * Get device-specific notification settings
   */
  getNotificationSettings() {
    return this.devicePreferences?.notifications || {
      enabled: true,
      sound: true,
      vibration: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }

  /**
   * Check if notifications should be sent based on device settings
   */
  shouldSendNotification(): boolean {
    const settings = this.getNotificationSettings();
    if (!settings.enabled) return false;

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime >= settings.quietHours.start || currentTime <= settings.quietHours.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get device information for debugging
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Update device information
   */
  async updateDeviceInfo(updates: Partial<DeviceInfo>): Promise<void> {
    if (this.deviceInfo) {
      this.deviceInfo = { ...this.deviceInfo, ...updates, lastSeen: Date.now() };
      
      // Save to cloud if online
      if (this.deviceInfo.isOnline) {
        try {
          await supabase
            .from('devices')
            .upsert({
              id: this.deviceInfo.id,
              user_id: this.devicePreferences?.userId || 'anonymous',
              name: this.deviceInfo.name,
              platform: this.deviceInfo.platform,
              model: this.deviceInfo.model,
              os_version: this.deviceInfo.osVersion,
              app_version: this.deviceInfo.appVersion,
              screen_width: this.deviceInfo.screenSize.width,
              screen_height: this.deviceInfo.screenSize.height,
              last_seen: new Date(this.deviceInfo.lastSeen).toISOString(),
              is_online: this.deviceInfo.isOnline,
              connection_type: this.deviceInfo.connectionType,
              battery_level: this.deviceInfo.batteryLevel,
              is_charging: this.deviceInfo.isCharging,
            });
        } catch (error) {
          console.error('Failed to update device info in cloud:', error);
        }
      }
    }
  }
}

export default DeviceManagementService; 