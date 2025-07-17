import * as nlp from 'compromise';
import * as date from 'compromise/plugins/dates';
import { TaskCreateInput } from '@/lib/types';

// Register the date plugin
nlp.extend(date);

export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export enum EntityType {
  PERSON = 'person',
  LOCATION = 'location',
  TIME = 'time',
  DATE = 'date',
  DURATION = 'duration',
  TASK_ACTION = 'task_action'
}

export interface Intent {
  type: 'create_task' | 'complete_task' | 'update_task' | 'query_task' | 'unknown';
  confidence: number;
}

export interface DateTimeExtraction {
  date?: Date;
  time?: string;
  isRelative: boolean;
  original: string;
}

export interface ParsedTask {
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  tags: string[];
  reminderTime?: Date;
  isCompleted: boolean;
  completedAt?: Date;
}

/**
 * NLPProcessor handles natural language processing for task-related voice commands
 */
export class NLPProcessor {
  /**
   * Parse natural language text into structured task data
   */
  public async parseText(text: string): Promise<ParsedTask> {
    try {
      const intent = this.classifyIntent(text);
      const entities = this.extractEntities(text);
      const dateTime = this.extractDateTime(text);
      const priority = this.extractPriority(text);
      const category = this.extractCategory(text);
      const tags = this.extractTags(text);
      
      // Process based on intent
      if (intent.type === 'complete_task') {
        return this.processCompletedTask(text, entities, dateTime);
      } else {
        return this.processNewTask(text, entities, dateTime, priority, category, tags);
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      throw new Error('Failed to parse natural language input');
    }
  }

  /**
   * Classify the intent of the voice command
   */
  public classifyIntent(text: string): Intent {
    const lowerText = text.toLowerCase();
    
    // Check for task completion patterns
    if (
      lowerText.includes('i just finished') ||
      lowerText.includes('i completed') ||
      lowerText.includes('i\'ve done') ||
      lowerText.includes('mark as done') ||
      lowerText.includes('mark as complete')
    ) {
      return { type: 'complete_task', confidence: 0.9 };
    }
    
    // Check for task creation patterns
    if (
      lowerText.includes('remind me to') ||
      lowerText.includes('i need to') ||
      lowerText.includes('add task') ||
      lowerText.includes('create task') ||
      lowerText.includes('new task')
    ) {
      return { type: 'create_task', confidence: 0.9 };
    }
    
    // Check for task update patterns
    if (
      lowerText.includes('update task') ||
      lowerText.includes('change task') ||
      lowerText.includes('modify task') ||
      lowerText.includes('reschedule')
    ) {
      return { type: 'update_task', confidence: 0.8 };
    }
    
    // Check for task query patterns
    if (
      lowerText.includes('what are my tasks') ||
      lowerText.includes('show me my tasks') ||
      lowerText.includes('list tasks') ||
      lowerText.includes('find task')
    ) {
      return { type: 'query_task', confidence: 0.8 };
    }
    
    // Default to task creation with lower confidence
    return { type: 'create_task', confidence: 0.6 };
  }

  /**
   * Extract entities from the text
   */
  public extractEntities(text: string): Entity[] {
    const doc = nlp(text);
    const entities: Entity[] = [];
    
    // Extract people
    const people = doc.people().out('array');
    people.forEach(person => {
      entities.push({
        type: EntityType.PERSON,
        value: person,
        confidence: 0.8,
        startIndex: text.indexOf(person),
        endIndex: text.indexOf(person) + person.length
      });
    });
    
    // Extract places
    const places = doc.places().out('array');
    places.forEach(place => {
      entities.push({
        type: EntityType.LOCATION,
        value: place,
        confidence: 0.8,
        startIndex: text.indexOf(place),
        endIndex: text.indexOf(place) + place.length
      });
    });
    
    // Extract actions (verbs)
    const actions = doc.verbs().out('array');
    actions.forEach(action => {
      entities.push({
        type: EntityType.TASK_ACTION,
        value: action,
        confidence: 0.7,
        startIndex: text.indexOf(action),
        endIndex: text.indexOf(action) + action.length
      });
    });
    
    return entities;
  }

  /**
   * Extract date and time information from text
   */
  public extractDateTime(text: string): DateTimeExtraction {
    const doc = nlp(text);
    const dates = doc.dates().json();
    
    if (dates.length === 0) {
      return {
        isRelative: false,
        original: ''
      };
    }
    
    const dateInfo = dates[0];
    const start = dateInfo.dates?.start;
    
    let extractedDate: Date | undefined;
    let extractedTime: string | undefined;
    
    if (start) {
      try {
        extractedDate = new Date(start);
        
        // Extract time if available
        if (start.includes('T')) {
          const timePart = start.split('T')[1];
          extractedTime = timePart.substring(0, 5); // HH:MM format
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    
    return {
      date: extractedDate,
      time: extractedTime,
      isRelative: text.includes('tomorrow') || 
                 text.includes('next week') || 
                 text.includes('next month'),
      original: dateInfo.text || ''
    };
  }

  /**
   * Extract priority level from text
   */
  public extractPriority(text: string): 'low' | 'medium' | 'high' | undefined {
    const lowerText = text.toLowerCase();
    
    if (
      lowerText.includes('urgent') ||
      lowerText.includes('critical') ||
      lowerText.includes('high priority') ||
      lowerText.includes('important')
    ) {
      return 'high';
    }
    
    if (
      lowerText.includes('medium priority') ||
      lowerText.includes('moderate')
    ) {
      return 'medium';
    }
    
    if (
      lowerText.includes('low priority') ||
      lowerText.includes('whenever') ||
      lowerText.includes('not urgent')
    ) {
      return 'low';
    }
    
    return undefined;
  }

  /**
   * Extract category from text
   */
  public extractCategory(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    const commonCategories = [
      'work', 'personal', 'shopping', 'health', 
      'finance', 'family', 'home', 'education'
    ];
    
    for (const category of commonCategories) {
      if (lowerText.includes(category)) {
        return category;
      }
    }
    
    return undefined;
  }

  /**
   * Extract tags from text
   */
  public extractTags(text: string): string[] {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Look for hashtag format
    const hashtagRegex = /#(\w+)/g;
    let match;
    
    while ((match = hashtagRegex.exec(lowerText)) !== null) {
      tags.push(match[1]);
    }
    
    // Look for "tag: " format
    const tagPrefixRegex = /tag:?\s*(\w+)/gi;
    
    while ((match = tagPrefixRegex.exec(lowerText)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  /**
   * Process text for a completed task
   */
  private processCompletedTask(
    text: string, 
    entities: Entity[], 
    dateTime: DateTimeExtraction
  ): ParsedTask {
    // Extract the task title by removing the completion phrase
    let title = text
      .replace(/i just finished|i completed|i've done|mark as done|mark as complete/i, '')
      .trim();
    
    // If title starts with common connecting words, clean them up
    title = title.replace(/^(the|a|an|to)\s+/i, '');
    
    return {
      title,
      isCompleted: true,
      completedAt: new Date(),
      tags: [],
    };
  }

  /**
   * Process text for a new task
   */
  private processNewTask(
    text: string,
    entities: Entity[],
    dateTime: DateTimeExtraction,
    priority?: 'low' | 'medium' | 'high',
    category?: string,
    tags: string[] = []
  ): ParsedTask {
    // Extract the task title by removing common prefixes
    let title = text
      .replace(/remind me to|i need to|add task|create task|new task/i, '')
      .trim();
    
    // If we have date/time information in the title, try to remove it
    if (dateTime.original) {
      title = title.replace(dateTime.original, '').trim();
    }
    
    // Clean up the title
    title = title
      .replace(/\s{2,}/g, ' ') // Remove extra spaces
      .replace(/^(the|a|an|to)\s+/i, '') // Remove leading articles
      .replace(/\s+[.!?]$/, ''); // Remove trailing punctuation
    
    return {
      title,
      description: undefined,
      dueDate: dateTime.date,
      reminderTime: dateTime.date,
      priority,
      category,
      tags,
      isCompleted: false,
    };
  }

  /**
   * Convert parsed task to TaskCreateInput format
   */
  public toTaskCreateInput(parsedTask: ParsedTask): TaskCreateInput {
    return {
      title: parsedTask.title,
      description: parsedTask.description,
      completed: parsedTask.isCompleted,
      completed_at: parsedTask.completedAt?.toISOString(),
      logged_after_completion: parsedTask.isCompleted,
      priority: parsedTask.priority || 'medium',
      category: parsedTask.category || 'general',
      tags: parsedTask.tags,
      reminder_enabled: !!parsedTask.reminderTime,
      reminder_time: parsedTask.reminderTime?.toISOString(),
      due_date: parsedTask.dueDate?.toISOString(),
    };
  }
}