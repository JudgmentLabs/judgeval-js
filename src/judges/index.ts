import axios from 'axios';
import { log, warn, error } from '../common/logger.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

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
    // For synchronous generation, we need to block until we get a response
    // This is similar to how the Python SDK's fetch_litellm_api_response works
    if (!this.apiKey) {
      throw new Error('No API key provided for DefaultJudge');
    }
    
    try {
      // In Node.js, we can use a synchronous HTTP request via child_process
      // Create a temporary file for the request and response
      const tempDir = os.tmpdir();
      const requestFile = path.join(tempDir, `openai-request-${Date.now()}.json`);
      const responseFile = path.join(tempDir, `openai-response-${Date.now()}.json`);
      
      // Write request data to file
      fs.writeFileSync(requestFile, JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        ...(this.user ? { user: this.user } : {})
      }));
      
      // Make the request using curl
      const curlCommand = `curl -s -X POST https://api.openai.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${this.apiKey}" \
        -d @${requestFile} > ${responseFile}`;
      
      execSync(curlCommand);
      
      // Read the response
      const responseData = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
      
      // Clean up temporary files
      fs.unlinkSync(requestFile);
      fs.unlinkSync(responseFile);
      
      // Check if the response has the expected structure
      if (!responseData || !responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
        error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        throw new Error('Invalid response structure from OpenAI API');
      }
      
      // Return the content
      return responseData.choices[0].message.content;
    } catch (e: any) {
      error(`Error in synchronous generate: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  async aGenerate(prompt: string): Promise<string> {
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
          ...(this.user ? { user: this.user } : {})
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      // Check if the response has the expected structure
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        error(`Invalid response structure: ${JSON.stringify(response.data)}`);
        throw new Error('Invalid response structure from OpenAI API');
      }
      
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
    // For synchronous generation, we need to block until we get a response
    if (!this.apiKey) {
      throw new Error('No API key provided for TogetherJudge');
    }
    
    try {
      // In Node.js, we can use a synchronous HTTP request via child_process
      const tempDir = os.tmpdir();
      const requestFile = path.join(tempDir, `together-request-${Date.now()}.json`);
      const responseFile = path.join(tempDir, `together-response-${Date.now()}.json`);
      
      // Write request data to file
      fs.writeFileSync(requestFile, JSON.stringify({
        model: this.modelName,
        prompt: prompt,
        temperature: 0.0,
        max_tokens: 1024
      }));
      
      // Make the request using curl
      const curlCommand = `curl -s -X POST https://api.together.xyz/v1/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${this.apiKey}" \
        -d @${requestFile} > ${responseFile}`;
      
      execSync(curlCommand);
      
      // Read the response
      const responseData = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
      
      // Clean up temporary files
      fs.unlinkSync(requestFile);
      fs.unlinkSync(responseFile);
      
      // Check if the response has the expected structure
      if (!responseData || !responseData.choices || !responseData.choices[0] || !responseData.choices[0].text) {
        error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        throw new Error('Invalid response structure from Together API');
      }
      
      // Return the content
      return responseData.choices[0].text;
    } catch (e: any) {
      error(`Error in synchronous generate: ${e.message}`);
      throw new Error(`Failed to generate text: ${e.message}`);
    }
  }
  
  async aGenerate(prompt: string): Promise<string> {
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
          max_tokens: 1024
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      // Check if the response has the expected structure
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].text) {
        error(`Invalid response structure: ${JSON.stringify(response.data)}`);
        throw new Error('Invalid response structure from Together API');
      }
      
      return response.data.choices[0].text;
    } catch (e: any) {
      error(`Error generating text with Together API: ${e.message}`);
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
    return { judge: new DefaultJudge(undefined, undefined, user), usingNativeModel: true };
  }
  
  if (typeof model === 'string') {
    // Check if it's a Together AI model
    if (model.startsWith('together/') || 
        model.startsWith('meta-llama/') || 
        model.startsWith('mistralai/') ||
        model.includes('llama')) {
      return { judge: new TogetherJudge(model), usingNativeModel: true };
    }
    
    // Default to OpenAI
    return { judge: new DefaultJudge(model, undefined, user), usingNativeModel: true };
  }
  
  // It's already a Judge instance
  return { judge: model, usingNativeModel: false };
}
