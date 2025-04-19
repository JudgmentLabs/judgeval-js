import axios from 'axios';
import { log, warn, error } from '../common/logger.js';

/**
 * Interface for judge models that can generate text
 */
export interface Judge {
  /**
   * Generate text synchronously
   */
  generate(prompt: string): string;
  
  /**
   * Generate text asynchronously
   */
  aGenerate(prompt: string): Promise<string>;
  
  /**
   * Get the name of the model
   */
  getModelName(): string;
}

/**
 * Default judge implementation using OpenAI API
 */
export class DefaultJudge implements Judge {
  private modelName: string;
  private apiKey?: string;
  private user?: string;
  
  constructor(modelName: string = 'gpt-3.5-turbo', apiKey?: string, user?: string) {
    this.modelName = modelName;
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.user = user;
    
    if (!this.apiKey) {
      warn('No API key provided for DefaultJudge. Set OPENAI_API_KEY environment variable or pass apiKey to constructor.');
    }
  }
  
  generate(prompt: string): string {
    // Synchronous version just wraps the async version
    const result = this.aGenerateInternal(prompt);
    return result as unknown as string;
  }
  
  async aGenerate(prompt: string): Promise<string> {
    return this.aGenerateInternal(prompt);
  }
  
  private async aGenerateInternal(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key provided for DefaultJudge');
    }
    
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
          user: this.user
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (e: any) {
      error(`Error generating text with OpenAI API: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  getModelName(): string {
    return this.modelName;
  }
}

/**
 * Create a judge instance
 * @param model Model name or Judge instance
 * @param user Optional user identifier
 * @returns Judge instance and whether it's a native model
 */
export function createJudge(model?: string | Judge, user?: string): { judge: Judge, usingNativeModel: boolean } {
  if (!model) {
    // Default to gpt-3.5-turbo if no model specified
    return { 
      judge: new DefaultJudge('gpt-3.5-turbo', undefined, user),
      usingNativeModel: true
    };
  }
  
  if (typeof model === 'string') {
    return { 
      judge: new DefaultJudge(model, undefined, user),
      usingNativeModel: true
    };
  }
  
  // If model is already a Judge instance, use it directly
  return { 
    judge: model,
    usingNativeModel: false
  };
}
