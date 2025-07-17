import * as FileSystem from 'expo-file-system';
import { DatabaseUtils } from '../database';

/**
 * Lightweight ML model storage system for pattern recognition
 * Uses simple statistical models and local storage instead of TensorFlow Lite
 */

export interface MLModel {
  id: string;
  userId: string;
  modelType: ModelType;
  version: number;
  weights: number[];
  metadata: ModelMetadata;
  accuracy: number;
  lastTrained: string;
  trainingDataSize: number;
}

export interface ModelMetadata {
  features: string[];
  outputClasses?: string[];
  hyperparameters: Record<string, any>;
  trainingConfig: Record<string, any>;
}

export interface TrainingData {
  features: number[];
  target: number | string;
  weight?: number;
}

export interface ModelPrediction {
  prediction: number | string;
  confidence: number;
  probabilities?: Record<string, number>;
}

export enum ModelType {
  TASK_SUGGESTION = 'task_suggestion',
  TIMING_PREDICTION = 'timing_prediction',
  PRIORITY_RANKING = 'priority_ranking',
  COMPLETION_LIKELIHOOD = 'completion_likelihood',
  CATEGORY_CLASSIFICATION = 'category_classification'
}

/**
 * Simple linear regression model for numerical predictions
 */
class LinearRegressionModel {
  private weights: number[] = [];
  private bias: number = 0;
  private learningRate: number = 0.01;
  private regularization: number = 0.001;

  constructor(features: number, learningRate: number = 0.01) {
    this.weights = new Array(features).fill(0).map(() => Math.random() * 0.1 - 0.05);
    this.learningRate = learningRate;
  }

  predict(features: number[]): number {
    if (features.length !== this.weights.length) {
      throw new Error('Feature dimension mismatch');
    }
    
    let prediction = this.bias;
    for (let i = 0; i < features.length; i++) {
      prediction += features[i] * this.weights[i];
    }
    
    return prediction;
  }

  train(trainingData: TrainingData[]): void {
    const epochs = 100;
    const batchSize = Math.min(32, trainingData.length);
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle training data
      const shuffled = [...trainingData].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        this.trainBatch(batch);
      }
    }
  }

  private trainBatch(batch: TrainingData[]): void {
    const gradients = new Array(this.weights.length).fill(0);
    let biasGradient = 0;
    
    for (const sample of batch) {
      const prediction = this.predict(sample.features);
      const error = (sample.target as number) - prediction;
      const weight = sample.weight || 1;
      
      // Calculate gradients
      for (let i = 0; i < this.weights.length; i++) {
        gradients[i] += error * sample.features[i] * weight;
      }
      biasGradient += error * weight;
    }
    
    // Update weights with regularization
    for (let i = 0; i < this.weights.length; i++) {
      const gradient = gradients[i] / batch.length;
      const regularizationTerm = this.regularization * this.weights[i];
      this.weights[i] += this.learningRate * (gradient - regularizationTerm);
    }
    
    this.bias += this.learningRate * (biasGradient / batch.length);
  }

  getWeights(): number[] {
    return [this.bias, ...this.weights];
  }

  setWeights(weights: number[]): void {
    if (weights.length !== this.weights.length + 1) {
      throw new Error('Weight dimension mismatch');
    }
    
    this.bias = weights[0];
    this.weights = weights.slice(1);
  }
}

/**
 * Simple logistic regression model for classification
 */
class LogisticRegressionModel {
  private weights: number[] = [];
  private bias: number = 0;
  private learningRate: number = 0.01;
  private classes: string[] = [];

  constructor(features: number, classes: string[], learningRate: number = 0.01) {
    this.weights = new Array(features).fill(0).map(() => Math.random() * 0.1 - 0.05);
    this.classes = classes;
    this.learningRate = learningRate;
  }

  predict(features: number[]): { prediction: string; confidence: number; probabilities: Record<string, number> } {
    const logits = this.computeLogits(features);
    const probabilities = this.softmax(logits);
    
    let maxProb = 0;
    let prediction = this.classes[0];
    const probMap: Record<string, number> = {};
    
    for (let i = 0; i < this.classes.length; i++) {
      probMap[this.classes[i]] = probabilities[i];
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        prediction = this.classes[i];
      }
    }
    
