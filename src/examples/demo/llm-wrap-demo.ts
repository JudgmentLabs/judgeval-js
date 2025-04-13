// REMOVE Shim import
// import 'together-ai/shims/web';

import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
// import Together from 'together-ai'; // Keep commented out or remove

// Use standard ES Module import
import Together from 'together-ai';

// *** Remove inspection logs ***
// console.log('--- Inspecting required Together module ---');
// console.log(Together);
// console.log('Keys:', Object.keys(Together || {}));
// console.log('Type:', typeof Together);
// console.log('-----------------------------------------');

import { Tracer, wrap } from '../../common/tracer.js'; // Adjust path as necessary
import { JudgmentClient } from '../../judgment-client.js';
import { FaithfulnessScorer } from '../../scorers/api-scorer.js';
import * as logger from '../../common/logger.js';

// Load environment variables from .env file
dotenv.config({ path: '.env.local' });

// --- Environment Variable Checks ---
function checkEnvVar(varName: string, isRequired: boolean = false): boolean {
  if (!process.env[varName]) {
    if (isRequired) {
      console.error(`Error: Required environment variable ${varName} is not set.`);
      process.exit(1);
    }
    console.warn(`Warning: Environment variable ${varName} is not set. Calls using this client may fail.`);
    return false;
  }
  return true;
}

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
const hasTogetherKey = !!process.env.TOGETHER_API_KEY;

if (!checkEnvVar('JUDGMENT_API_KEY')) {
  console.warn("Warning: JUDGMENT_API_KEY environment variable is not set. Tracing will be disabled.");
}
if (!checkEnvVar('JUDGMENT_ORG_ID')) {
  console.warn("Warning: JUDGMENT_ORG_ID environment variable is not set. Tracing will be disabled.");
}

// --- Main Demo Function ---
async function runDemo() {
  // 1. Initialize the Tracer
  const tracer = Tracer.getInstance({
    projectName: 'js-wrap-all-clients-demo',
  });

  // 2. Create and Wrap Clients
  let openai: OpenAI | null = null;
  let anthropic: Anthropic | null = null;
  let together: any | null = null;

  try {
    if (hasOpenAIKey) {
      openai = wrap(new OpenAI());
      console.log('OpenAI client wrapped.');
    } else {
      console.warn('OpenAI API key missing, skipping wrap.');
    }
  } catch (e) {
    console.error('Failed to initialize or wrap OpenAI client:', e);
  }
  try {
    if (hasAnthropicKey) {
      anthropic = wrap(new Anthropic());
      console.log('Anthropic client wrapped.');
    } else {
      console.warn('Anthropic API key missing, skipping wrap.');
    }
  } catch (e) {
    console.error('Failed to initialize or wrap Anthropic client:', e);
  }
  try {
    if (hasTogetherKey) {
      console.log('Creating wrapped Together AI client...');
      // Use apiKey instead of auth
      together = wrap(new Together({ apiKey: process.env.TOGETHER_API_KEY ?? '' }));
      console.log('Together AI client wrapped.');
    } else {
      console.warn('Together API key missing, skipping wrap.');
    }
  } catch (e) {
    console.error('Failed to initialize or wrap Together client:', e);
  }

  // 3. Use the wrapped clients within a trace context
  const traceName = 'llm-wrap-multi-client-demo';
  console.log(`\nStarting trace: ${traceName}`);

  try {
    for (const trace of tracer.trace(traceName, { overwrite: true })) {
      console.log(`Inside trace context for ${trace.name} (ID: ${trace.traceId})`);

      // --- OpenAI Call ---
      if (openai) {
        try {
          console.log('\nMaking OpenAI API call...');
          const params: OpenAI.Chat.ChatCompletionCreateParams = {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Explain the concept of API wrapping briefly.' }],
            max_tokens: 60,
          };
          const response = await openai.chat.completions.create(params);
          console.log('OpenAI Response:', response.choices[0]?.message?.content?.trim());
        } catch (error) {
          console.error('OpenAI call failed:', error);
        }
      }

      // --- Anthropic Call ---
      if (anthropic) {
        try {
          console.log('\nMaking Anthropic API call...');
          const params: Anthropic.Messages.MessageCreateParams = {
            model: 'claude-3-haiku-20240307', // Use a valid Anthropic model
            messages: [{ role: 'user', content: 'What is the capital of France?' }],
            max_tokens: 50,
          };
          const response = await anthropic.messages.create(params);
          // Anthropic response content is often in an array
          const responseText = response.content.map(block => block.type === 'text' ? block.text : '').join('');
          console.log('Anthropic Response:', responseText.trim());
        } catch (error) {
          console.error('Anthropic call failed:', error);
        }
      }

      // --- Together AI Call --- (Uncomment and use documented structure)
      if (together) {
        try {
          console.log('\nMaking Together AI API call...');
          const params = {
            model: 'meta-llama/Llama-3-8b-chat-hf',
            messages: [{ role: 'user', content: 'Tell me a short story about a brave dog.' }],
            max_tokens: 150,
          };
          // Use documented chat.completions endpoint for 0.7.0
          const response = await together.chat.completions.create(params);
          console.log('Together AI Response:', response.choices[0]?.message?.content?.trim());
        } catch (error) {
          console.error('Together AI call failed:', error);
        }
      }
    }

  } catch (error) {
    // Errors during runInTrace setup or saving (less likely)
    console.error('\n--- Error during trace execution framework ---');
    console.error(error);
    console.log('-------------------------------------------');
  } finally {
    console.log(`\nTrace finished. Check Judgment dashboard if monitoring was enabled.`);
  }
}

// Run the demo
runDemo(); 