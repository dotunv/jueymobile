import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, UserPlus, User } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function SignUpScreen() {
  const { theme } = useTheme();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ 
    fullName?: string; 
    username?: string;
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    general?: string;
  }>({});

  const validateForm = () => {
    const newErrors: { 
      fullName?: string; 
      username?: string;
      email?: string; 
      password?: string; 
      confirmPassword?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const { error } = await signUp(email.trim(), password, username.trim(), fullName.trim());

      if (error) {
        setErrors({ general: error.message });
      } else {
        Alert.alert(
          'Success!',
          'Please check your email to verify your account.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
          ]
        );
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View 
            style={styles.header}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSubtitle}>Join Juey and boost your productivity</Text>
            </LinearGradient>
          </View>

          {/* Form */}
          <View
            style={styles.formContainer}
          >
            {/* General Error */}
            {errors.general && (
              <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '20' }]}> 
                <Text style={[styles.errorText, { color: theme.colors.error }]}> 
                  {errors.general}
                </Text>
              </View>
            )}

            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.fullName ? theme.colors.error : theme.colors.border,
                }
              ]}>
                <User size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              {errors.fullName && (
                <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                  {errors.fullName}
                </Text>
              )}
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Username</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.username ? theme.colors.error : theme.colors.border,
                }
              ]}>
                <User size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Choose a username"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.username && (
                <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                  {errors.username}
                </Text>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.email ? theme.colors.error : theme.colors.border,
                }
              ]}>
                <Mail size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && (
                <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                  {errors.email}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.password ? theme.colors.error : theme.colors.border,
                }
              ]}>
                <Lock size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Create a password"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Confirm Password</Text>
              <View style={[
                styles.inputContainer,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.confirmPassword ? theme.colors.error : theme.colors.border,
                }
              ]}>
                <Lock size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                  {errors.confirmPassword}
                </Text>
              )}
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              onPress={handleSignUp}
              disabled={loading}
              style={[
                styles.signUpButton,
                {
                  backgroundColor: loading ? theme.colors.textTertiary : theme.colors.primary,
                }
              ]}
            >
              <UserPlus size={20} color="white" strokeWidth={2} />
              <Text style={styles.signUpButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={[styles.signInText, { color: theme.colors.textSecondary }]}> 
                Already have an account?{' '}
              </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text style={[styles.signInLink, { color: theme.colors.primary }]}> 
                    Sign In
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signInText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  signInLink: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});