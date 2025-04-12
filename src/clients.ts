import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Together from 'together-ai';

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

// Initialize optional Anthropic client
let anthropicClient: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  } catch (error) {
    // Anthropic package not installed or error initializing
    console.warn('Error initializing Anthropic client:', error);
  }
}

// Initialize optional Together client
let togetherClient: any | null = null;
if (process.env.TOGETHER_API_KEY) {
  try {
    togetherClient = new (Together as any)({
      auth: process.env.TOGETHER_API_KEY,
    });
  } catch (error) {
    // Together package not installed or error initializing
    console.warn('Error initializing Together client:', error);
  }
}

export { openaiClient, anthropicClient, togetherClient };