    return {
      prediction,
      confidence: maxProb,
      probabilities: probMap
    };
  }

  private computeLogits(features: number[]): number[] {
    // For binary classification, return single logit
    if (this.classes.length === 2) {
      let logit = this.bias;
      for (let i = 0; i < features.length; i++) {
        logit += features[i] * this.weights[i];
      }
      return [logit, -logit];
    }
    
    // For multi-class, would need separate weights for each class
    // Simplified implementation for binary case
    return [0, 0];
  }

  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((sum, exp) => sum + exp, 0);
    return expLogits.map(exp => exp / sumExp);
  }

  train(trainingData: TrainingData[]): void {
    const epochs = 100;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (const sample of trainingData) {
        const prediction = this.sigmoid(this.computeLogits(sample.features)[0]);
        const target = sample.target === this.classes[1] ? 1 : 0;
        const error = target - prediction;
        
        // Update weights
        for (let i = 0; i < this.weights.length; i++) {
          this.weights[i] += this.learningRate * error * sample.features[i];
        }
        this.bias += this.learningRate * error;
      }
    }
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  getWeights(): number[] {
    return [this.bias, ...this.weights];
  }

  setWeights(weights: number[]): void {
    this.bias = weights[0];
    this.weights = weights.slice(1);
  }
}

/**
 * ML Model Manager for storing and managing lightweight models
 */
export class MLModelManager {
  private userId: string;
  private modelsDirectory: string;

  constructor(userId: string) {
    this.userId = userId;
    this.modelsDirectory = `${FileSystem.documentDirectory}ml_models/${userId}/`;
  }

