import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Smartphone, Wifi, Battery, Settings, AlertTriangle, CheckCircle, Clock, Volume2, Eye, Zap } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import DeviceManagementService, { DeviceInfo, DevicePreferences, DeviceConflict } from '@/lib/services/deviceManagementService';

interface DeviceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DeviceSettingsModal({ visible, onClose }: DeviceSettingsModalProps) {
  const { theme } = useTheme();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [preferences, setPreferences] = useState<DevicePreferences | null>(null);
  const [conflicts, setConflicts] = useState<DeviceConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'sync' | 'notifications' | 'voice' | 'accessibility' | 'conflicts'>('general');

  const deviceService = DeviceManagementService.getInstance();

  useEffect(() => {
    if (visible) {
      loadDeviceData();
    }
  }, [visible]);

  const loadDeviceData = async () => {
    setLoading(true);
    try {
      const info = await deviceService.initialize();
      const prefs = deviceService.getDevicePreferences();
      const unresolvedConflicts = await deviceService.getUnresolvedConflicts();

      setDeviceInfo(info);
      setPreferences(prefs);
      setConflicts(unresolvedConflicts);
    } catch (error) {
      console.error('Failed to load device data:', error);
      Alert.alert('Error', 'Failed to load device settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    if (!preferences) return;

    const updates: Partial<DevicePreferences> = {};
    const keys = key.split('.');
    let current: any = updates;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    await deviceService.updateDevicePreferences(updates);
    setPreferences(deviceService.getDevicePreferences());
  };

  const resolveConflict = async (conflict: DeviceConflict, resolution: 'local' | 'remote' | 'merge') => {
    try {
      await deviceService.resolveConflict(conflict.id, resolution);
      const updatedConflicts = await deviceService.getUnresolvedConflicts();
      setConflicts(updatedConflicts);
      Alert.alert('Success', 'Conflict resolved successfully');
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      Alert.alert('Error', 'Failed to resolve conflict');
    }
  };

  const getConnectionIcon = () => {
    if (!deviceInfo) return <Wifi size={16} color={theme.colors.text} />;
    
    switch (deviceInfo.connectionType) {
      case 'wifi': return <Wifi size={16} color={theme.colors.primary} />;
      case 'cellular': return <Wifi size={16} color={theme.colors.warning} />;
      case 'ethernet': return <Wifi size={16} color={theme.colors.success} />;
      default: return <Wifi size={16} color={theme.colors.muted} />;
    }
  };

  const getBatteryIcon = () => {
    if (!deviceInfo?.batteryLevel) return <Battery size={16} color={theme.colors.text} />;
    
    if (deviceInfo.batteryLevel > 0.5) {
      return <Battery size={16} color={theme.colors.success} />;
    } else if (deviceInfo.batteryLevel > 0.2) {
      return <Battery size={16} color={theme.colors.warning} />;
    } else {
      return <Battery size={16} color={theme.colors.error} />;
    }
  };

  const renderGeneralTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Device Information</Text>
        
        {deviceInfo && (
          <View style={styles.deviceInfo}>
            <View style={styles.infoRow}>
              <Smartphone size={16} color={theme.colors.text} />
              <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Device:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{deviceInfo.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Platform:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{deviceInfo.platform}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Screen:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {deviceInfo.screenSize.width} × {deviceInfo.screenSize.height}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              {getConnectionIcon()}
              <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Connection:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {deviceInfo.isOnline ? 'Online' : 'Offline'} ({deviceInfo.connectionType || 'unknown'})
              </Text>
            </View>
            
            {deviceInfo.batteryLevel !== undefined && (
              <View style={styles.infoRow}>
                {getBatteryIcon()}
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Battery:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {Math.round(deviceInfo.batteryLevel * 100)}%
                  {deviceInfo.isCharging ? ' (Charging)' : ''}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Theme</Text>
          <View style={styles.optionGroup}>
            {(['light', 'dark', 'auto'] as const).map((themeOption) => (
              <TouchableOpacity
                key={themeOption}
                style={[
                  styles.optionButton,
                  preferences?.theme === themeOption && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => updatePreference('theme', themeOption)}
              >
                <Text style={[
                  styles.optionText,
                  { color: preferences?.theme === themeOption ? theme.colors.white : theme.colors.text }
                ]}>
                  {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>UI Scale</Text>
          <View style={styles.optionGroup}>
            {(['small', 'medium', 'large'] as const).map((scale) => (
              <TouchableOpacity
                key={scale}
                style={[
                  styles.optionButton,
                  preferences?.uiScale === scale && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => updatePreference('uiScale', scale)}
              >
                <Text style={[
                  styles.optionText,
                  { color: preferences?.uiScale === scale ? theme.colors.white : theme.colors.text }
                ]}>
                  {scale.charAt(0).toUpperCase() + scale.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderSyncTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sync Settings</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Auto Sync</Text>
          <Switch
            value={preferences?.sync.autoSync || false}
            onValueChange={(value) => updatePreference('sync.autoSync', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Sync Interval</Text>
          <View style={styles.optionGroup}>
            {[1, 5, 15, 30].map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.optionButton,
                  preferences?.sync.syncInterval === minutes && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => updatePreference('sync.syncInterval', minutes)}
              >
                <Text style={[
                  styles.optionText,
                  { color: preferences?.sync.syncInterval === minutes ? theme.colors.white : theme.colors.text }
                ]}>
                  {minutes}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>WiFi Only</Text>
          <Switch
            value={preferences?.sync.syncOnWifiOnly || false}
            onValueChange={(value) => updatePreference('sync.syncOnWifiOnly', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Media Quality</Text>
          <View style={styles.optionGroup}>
            {(['low', 'medium', 'high'] as const).map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.optionButton,
                  preferences?.sync.syncMediaQuality === quality && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => updatePreference('sync.syncMediaQuality', quality)}
              >
                <Text style={[
                  styles.optionText,
                  { color: preferences?.sync.syncMediaQuality === quality ? theme.colors.white : theme.colors.text }
                ]}>
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Background Sync</Text>
          <Switch
            value={preferences?.sync.backgroundSync || false}
            onValueChange={(value) => updatePreference('sync.backgroundSync', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
      </View>
    </View>
  );

  const renderNotificationsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notification Settings</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Enable Notifications</Text>
          <Switch
            value={preferences?.notifications.enabled || false}
            onValueChange={(value) => updatePreference('notifications.enabled', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Sound</Text>
          <Switch
            value={preferences?.notifications.sound || false}
            onValueChange={(value) => updatePreference('notifications.sound', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Vibration</Text>
          <Switch
            value={preferences?.notifications.vibration || false}
            onValueChange={(value) => updatePreference('notifications.vibration', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Quiet Hours</Text>
          <Switch
            value={preferences?.notifications.quietHours.enabled || false}
            onValueChange={(value) => updatePreference('notifications.quietHours.enabled', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        {preferences?.notifications.quietHours.enabled && (
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.timeInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
              value={preferences.notifications.quietHours.start}
              onChangeText={(value) => updatePreference('notifications.quietHours.start', value)}
              placeholder="22:00"
              placeholderTextColor={theme.colors.muted}
            />
            <Text style={[styles.timeLabel, { color: theme.colors.text }]}>to</Text>
            <TextInput
              style={[styles.timeInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
              value={preferences.notifications.quietHours.end}
              onChangeText={(value) => updatePreference('notifications.quietHours.end', value)}
              placeholder="08:00"
              placeholderTextColor={theme.colors.muted}
            />
          </View>
        )}
      </View>
    </View>
  );

  const renderVoiceTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Voice Settings</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Enable Voice Input</Text>
          <Switch
            value={preferences?.voice.enabled || false}
            onValueChange={(value) => updatePreference('voice.enabled', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Language</Text>
          <View style={styles.optionGroup}>
            {(['en', 'es', 'fr', 'de'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.optionButton,
                  preferences?.voice.language === lang && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => updatePreference('voice.language', lang)}
              >
                <Text style={[
                  styles.optionText,
                  { color: preferences?.voice.language === lang ? theme.colors.white : theme.colors.text }
                ]}>
                  {lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Speed</Text>
          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderValue, { color: theme.colors.text }]}>
              {preferences?.voice.speed || 1.0}x
            </Text>
            <View style={[styles.slider, { backgroundColor: theme.colors.border }]}>
              <View 
                style={[
                  styles.sliderFill, 
                  { 
                    backgroundColor: theme.colors.primary,
                    width: `${((preferences?.voice.speed || 1.0) - 0.5) / 1.5 * 100}%`
                  }
                ]} 
              />
            </View>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Volume</Text>
          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderValue, { color: theme.colors.text }]}>
              {Math.round((preferences?.voice.volume || 0.8) * 100)}%
            </Text>
            <View style={[styles.slider, { backgroundColor: theme.colors.border }]}>
              <View 
                style={[
                  styles.sliderFill, 
                  { 
                    backgroundColor: theme.colors.primary,
                    width: `${(preferences?.voice.volume || 0.8) * 100}%`
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAccessibilityTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Accessibility</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Large Text</Text>
          <Switch
            value={preferences?.accessibility.largeText || false}
            onValueChange={(value) => updatePreference('accessibility.largeText', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>High Contrast</Text>
          <Switch
            value={preferences?.accessibility.highContrast || false}
            onValueChange={(value) => updatePreference('accessibility.highContrast', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Reduce Motion</Text>
          <Switch
            value={preferences?.accessibility.reduceMotion || false}
            onValueChange={(value) => updatePreference('accessibility.reduceMotion', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Screen Reader</Text>
          <Switch
            value={preferences?.accessibility.screenReader || false}
            onValueChange={(value) => updatePreference('accessibility.screenReader', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
      </View>
    </View>
  );

  const renderConflictsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Device Conflicts</Text>
        
        {conflicts.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color={theme.colors.success} />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No conflicts found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.muted }]}>
              All your devices are in sync
            </Text>
          </View>
        ) : (
          conflicts.map((conflict) => (
            <View key={conflict.id} style={[styles.conflictItem, { borderColor: theme.colors.border }]}>
              <View style={styles.conflictHeader}>
                <AlertTriangle size={16} color={theme.colors.warning} />
                <Text style={[styles.conflictTitle, { color: theme.colors.text }]}>
                  {conflict.entityType} Conflict
                </Text>
                <Text style={[styles.conflictTime, { color: theme.colors.muted }]}>
                  {new Date(conflict.timestamp).toLocaleString()}
                </Text>
              </View>
              
              <Text style={[styles.conflictDescription, { color: theme.colors.text }]}>
                {conflict.conflictFields.join(', ')} fields have conflicting values
              </Text>
              
              <View style={styles.conflictActions}>
                <TouchableOpacity
                  style={[styles.conflictButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => resolveConflict(conflict, 'local')}
                >
                  <Text style={[styles.conflictButtonText, { color: theme.colors.white }]}>
                    Keep Local
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.conflictButton, { backgroundColor: theme.colors.secondary }]}
                  onPress={() => resolveConflict(conflict, 'remote')}
                >
                  <Text style={[styles.conflictButtonText, { color: theme.colors.white }]}>
                    Use Remote
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.conflictButton, { backgroundColor: theme.colors.success }]}
                  onPress={() => resolveConflict(conflict, 'merge')}
                >
                  <Text style={[styles.conflictButtonText, { color: theme.colors.white }]}>
                    Merge
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const tabs = [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'sync', label: 'Sync', icon: Zap },
    { key: 'notifications', label: 'Notifications', icon: Clock },
    { key: 'voice', label: 'Voice', icon: Volume2 },
    { key: 'accessibility', label: 'Accessibility', icon: Eye },
    { key: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Device Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && { borderBottomColor: theme.colors.primary }
                ]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Icon size={16} color={activeTab === tab.key ? theme.colors.primary : theme.colors.muted} />
                <Text style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? theme.colors.primary : theme.colors.muted }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'general' && renderGeneralTab()}
              {activeTab === 'sync' && renderSyncTab()}
              {activeTab === 'notifications' && renderNotificationsTab()}
              {activeTab === 'voice' && renderVoiceTab()}
              {activeTab === 'accessibility' && renderAccessibilityTab()}
              {activeTab === 'conflicts' && renderConflictsTab()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    gap: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  deviceInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minWidth: 80,
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
  },
  slider: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  conflictItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conflictTime: {
    fontSize: 12,
  },
  conflictDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
  },
  conflictButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  conflictButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
  },
}); 