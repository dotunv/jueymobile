import { MLModelManager, ModelType, MLModel, TrainingData, ModelPrediction } from '../mlModelStorage';
import { VoiceCommand } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * VoiceModelManager handles ML models specific to voice processing
 * and natural language understanding.
 */
export class VoiceModelManager {
  private mlModelManager: MLModelManager;
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
    this.mlModelManager = new MLModelManager(userId);
  }
  
  /**
   * Initialize voice models
   */
  public async initialize(): Promise<void> {
    try {
      await this.mlModelManager.initialize();
      
      // Check if we need to create initial models
      const categoryModel = await this.mlModelManager.loadModel(ModelType.CATEGORY_CLASSIFICATION);
      if (!categoryModel) {
        await this.createInitialCategoryModel();
      }
    } catch (error) {
      console.error('Failed to initialize voice models:', error);
    }
  }
  
  /**
   * Create initial category classification model with default categories
   */
  private async createInitialCategoryModel(): Promise<void> {
    try {
      const defaultCategories = [
        'work', 'personal', 'shopping', 'health', 
        'finance', 'family', 'home', 'education'
      ];
      
      // Create simple training data for categories
      const trainingData: TrainingData[] = [];
      
      // For each category, create some simple training examples
      defaultCategories.forEach((category, index) => {
        // Add basic examples for each category
        trainingData.push({
          features: this.textToFeatureVector(`${category} task`),
          target: category,
          weight: 1.0
        });
        
        trainingData.push({
          features: this.textToFeatureVector(`my ${category}`),
          target: category,
          weight: 1.0
        });
        
        trainingData.push({
          features: this.textToFeatureVector(`for ${category}`),
          target: category,
          weight: 1.0
        });
      });
      
      // Train the model
      await this.mlModelManager.trainModel(
        ModelType.CATEGORY_CLASSIFICATION,
        trainingData,
        {
          features: ['word_features'],
          outputClasses: defaultCategories,
          hyperparameters: {
            learningRate: 0.01,
            regularization: 0.001
          },
          trainingConfig: {
            epochs: 100,
            batchSize: 16
          }
        }
      );
    } catch (error) {
      console.error('Failed to create initial category model:', error);
    }
  }
  
  /**
   * Predict category from text
   */
  public async predictCategory(text: string): Promise<ModelPrediction> {
    try {
      const features = this.textToFeatureVector(text);
      return await this.mlModelManager.predictWithModel(
        ModelType.CATEGORY_CLASSIFICATION,
        features
      );
    } catch (error) {
      console.error('Failed to predict category:', error);
      return {
        prediction: 'general',
        confidence: 0.5
      };
    }
  }
  
  /**
   * Update model with feedback from voice commands
   */
  public async updateFromFeedback(
    command: VoiceCommand, 
    actualCategory: string
  ): Promise<void> {
    try {
      const features = this.textToFeatureVector(command.transcription);
      
      await this.mlModelManager.updateModelWeights(
        ModelType.CATEGORY_CLASSIFICATION,
        {
          features,
          target: actualCategory,
          weight: 1.0
        }
      );
    } catch (error) {
      console.error('Failed to update model from feedback:', error);
    }
  }
  
  /**
   * Convert text to feature vector for ML models
   * This is a simple bag-of-words approach
   */
  private textToFeatureVector(text: string): number[] {
    // In a real implementation, this would use more sophisticated NLP techniques
    // For this demo, we'll use a simple approach
    
    // Normalize text
    const normalizedText = text.toLowerCase().trim();
    
    // Create a simple feature vector based on word presence
    // This is a very basic approach - in a real app, use proper NLP techniques
    const commonWords = [
      'work', 'personal', 'shopping', 'health', 'finance', 'family', 
      'home', 'education', 'urgent', 'important', 'tomorrow', 'today',
      'meeting', 'call', 'email', 'buy', 'pay', 'check', 'review',
      'high', 'medium', 'low', 'priority', 'remind', 'task', 'project'
    ];
    
    // Create feature vector (1 if word is present, 0 if not)
    const features = commonWords.map(word => 
      normalizedText.includes(word) ? 1.0 : 0.0
    );
    
    return features;
  }
  
  /**
   * Get model performance metrics
   */
  public async getModelMetrics(): Promise<{
    accuracy: number;
    lastTrained: string;
    trainingDataSize: number;
  } | null> {
    try {
      const metrics = await this.mlModelManager.getModelMetrics(
        ModelType.CATEGORY_CLASSIFICATION
      );
      
      return metrics;
    } catch (error) {
      console.error('Failed to get model metrics:', error);
      return null;
    }
  }
}