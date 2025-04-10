import * as dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { Together } from 'together-ai';

// Load environment variables
dotenv.config();

// Initialize optional OpenAI client
let openaiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    // OpenAI package not installed or error initializing
    console.warn('Error initializing OpenAI client:', error);
  }
}

// Initialize optional Together client
let togetherClient: Together | null = null;
if (process.env.TOGETHERAI_API_KEY) {
  try {
    togetherClient = new Together({
      apiKey: process.env.TOGETHERAI_API_KEY as string,
    });
  } catch (error) {
    // Together package not installed or error initializing
    console.warn('Error initializing Together client:', error);
  }
}

export { openaiClient, togetherClient };
