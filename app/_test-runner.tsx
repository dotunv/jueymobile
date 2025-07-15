import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runAllTests, testDatabase, testStorage } from '@/lib/testDatabase';
import { useTheme } from '@/context/ThemeContext';

export default function TestRunnerScreen() {
  const { theme } = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    addResult('Starting tests...');
    
    try {
      const success = await runAllTests();
      addResult(success ? '✅ All tests passed!' : '❌ Some tests failed');
    } catch (error) {
      addResult(`❌ Test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runDatabaseTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    addResult('Starting database tests...');
    
    try {
      const success = await testDatabase();
      addResult(success ? '✅ Database tests passed!' : '❌ Database tests failed');
    } catch (error) {
      addResult(`❌ Database test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runStorageTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    addResult('Starting storage tests...');
    
    try {
      const success = await testStorage();
      addResult(success ? '✅ Storage tests passed!' : '❌ Storage tests failed');
    } catch (error) {
      addResult(`❌ Storage test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Database & Storage Tests
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Test the database and storage functionality
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            { backgroundColor: theme.colors.primary },
            isRunning && styles.disabledButton
          ]}
          onPress={runTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            isRunning && styles.disabledButton
          ]}
          onPress={runDatabaseTests}
          disabled={isRunning}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            Test Database Only
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            isRunning && styles.disabledButton
          ]}
          onPress={runStorageTests}
          disabled={isRunning}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            Test Storage Only
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.clearButton,
            { backgroundColor: theme.colors.error }
          ]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>
          Test Results:
        </Text>
        
        <ScrollView style={styles.resultsScroll}>
          {results.length === 0 ? (
            <Text style={[styles.noResults, { color: theme.colors.textTertiary }]}>
              No test results yet. Run a test to see results here.
            </Text>
          ) : (
            results.map((result, index) => (
              <Text
                key={index}
                style={[
                  styles.resultText,
                  { color: theme.colors.textSecondary }
                ]}
              >
                {result}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {isRunning && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background + 'CC' }]}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Running tests...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    borderColor: 'transparent',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  clearButton: {
    borderColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  resultsScroll: {
    flex: 1,
  },
  noResults: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
  },
}); 