  /**
   * Initialize model storage directory
   */
  async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.modelsDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.modelsDirectory, { intermediates: true });
      }
    } catch (error) {
      console.error('Error initializing ML model storage:', error);
      throw error;
    }
  }

  /**
   * Load a model from storage
   */
  async loadModel(modelType: ModelType): Promise<MLModel | null> {
    try {
      const modelPath = `${this.modelsDirectory}${modelType}.json`;
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (!fileInfo.exists) {
        return null;
      }
      
      const modelData = await FileSystem.readAsStringAsync(modelPath);
      return JSON.parse(modelData) as MLModel;
    } catch (error) {
      console.error(`Error loading model ${modelType}:`, error);
      return null;
    }
  }

  /**
   * Save a model to storage
   */
  async saveModel(model: MLModel): Promise<void> {
    try {
      await this.initialize();
      const modelPath = `${this.modelsDirectory}${model.modelType}.json`;
      await FileSystem.writeAsStringAsync(modelPath, JSON.stringify(model));
    } catch (error) {
      console.error(`Error saving model ${model.modelType}:`, error);
      throw error;
    }
  }

  /**
   * Train a model with new data
   */
  async trainModel(
    modelType: ModelType, 
    trainingData: TrainingData[], 
    metadata: ModelMetadata
  ): Promise<MLModel> {
    try {
      let model: LinearRegressionModel | LogisticRegressionModel;
      let accuracy = 0;
      
      // Create appropriate model based on type
      switch (modelType) {
        case ModelType.TIMING_PREDICTION:
        case ModelType.COMPLETION_LIKELIHOOD:
          model = new LinearRegressionModel(metadata.features.length);
          (model as LinearRegressionModel).train(trainingData);
          accuracy = this.calculateRegressionAccuracy(model as LinearRegressionModel, trainingData);
          break;
          
        case ModelType.TASK_SUGGESTION:
        case ModelType.PRIORITY_RANKING:
        case ModelType.CATEGORY_CLASSIFICATION:
          const classes = metadata.outputClasses || ['low', 'high'];
          model = new LogisticRegressionModel(metadata.features.length, classes);
          (model as LogisticRegressionModel).train(trainingData);
          accuracy = this.calculateClassificationAccuracy(model as LogisticRegressionModel, trainingData);
          break;
          
        default:
          throw new Error(`Unsupported model type: ${modelType}`);
      }
      
      const mlModel: MLModel = {
        id: DatabaseUtils.generateId(),
        userId: this.userId,
        modelType,
        version: 1,
        weights: model.getWeights(),
        metadata,
        accuracy,
        lastTrained: DatabaseUtils.formatDate(new Date()),
        trainingDataSize: trainingData.length
      };
      
      await this.saveModel(mlModel);
      return mlModel;
    } catch (error) {
      console.error(`Error training model ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Make prediction with a model
   */
  async predictWithModel(
    modelType: ModelType, 
    features: number[]
  ): Promise<ModelPrediction> {
    try {
      const mlModel = await this.loadModel(modelType);
      if (!mlModel) {
        throw new Error(`Model ${modelType} not found`);
      }
      
      let prediction: ModelPrediction;
      
      switch (modelType) {
        case ModelType.TIMING_PREDICTION:
        case ModelType.COMPLETION_LIKELIHOOD:
          const regModel = new LinearRegressionModel(features.length);
          regModel.setWeights(mlModel.weights);
          const numPrediction = regModel.predict(features);
          prediction = {
            prediction: numPrediction,
            confidence: Math.min(1, mlModel.accuracy)
          };
          break;
          
        case ModelType.TASK_SUGGESTION:
        case ModelType.PRIORITY_RANKING:
        case ModelType.CATEGORY_CLASSIFICATION:
          const classes = mlModel.metadata.outputClasses || ['low', 'high'];
          const classModel = new LogisticRegressionModel(features.length, classes);
          classModel.setWeights(mlModel.weights);
          const classPrediction = classModel.predict(features);
          prediction = {
            prediction: classPrediction.prediction,
            confidence: classPrediction.confidence,
            probabilities: classPrediction.probabilities
          };
          break;
          
        default:
          throw new Error(`Unsupported model type: ${modelType}`);
      }
      
      return prediction;
    } catch (error) {
      console.error(`Error making prediction with model ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Update model weights based on feedback
   */
  async updateModelWeights(
    modelType: ModelType, 
    feedback: { features: number[]; target: number | string; weight?: number }
  ): Promise<void> {
    try {
      const mlModel = await this.loadModel(modelType);
      if (!mlModel) {
        console.warn(`Model ${modelType} not found for weight update`);
        return;
      }
      
      // Perform incremental learning with single sample
      const trainingData = [feedback];
      
      switch (modelType) {
        case ModelType.TIMING_PREDICTION:
        case ModelType.COMPLETION_LIKELIHOOD:
          const regModel = new LinearRegressionModel(feedback.features.length, 0.001); // Lower learning rate for updates
          regModel.setWeights(mlModel.weights);
          regModel.train(trainingData);
          mlModel.weights = regModel.getWeights();
          break;
          
        case ModelType.TASK_SUGGESTION:
        case ModelType.PRIORITY_RANKING:
        case ModelType.CATEGORY_CLASSIFICATION:
          const classes = mlModel.metadata.outputClasses || ['low', 'high'];
          const classModel = new LogisticRegressionModel(feedback.features.length, classes, 0.001);
          classModel.setWeights(mlModel.weights);
          classModel.train(trainingData);
          mlModel.weights = classModel.getWeights();
          break;
      }
      
      mlModel.lastTrained = DatabaseUtils.formatDate(new Date());
      mlModel.version += 1;
      
      await this.saveModel(mlModel);
    } catch (error) {
      console.error(`Error updating model weights for ${modelType}:`, error);
    }
  }

  /**
   * Calculate regression model accuracy (R-squared)
   */
  private calculateRegressionAccuracy(model: LinearRegressionModel, testData: TrainingData[]): number {
    if (testData.length === 0) return 0;
    
    let totalSumSquares = 0;
    let residualSumSquares = 0;
    
    const actualValues = testData.map(d => d.target as number);
    const meanActual = actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length;
    
    for (const sample of testData) {
      const predicted = model.predict(sample.features);
      const actual = sample.target as number;
      
      totalSumSquares += Math.pow(actual - meanActual, 2);
      residualSumSquares += Math.pow(actual - predicted, 2);
    }
    
    return totalSumSquares === 0 ? 0 : Math.max(0, 1 - (residualSumSquares / totalSumSquares));
  }

  /**
   * Calculate classification model accuracy
   */
  private calculateClassificationAccuracy(model: LogisticRegressionModel, testData: TrainingData[]): number {
    if (testData.length === 0) return 0;
    
    let correct = 0;
    
    for (const sample of testData) {
      const prediction = model.predict(sample.features);
      if (prediction.prediction === sample.target) {
        correct++;
      }
    }
    
    return correct / testData.length;
  }

  /**
   * Get all models for user
   */
  async getAllModels(): Promise<MLModel[]> {
    try {
      await this.initialize();
      const models: MLModel[] = [];
      
      for (const modelType of Object.values(ModelType)) {
        const model = await this.loadModel(modelType);
        if (model) {
          models.push(model);
        }
      }
      
      return models;
    } catch (error) {
      console.error('Error getting all models:', error);
      return [];
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelType: ModelType): Promise<void> {
    try {
      const modelPath = `${this.modelsDirectory}${modelType}.json`;
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(modelPath);
      }
    } catch (error) {
      console.error(`Error deleting model ${modelType}:`, error);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(modelType: ModelType): Promise<{
    accuracy: number;
    lastTrained: string;
    trainingDataSize: number;
    version: number;
  } | null> {
    try {
      const model = await this.loadModel(modelType);
      if (!model) return null;
      
      return {
        accuracy: model.accuracy,
        lastTrained: model.lastTrained,
        trainingDataSize: model.trainingDataSize,
        version: model.version
      };
    } catch (error) {
      console.error(`Error getting metrics for model ${modelType}:`, error);
      return null;
    }
  }
}