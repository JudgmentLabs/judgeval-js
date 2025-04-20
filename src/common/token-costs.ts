/**
 * Token cost utilities for the JudgEval TypeScript SDK
 * This provides a local implementation of token cost calculation
 * similar to LiteLLM's cost_per_token function in Python
 */

import { warn } from './logger.js';

// Model cost mapping (USD per 1000 tokens)
// These rates are based on OpenAI's pricing as of April 2025
// Source: https://openai.com/pricing
const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  // GPT-4 models
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-32k': { prompt: 0.06, completion: 0.12 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4-turbo-preview': { prompt: 0.01, completion: 0.03 },
  'gpt-4-vision-preview': { prompt: 0.01, completion: 0.03 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-4o-mini': { prompt: 0.0015, completion: 0.006 },
  
  // GPT-3.5 models
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'gpt-3.5-turbo-16k': { prompt: 0.001, completion: 0.002 },
  'gpt-3.5-turbo-instruct': { prompt: 0.0015, completion: 0.002 },
  
  // Claude models
  'claude-instant-1': { prompt: 0.0008, completion: 0.0024 },
  'claude-2': { prompt: 0.008, completion: 0.024 },
  'claude-2.1': { prompt: 0.008, completion: 0.024 },
  'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
  'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
  'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
  
  // Default fallback
  'default': { prompt: 0.001, completion: 0.002 }
};

/**
 * Calculate cost per token for a given model
 * This mimics LiteLLM's cost_per_token function in Python
 * 
 * @param model Model name (e.g., 'gpt-3.5-turbo')
 * @param promptTokens Number of prompt tokens (used for total calculation)
 * @param completionTokens Number of completion tokens (used for total calculation)
 * @returns [promptCostPerToken, completionCostPerToken] - Cost per token for prompt and completion
 */
export function costPerToken(
  model: string,
  promptTokens: number = 1,
  completionTokens: number = 1
): [number, number] {
  // Find the model in our mapping, or use default costs
  const normalizedModel = model.toLowerCase();
  const modelCosts = MODEL_COSTS[normalizedModel] || MODEL_COSTS['default'];
  
  // Calculate cost per token (convert from cost per 1000 tokens)
  const promptCostPerToken = modelCosts.prompt / 1000;
  const completionCostPerToken = modelCosts.completion / 1000;
  
  return [promptCostPerToken, completionCostPerToken];
}

/**
 * Calculate total token costs for a given model and token counts
 * 
 * @param model Model name (e.g., 'gpt-3.5-turbo')
 * @param promptTokens Number of prompt tokens
 * @param completionTokens Number of completion tokens
 * @returns Object with token counts and costs
 */
export function calculateTokenCosts(
  model: string,
  promptTokens: number,
  completionTokens: number
): TokenCostResult {
  try {
    // Get cost per token
    const [promptCostPerToken, completionCostPerToken] = costPerToken(model, promptTokens, completionTokens);
    
    // Calculate total costs
    const promptCost = promptCostPerToken * promptTokens;
    const completionCost = completionCostPerToken * completionTokens;
    const totalCost = promptCost + completionCost;
    
    return {
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      promptTokensCostUsd: promptCost,
      completionTokensCostUsd: completionCost,
      totalCostUsd: totalCost
    };
  } catch (error) {
    warn(`Error calculating token costs: ${error}`);
    // Return default values instead of null to match Python SDK
    return {
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      promptTokensCostUsd: 0,
      completionTokensCostUsd: 0,
      totalCostUsd: 0
    };
  }
}

/**
 * Token cost calculation result interface
 */
export interface TokenCostResult {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptTokensCostUsd: number;
  completionTokensCostUsd: number;
  totalCostUsd: number;
}
