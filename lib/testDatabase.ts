import { DatabaseService } from './services/databaseService';
import { initDatabase } from './database';
import { DatabaseUtils } from './database';

/**
 * Test database functionality
 */
export async function testDatabase() {
  console.log('🧪 Testing database functionality...');
  
  try {
    // Initialize database
    console.log('1. Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized successfully');
    
    // Test task creation
    console.log('2. Testing task creation...');
    const testTask = await DatabaseService.createTask('test-user', {
      title: 'Test Task',
      description: 'This is a test task',
      priority: 'high',
      category: 'Test',
      tags: ['test', 'database'],
      completed: false,
    });
    console.log('✅ Task created:', testTask.id);
    
    // Test task retrieval
    console.log('3. Testing task retrieval...');
    const retrievedTask = await DatabaseService.getTask(testTask.id);
    if (retrievedTask) {
      console.log('✅ Task retrieved successfully');
    } else {
      throw new Error('Failed to retrieve task');
    }
    
    // Test task update
    console.log('4. Testing task update...');
    const updatedTask = await DatabaseService.updateTask(testTask.id, {
      completed: true,
      completed_at: DatabaseUtils.formatDate(new Date()),
    });
    if (updatedTask?.completed) {
      console.log('✅ Task updated successfully');
    } else {
      throw new Error('Failed to update task');
    }
    
    // Test task toggle
    console.log('5. Testing task completion toggle...');
    const toggledTask = await DatabaseService.toggleTaskCompletion(testTask.id);
    if (toggledTask && !toggledTask.completed) {
      console.log('✅ Task completion toggled successfully');
    } else {
      throw new Error('Failed to toggle task completion');
    }
    
    // Test user preferences
    console.log('6. Testing user preferences...');
    const userPrefs = await DatabaseService.createUserPreferences('test-user', {
      theme: 'dark',
      notifications_enabled: true,
      ai_suggestions_enabled: true,
    });
    console.log('✅ User preferences created:', userPrefs.theme);
    
    // Test analytics
    console.log('7. Testing analytics...');
    const analytics = await DatabaseService.getTaskAnalytics('test-user');
    console.log('✅ Analytics retrieved:', {
      totalTasks: analytics.totalTasks,
      completionRate: analytics.completionRate,
    });
    
    // Test suggestion creation
    console.log('8. Testing suggestion creation...');
    const suggestion = await DatabaseService.createSuggestion('test-user', {
      title: 'Test Suggestion',
      description: 'This is a test suggestion',
      category: 'Test',
      confidence: 85,
      reasoning: 'Based on test patterns',
      time_estimate: '30 mins',
      priority: 'medium',
      based_on: ['test patterns', 'user behavior'],
    });
    console.log('✅ Suggestion created:', suggestion.id);
    
    // Test feedback creation
    console.log('9. Testing feedback creation...');
    const feedback = await DatabaseService.createFeedback('test-user', {
      suggestion_id: suggestion.id,
      feedback_type: 'positive',
      reason: 'Great suggestion!',
    });
    console.log('✅ Feedback created:', feedback.id);
    
    // Test database stats
    console.log('10. Testing database stats...');
    const stats = await DatabaseService.getDatabaseStats();
    console.log('✅ Database stats:', stats);
    
    // Cleanup test data
    console.log('11. Cleaning up test data...');
    await DatabaseService.deleteTask(testTask.id);
    await DatabaseService.updateSuggestionStatus(suggestion.id, 'dismissed');
    console.log('✅ Test data cleaned up');
    
    console.log('🎉 All database tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

/**
 * Test storage functionality
 */
export async function testStorage() {
  console.log('🧪 Testing storage functionality...');
  
  try {
    const { StorageUtils, TypedStorage } = await import('./storage');
    
    // Test basic storage
    console.log('1. Testing basic storage operations...');
    StorageUtils.set('test-key', 'test-value');
    const value = StorageUtils.get('test-key');
    if (value === 'test-value') {
      console.log('✅ Basic storage working');
    } else {
      throw new Error('Basic storage failed');
    }
    
    // Test object storage
    console.log('2. Testing object storage...');
    const testObject = { name: 'test', value: 123 };
    StorageUtils.set('test-object', testObject);
    const retrievedObject = StorageUtils.get('test-object');
    if (JSON.stringify(retrievedObject) === JSON.stringify(testObject)) {
      console.log('✅ Object storage working');
    } else {
      throw new Error('Object storage failed');
    }
    
    // Test typed storage
    console.log('3. Testing typed storage...');
    TypedStorage.userPreferences.set({
      theme: 'dark',
      language: 'en',
      notifications: true,
      aiSuggestions: true,
      smartReminders: false,
      reminderFrequency: 'daily',
    });
    const prefs = TypedStorage.userPreferences.get();
    if (prefs?.theme === 'dark') {
      console.log('✅ Typed storage working');
    } else {
      throw new Error('Typed storage failed');
    }
    
    // Test cached tasks
    console.log('4. Testing cached tasks...');
    const testTasks = [
      { id: '1', title: 'Task 1', completed: false },
      { id: '2', title: 'Task 2', completed: true },
    ];
    TypedStorage.cachedTasks.set(testTasks);
    const cachedTasks = TypedStorage.cachedTasks.get();
    if (cachedTasks.length === 2) {
      console.log('✅ Cached tasks working');
    } else {
      throw new Error('Cached tasks failed');
    }
    
    // Cleanup
    StorageUtils.delete('test-key');
    StorageUtils.delete('test-object');
    console.log('✅ Storage cleanup completed');
    
    console.log('🎉 All storage tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Running all tests...\n');
  
  const dbResult = await testDatabase();
  console.log('\n');
  const storageResult = await testStorage();
  
  console.log('\n📊 Test Results:');
  console.log(`Database: ${dbResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Storage: ${storageResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (dbResult && storageResult) {
    console.log('\n🎉 All tests passed! Database and storage are working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
  }
  
  return dbResult && storageResult;
} 