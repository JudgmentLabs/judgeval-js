import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Collection of proprietary scorers implemented by Judgment.
 *
 * These are ready-made evaluation scorers that can be used to evaluate
 * Examples via the Judgment API.
 */
export enum APIScorer {
    FAITHFULNESS = 'faithfulness',
    ANSWER_RELEVANCY = 'answer_relevancy',
    ANSWER_CORRECTNESS = 'answer_correctness',
    HALLUCINATION = 'hallucination',
    SUMMARIZATION = 'summarization',
    CONTEXTUAL_RECALL = 'contextual_recall',
    CONTEXTUAL_RELEVANCY = 'contextual_relevancy',
    CONTEXTUAL_PRECISION = 'contextual_precision',
    INSTRUCTION_ADHERENCE = 'instruction_adherence',
    EXECUTION_ORDER = 'execution_order',
    JSON_CORRECTNESS = 'json_correctness',
    COMPARISON = 'comparison',
    GROUNDEDNESS = 'groundedness',
}

// Note: The Python version checks for case-insensitivity via _missing_.
// TypeScript enums don't have a direct equivalent built-in.
// Access needs to be case-sensitive, e.g., APIScorer.FAITHFULNESS.

// scorers whose scores are not bounded between 0-1
export const UNBOUNDED_SCORERS = new Set<APIScorer>([
    APIScorer.COMPARISON,
]);

// API URLs
export const ROOT_API = process.env.JUDGMENT_API_URL || 'https://api.judgmentlabs.ai';
export const JUDGMENT_EVAL_API_URL = `${ROOT_API}/evaluate/`;
export const JUDGMENT_DATASETS_PUSH_API_URL = `${ROOT_API}/datasets/push/`;
export const JUDGMENT_DATASETS_PULL_API_URL = `${ROOT_API}/datasets/pull/`;
export const JUDGMENT_DATASETS_DELETE_API_URL = `${ROOT_API}/datasets/delete/`;
export const JUDGMENT_DATASETS_EXPORT_JSONL_API_URL = `${ROOT_API}/datasets/export_jsonl/`;
export const JUDGMENT_DATASETS_PROJECT_STATS_API_URL = `${ROOT_API}/datasets/fetch_stats_by_project/`;
export const JUDGMENT_DATASETS_INSERT_API_URL = `${ROOT_API}/datasets/insert_examples/`;
export const JUDGMENT_EVAL_LOG_API_URL = `${ROOT_API}/log_eval_results/`;
export const JUDGMENT_EVAL_FETCH_API_URL = `${ROOT_API}/fetch_eval_results/`;
export const JUDGMENT_EVAL_DELETE_API_URL = `${ROOT_API}/delete_eval_results_by_project_and_run_names/`;
export const JUDGMENT_EVAL_DELETE_PROJECT_API_URL = `${ROOT_API}/delete_eval_results_by_project/`;
export const JUDGMENT_PROJECT_DELETE_API_URL = `${ROOT_API}/projects/delete/`;
export const JUDGMENT_PROJECT_CREATE_API_URL = `${ROOT_API}/projects/add/`;
export const JUDGMENT_TRACES_FETCH_API_URL = `${ROOT_API}/traces/fetch/`;
export const JUDGMENT_TRACES_SAVE_API_URL = `${ROOT_API}/traces/save/`;
export const JUDGMENT_TRACES_DELETE_API_URL = `${ROOT_API}/traces/delete/`;
export const JUDGMENT_TRACES_ADD_TO_EVAL_QUEUE_API_URL = `${ROOT_API}/traces/add_to_trace_eval_queue/`;
export const JUDGMENT_WEBSOCKET_URL = process.env.JUDGMENT_WEBSOCKET_URL || 'wss://api.judgmentlabs.ai/ws/traces/';
export const JUDGMENT_ADD_TO_RUN_EVAL_QUEUE_API_URL = `${ROOT_API}/add_to_run_eval_queue/`;

// RabbitMQ
export const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'rabbitmq-networklb-faa155df16ec9085.elb.us-west-1.amazonaws.com';
export const RABBITMQ_PORT = process.env.RABBITMQ_PORT ? parseInt(process.env.RABBITMQ_PORT, 10) : 5672;
export const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'task_queue';

// Models

// TODO: Review litellm equivalent in JS/TS.
// The Python code uses `litellm.model_list`.
// A JS library exists (@skadefro/litellm), but doesn't seem to expose model_list directly.
// For now, using an empty set.
export const LITELLM_SUPPORTED_MODELS = new Set<string>();

export const TOGETHER_SUPPORTED_MODELS: string[] = [
    "meta-llama/Meta-Llama-3-70B-Instruct-Turbo",
    "Qwen/Qwen2-VL-72B-Instruct",
    "meta-llama/Llama-Vision-Free",
    "Gryphe/MythoMax-L2-13b",
    "Qwen/Qwen2.5-72B-Instruct-Turbo",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "deepseek-ai/DeepSeek-R1",
    "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
    "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    "google/gemma-2-27b-it",
    "mistralai/Mistral-Small-24B-Instruct-2501",
    "mistralai/Mixtral-8x22B-Instruct-v0.1",
    "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
    "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo-classifier",
    "deepseek-ai/DeepSeek-V3",
    "Qwen/Qwen2-72B-Instruct",
    "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "upstage/SOLAR-10.7B-Instruct-v1.0",
    "togethercomputer/MoA-1",
    "Qwen/QwQ-32B-Preview",
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "databricks/dbrx-instruct",
    "meta-llama/Llama-3-8b-chat-hf",
    "google/gemma-2b-it",
    "meta-llama/Meta-Llama-3-70B-Instruct-Lite",
    "google/gemma-2-9b-it",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo-p",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "Gryphe/MythoMax-L2-13b-Lite",
    "meta-llama/Llama-2-7b-chat-hf",
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    "meta-llama/Llama-2-13b-chat-hf",
    "scb10x/scb10x-llama3-typhoon-v1-5-8b-instruct",
    "scb10x/scb10x-llama3-typhoon-v1-5x-4f316",
    "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "microsoft/WizardLM-2-8x22B",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "scb10x/scb10x-llama3-1-typhoon2-60256",
    "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "scb10x/scb10x-llama3-1-typhoon-18370",
    "meta-llama/Llama-3.2-3B-Instruct-Turbo",
    "meta-llama/Llama-3-70b-chat-hf",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "togethercomputer/MoA-1-Turbo",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
    "mistralai/Mistral-7B-Instruct-v0.1"
];

export const JUDGMENT_SUPPORTED_MODELS = new Set<string>(["osiris-large", "osiris-mini", "osiris"]);

// Combine model sets
export const ACCEPTABLE_MODELS = new Set<string>([
  ...LITELLM_SUPPORTED_MODELS,
  ...TOGETHER_SUPPORTED_MODELS,
  ...JUDGMENT_SUPPORTED_MODELS,
]);

// System settings
export const MAX_WORKER_THREADS = 10;

// Maximum number of concurrent operations for evaluation runs
export const MAX_CONCURRENT_EVALUATIONS = 50; // Adjust based on system capabilities 