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
 * Together AI judge implementation
 */
export class TogetherJudge implements Judge {
  private modelName: string;
  private apiKey?: string;
  
  constructor(modelName: string = 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo', apiKey?: string) {
    this.modelName = modelName;
    this.apiKey = apiKey || process.env.TOGETHER_API_KEY;
    
    if (!this.apiKey) {
      warn('No API key provided for TogetherJudge. Set TOGETHER_API_KEY environment variable or pass apiKey to constructor.');
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
      throw new Error('No API key provided for TogetherJudge');
    }
    
    try {
      const response = await axios.post(
        'https://api.together.xyz/v1/completions',
        {
          model: this.modelName,
          prompt: prompt,
          temperature: 0.0,
          max_tokens: 1024,
          stop: ["</answer>"]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return response.data.choices[0].text;
    } catch (e: any) {
      error(`Error generating text with Together AI API: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  getModelName(): string {
    return this.modelName;
  }
}

/**
 * Mock judge implementation for testing without making real API calls
 */
export class MockJudge implements Judge {
  private modelName: string;
  private exampleIndex: number = 0;
  
  constructor(modelName: string = 'mock-model') {
    this.modelName = modelName;
  }
  
  generate(prompt: string): string {
    return this.mockResponse(prompt);
  }
  
  async aGenerate(prompt: string): Promise<string> {
    return this.mockResponse(prompt);
  }
  
  private mockResponse(prompt: string): string {
    // For statements generation
    if (prompt.includes("deduce statements")) {
      if (prompt.includes("capital of France") || this.exampleIndex === 0) {
        return `{
  "statements": [
    "Paris is the capital of France",
    "Paris is located in northern France",
    "The city has a population of over 2 million"
  ]
}`;
      } else if (prompt.includes("largest planet") || this.exampleIndex === 1) {
        return `{
  "statements": [
    "Jupiter is the largest planet in our solar system",
    "Jupiter is a gas giant",
    "Jupiter has 79 known moons",
    "The Great Red Spot is a storm on Jupiter"
  ]
}`;
      } else {
        return `{
  "statements": [
    "The boiling point of water is 100 degrees Celsius",
    "The boiling point of water is 212 degrees Fahrenheit",
    "This occurs at standard atmospheric pressure"
  ]
}`;
      }
    }
    
    // For verdicts generation
    if (prompt.includes("evaluate the following statements")) {
      if (prompt.includes("Paris is the capital of France") || this.exampleIndex === 0) {
        this.exampleIndex = 1; // Move to next example for next call
        return `{
  "verdicts": [
    {
      "verdict": "Yes",
      "reason": "The actual output explicitly states that Paris is the capital of France."
    },
    {
      "verdict": "Yes",
      "reason": "The actual output mentions that Paris is located in northern France."
    },
    {
      "verdict": "Yes",
      "reason": "The actual output states that Paris has a population of over 2 million people."
    }
  ]
}`;
      } else if (prompt.includes("Jupiter is the largest planet") || this.exampleIndex === 1) {
        this.exampleIndex = 2; // Move to next example for next call
        return `{
  "verdicts": [
    {
      "verdict": "Yes",
      "reason": "The actual output states that Jupiter is the biggest planet in the solar system, which is equivalent to saying it's the largest."
    },
    {
      "verdict": "Yes",
      "reason": "The actual output states that Jupiter is made mostly of gas, which is equivalent to saying it's a gas giant."
    },
    {
      "verdict": "No",
      "reason": "The actual output does not mention that Jupiter has 79 known moons, only that it has many moons."
    },
    {
      "verdict": "No",
      "reason": "The actual output does not mention the Great Red Spot."
    }
  ]
}`;
      } else {
        this.exampleIndex = 0; // Reset for next run
        return `{
  "verdicts": [
    {
      "verdict": "Yes",
      "reason": "The actual output states that water boils at 100 degrees Celsius."
    },
    {
      "verdict": "No",
      "reason": "The actual output does not mention the temperature in Fahrenheit (212 degrees)."
    },
    {
      "verdict": "Yes",
      "reason": "The actual output mentions 'at sea level', which is equivalent to standard atmospheric pressure."
    }
  ]
}`;
      }
    }
    
    // For reason generation
    if (prompt.includes("reason for the score")) {
      if (this.exampleIndex === 0) {
        return `{
  "reason": "All statements in the expected output are correctly represented in the actual output."
}`;
      } else if (this.exampleIndex === 1) {
        return `{
  "reason": "The actual output correctly states that Jupiter is the largest planet and a gas giant, but fails to mention that it has 79 known moons and the Great Red Spot."
}`;
      } else {
        return `{
  "reason": "The actual output correctly states that water boils at 100 degrees Celsius at standard atmospheric pressure, but fails to mention the temperature in Fahrenheit (212 degrees)."
}`;
      }
    }
    
    // Default response
    return `{
  "result": "This is a mock response."
}`;
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
    // Check if it's a Together AI model
    if (model.startsWith('meta-llama/') || model.includes('together')) {
      return {
        judge: new TogetherJudge(model),
        usingNativeModel: true
      };
    }
    
    // Check if it's a mock model
    if (model.startsWith('mock-')) {
      return {
        judge: new MockJudge(model),
        usingNativeModel: false
      };
    }
    
    // Default to OpenAI
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
