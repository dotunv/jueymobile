import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Save, User, Mail, Edit3 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileModal({ visible, onClose }: ProfileModalProps) {
  const { theme } = useTheme();
  const { profile, updateProfile } = useAuth();
  
  const [username, setUsername] = useState(profile?.username || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    try {
      setSaving(true);
      const { error } = await updateProfile({
        username: username.trim(),
        full_name: fullName.trim() || null,
      });

      if (error) {
        Alert.alert('Error', 'Failed to update profile');
      } else {
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: onClose }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setUsername(profile?.username || '');
    setFullName(profile?.full_name || '');
    setEmail(profile?.email || '');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Edit Profile
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, { opacity: saving ? 0.5 : 1 }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Save size={24} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Personal Information
            </Text>
            
            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.inputHeader}>
                <User size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Username
                </Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.inputHeader}>
                <Edit3 size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Full Name
                </Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.inputHeader}>
                <Mail size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Email
                </Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.textTertiary }]}
                value={email}
                editable={false}
                placeholder="Email address"
                placeholderTextColor={theme.colors.textTertiary}
              />
              <Text style={[styles.helpText, { color: theme.colors.textTertiary }]}>
                Email cannot be changed
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Account Information
            </Text>
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                Member since
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  inputGroup: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  input: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    paddingVertical: 8,
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
}); 