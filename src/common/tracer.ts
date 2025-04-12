// Core Node.js imports
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

// Installed SDKs
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Together from 'together-ai'; // Use default import

// Local Imports
import {
    JUDGMENT_TRACES_SAVE_API_URL,
    JUDGMENT_TRACES_FETCH_API_URL,
    JUDGMENT_TRACES_DELETE_API_URL,
    JUDGMENT_TRACES_ADD_TO_EVAL_QUEUE_API_URL,
    // Add other necessary constants if needed
} from '../constants';

import { APIJudgmentScorer } from '../scorers/base-scorer';
import logger from './logger-instance'; // Use the shared winston logger instance
import { isPromise } from 'util/types';

// --- Type Aliases and Interfaces ---

// <<< NEW: Rule and Notification Types START >>>
// Configuration for notifications when a rule is triggered.
interface NotificationConfig {
    enabled?: boolean;
    communication_methods?: string[]; // e.g., ["email", "slack"]
    email_addresses?: string[];
    send_at?: number; // Unix timestamp for scheduled notifications
}

// Represents a single condition within a rule.
interface Condition {
    metric: APIJudgmentScorer; // Use the scorer object directly
}

// Defines how conditions within a rule are combined.
type CombineType = "all" | "any"; // 'all' = AND, 'any' = OR

// Represents a rule to be evaluated (likely by the backend).
interface Rule {
    rule_id?: string; // Optional client-side ID, backend might generate/use its own
    name: string;
    description?: string;
    conditions: Condition[];
    combine_type: CombineType;
    notification?: NotificationConfig;
}
// <<< NEW: Rule and Notification Types END >>>

type ApiClient = OpenAI | Anthropic | Together;
// type SpanType = 'span' | 'tool' | 'llm' | 'evaluation' | 'chain' | 'research';
type SpanType = string; // Allow any string

interface TraceEntry {
    type: 'enter' | 'exit' | 'input' | 'output' | 'error' | 'evaluation';
    function: string;
    span_id: string;
    depth: number;
    timestamp: number; // Unix timestamp (seconds)
    duration?: number; // Seconds
    output?: any;
    inputs?: Record<string, any>;
    span_type: SpanType;
    parent_span_id?: string;
    evaluation_runs?: any[]; // Placeholder for evaluation results
}

// <<< NEW: Interface for the Evaluation Run Payload START >>>
// Mirrors the structure needed for backend evaluation processing
interface EvaluationRunPayload {
    organization_id: string;
    log_results: boolean;
    project_name: string;
    eval_name: string;
    examples: { // Structure matching Python's Example within EvaluationRun
        input?: string;
        actual_output?: string;
        expected_output?: string;
        context?: string[];
        retrieval_context?: string[];
        tools_called?: string[];
        expected_tools?: string[];
        additional_metadata?: Record<string, any>;
        trace_id: string;
    }[];
    scorers: APIJudgmentScorer[]; // Assuming only API scorers for now
    model?: string;
    metadata?: Record<string, any>;
    judgment_api_key: string;
    override?: boolean;
    rules?: Rule[]; // Rules associated with this specific eval run
}
// <<< NEW: Interface for the Evaluation Run Payload END >>>

// Interface for the data structure sent to the save endpoint
interface TraceSavePayload {
    trace_id: string;
    name: string;
    project_name: string;
    created_at: string; // ISO format timestamp
    duration: number;
    token_counts: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_tokens_cost_usd: number;
        completion_tokens_cost_usd: number;
        total_cost_usd: number;
    };
    entries: CondensedSpanEntry[];
    rules?: Record<string, Rule>;
    empty_save: boolean;
    overwrite: boolean;
    parent_trace_id?: string | null;
    parent_name?: string | null;
}

// Define the structure for a condensed span entry
interface CondensedSpanEntry {
    span_id: string;
    function: string;
    depth: number;
    timestamp: number; // Start timestamp of the span
    parent_span_id?: string | null;
    span_type: SpanType;
    inputs: Record<string, any> | null;
    output: any | null;
    evaluation_runs: any[]; // Array of evaluation results
    duration: number | null; // Duration in seconds
    // Add children property for hierarchical structure
    children?: CondensedSpanEntry[];
}

// --- API Interaction Client ---

/**
 * Client for interacting with Judgment trace API endpoints.
 */
class TraceManagerClient {
    private apiKey: string;
    private organizationId: string;

    constructor(apiKey: string, organizationId: string) {
        if (!apiKey) {
            throw new Error("TraceManagerClient requires a Judgment API key.");
        }
        if (!organizationId) {
            throw new Error("TraceManagerClient requires a Judgment Organization ID.");
        }
        this.apiKey = apiKey;
        this.organizationId = organizationId;
    }

    private async _fetch(url: string, options: RequestInit = {}): Promise<any> {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Organization-Id': this.organizationId,
            ...(options.headers || {}),
        };

        try {
            // Use isomorphic fetch (available globally in modern Node.js and browsers)
            const response = await fetch(url, {
                ...options,
                headers: headers,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`API Error (${response.status}) for ${options.method || 'GET'} ${url}: ${errorBody}`);
                throw new Error(`Judgment API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            // Handle cases where the response might be empty (e.g., 204 No Content on DELETE)
            if (response.status === 204) {
                return null; // Indicate success with no content
            }

            return await response.json();
        } catch (error) {
            console.error(`Network or fetch error during ${options.method || 'GET'} ${url}:`, error);
            // Re-throw or handle as appropriate for the application context
            throw error;
        }
    }

    async fetchTrace(traceId: string): Promise<any> {
        return this._fetch(JUDGMENT_TRACES_FETCH_API_URL, {
            method: 'POST',
            body: JSON.stringify({ trace_id: traceId }),
        });
    }

    async saveTrace(traceData: TraceSavePayload, emptySave: boolean): Promise<any> {
         const response = await this._fetch(JUDGMENT_TRACES_SAVE_API_URL, {
             method: 'POST',
             body: JSON.stringify(traceData),
         });

         // Optionally log the UI URL like the Python version
         if (!emptySave && response?.ui_results_url) {
              // Use console.info or a dedicated logger for user-facing messages
              // Note: We can't replicate Rich library's colored link easily in standard console
              console.info(`
🔍 View trace: ${response.ui_results_url}
`);
         }
         return response;
    }

    async deleteTrace(traceId: string): Promise<any> {
        // Assuming DELETE method is correct based on REST principles for the delete endpoint
        return this._fetch(JUDGMENT_TRACES_DELETE_API_URL, {
            method: 'DELETE',
            body: JSON.stringify({ trace_ids: [traceId] }),
        });
    }

    async deleteTraces(traceIds: string[]): Promise<any> {
         return this._fetch(JUDGMENT_TRACES_DELETE_API_URL, {
             method: 'DELETE',
             body: JSON.stringify({ trace_ids: traceIds }),
         });
     }

    async addTraceToEvalQueue(traceData: TraceSavePayload): Promise<any> {
        // Ensure traceData has the necessary structure for the queue endpoint
        return this._fetch(JUDGMENT_TRACES_ADD_TO_EVAL_QUEUE_API_URL, {
            method: 'POST',
            body: JSON.stringify(traceData), // Send the full trace data as per Python impl
        });
    }

     // deleteProject method can be added here if needed, similar to Python client
     // async deleteProject(projectName: string): Promise<any> { ... }
}

// --- Helper Functions ---

// Helper function to sanitize names (e.g., replace spaces with underscores)
function sanitizeName(name: string): string {
    // Replace spaces with underscores and remove potentially problematic characters
    // You can adjust the regex further if other characters cause issues.
    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
}

// --- Core Trace Classes ---

/**
 * Represents an ongoing trace context.
 */
class TraceClient {
    public readonly traceId: string;
    public readonly name: string; // This will now store the sanitized name
    public readonly projectName: string;
    public readonly overwrite: boolean;
    public readonly rules: Rule[];
    public readonly enableMonitoring: boolean;
    public readonly enableEvaluations: boolean;
    public readonly parentTraceId?: string | null;
    public readonly parentName?: string | null;

    // Internal state
    public entries: Partial<TraceEntry>[] = [];
    public spanDepths: Record<string, number> = {};
    private startTime: number; // Unix timestamp (seconds)
    private traceManager: TraceManagerClient | null = null; // Can be null if monitoring disabled
    private apiKey: string;
    private organizationId: string;
    private originalName: string; // Keep the original name if needed for display purposes
    private currentSpanId?: string;

    constructor(
         config: {
             tracer: Tracer,
             traceId?: string,
             name?: string,
             projectName?: string,
             overwrite?: boolean,
             rules?: Rule[],
             enableMonitoring?: boolean,
             enableEvaluations?: boolean,
             parentTraceId?: string | null,
             parentName?: string | null,
             apiKey: string,
             organizationId: string
         }
    ) {
         this.traceId = config.traceId || uuidv4();
         this.originalName = config.name || 'default_trace'; // Store original
         this.name = sanitizeName(this.originalName); // Use sanitized name internally
         // If the sanitized name is empty, fallback to a default
         if (!this.name) {
             console.warn(`Original trace name "${this.originalName}" sanitized to empty string. Using default_trace_${this.traceId.substring(0, 8)}.`);
             this.name = `default_trace_${this.traceId.substring(0, 8)}`;
         }
         this.projectName = config.projectName ?? config.tracer.projectName;
         this.overwrite = config.overwrite ?? false;
         this.rules = config.rules ?? [];
         // Determine effective monitoring status based on tracer and API keys
         let effectiveMonitoring = config.enableMonitoring ?? config.tracer.enableMonitoring;
         if (effectiveMonitoring && (!config.apiKey || !config.organizationId)) {
             console.warn(`TraceClient ${this.traceId}: Monitoring requires JUDGMENT_API_KEY and JUDGMENT_ORG_ID. Disabling monitoring for this trace.`);
             effectiveMonitoring = false;
         }
         this.enableMonitoring = effectiveMonitoring;
         // Evaluations depend on monitoring
         this.enableEvaluations = effectiveMonitoring && (config.enableEvaluations ?? config.tracer.enableEvaluations);

         this.parentTraceId = config.parentTraceId;
         this.parentName = config.parentName;
         this.apiKey = config.apiKey;
         this.organizationId = config.organizationId;
         this.startTime = Date.now() / 1000;

         if (this.enableMonitoring) {
              this.traceManager = new TraceManagerClient(this.apiKey, this.organizationId);
         }
    }

    addEntry(entry: Partial<TraceEntry>): void {
        if (!this.enableMonitoring) return;
        entry.timestamp = entry.timestamp || Date.now() / 1000;
        this.entries.push(entry);
    }

    recordInput(inputs: any): void {
        const spanId = this.currentSpanId;
        if (!spanId || !this.enableMonitoring) return;

        const enterEntry = this.entries.find(e => e.span_id === spanId && e.type === 'enter');
        const functionName = enterEntry?.function || 'unknown_function';
        const depth = enterEntry?.depth ?? this.spanDepths[spanId] ?? 0;
        const spanType = enterEntry?.span_type || 'span';

        this.addEntry({
             type: 'input',
             span_id: spanId,
             inputs,
             function: functionName,
             depth: depth,
             span_type: spanType
         });
    }

    recordOutput(output: any): void {
        const spanId = this.currentSpanId;
        if (!spanId || !this.enableMonitoring) return;

        const enterEntry = this.entries.find(e => e.span_id === spanId && e.type === 'enter');
        const functionName = enterEntry?.function || 'unknown_function';
        const depth = enterEntry?.depth ?? this.spanDepths[spanId] ?? 0;
        const spanType = enterEntry?.span_type || 'span';

        let entryType: TraceEntry['type'] = 'output';
        let outputData = output;
        if (output instanceof Error) {
            entryType = 'error';
            outputData = {
                 name: output.name,
                 message: output.message,
                 stack: output.stack?.substring(0, 1000)
            };
        } else if (output?.error) {
             entryType = 'error';
             outputData = output;
        }


        this.addEntry({
             type: entryType,
             span_id: spanId,
             output: outputData,
             function: functionName,
             depth: depth,
             span_type: spanType
         });
    }

    *span(
        name: string,
        options: {
            spanType?: SpanType
        } = {}
    ): Generator<TraceClient> {
        if (!this.enableMonitoring) {
            yield this;
        } else {
            const startTime = Date.now() / 1000;
            const spanId = uuidv4();
            const parentSpanId = this.currentSpanId;
            const spanType = options.spanType || 'span';

            let currentDepth = 0;
            if (parentSpanId && this.spanDepths[parentSpanId] !== undefined) {
                currentDepth = this.spanDepths[parentSpanId] + 1;
            }
            this.spanDepths[spanId] = currentDepth;

            this.addEntry({
                type: 'enter',
                function: name,
                span_id: spanId,
                depth: currentDepth,
                timestamp: startTime,
                span_type: spanType,
                parent_span_id: parentSpanId
            });

            this.currentSpanId = spanId;
            yield this;
            this.currentSpanId = parentSpanId;

            const endTime = Date.now() / 1000;
            const duration = endTime - startTime;
            this.addEntry({
                type: 'exit',
                function: name,
                span_id: spanId,
                depth: currentDepth,
                timestamp: endTime,
                duration: duration,
                span_type: spanType
            });

            delete this.spanDepths[spanId];
        }
    }

    getDuration(): number {
         return (Date.now() / 1000) - this.startTime;
     }

     private condenseTrace(rawEntries: Partial<TraceEntry>[]): CondensedSpanEntry[] {
         const spansById: Record<string, CondensedSpanEntry & { start_time?: number; end_time?: number }> = {};

         for (const entry of rawEntries) {
             const spanId = entry.span_id;
             if (!spanId) continue;

             if (!spansById[spanId]) {
                 spansById[spanId] = {
                     span_id: spanId,
                     function: entry.function || 'unknown',
                     depth: entry.depth ?? 0,
                     timestamp: entry.timestamp ?? 0,
                     parent_span_id: entry.parent_span_id,
                     span_type: entry.span_type || 'span',
                     inputs: null,
                     output: null,
                     evaluation_runs: [],
                     duration: null,
                     children: []
                 };
             }

             const currentSpanData = spansById[spanId];

             switch (entry.type) {
                 case 'enter':
                     currentSpanData.function = entry.function || currentSpanData.function;
                     currentSpanData.depth = entry.depth ?? currentSpanData.depth;
                     currentSpanData.timestamp = entry.timestamp ?? currentSpanData.timestamp;
                     currentSpanData.parent_span_id = entry.parent_span_id;
                     currentSpanData.span_type = entry.span_type || currentSpanData.span_type;
                     currentSpanData.start_time = entry.timestamp;
                     break;
                 case 'exit':
                     currentSpanData.duration = entry.duration ?? currentSpanData.duration;
                     currentSpanData.end_time = entry.timestamp;
                     if (currentSpanData.duration === null && currentSpanData.start_time && currentSpanData.end_time) {
                          currentSpanData.duration = currentSpanData.end_time - currentSpanData.start_time;
                     }
                     break;
                 case 'input':
                     if (currentSpanData.inputs === null && entry.inputs) {
                         currentSpanData.inputs = entry.inputs;
                     } else if (typeof currentSpanData.inputs === 'object' && typeof entry.inputs === 'object') {
                         currentSpanData.inputs = { ...currentSpanData.inputs, ...entry.inputs };
                     }
                     break;
                 case 'output':
                 case 'error':
                     currentSpanData.output = entry.output;
                     break;
                 case 'evaluation':
                     if (entry.evaluation_runs) {
                         currentSpanData.evaluation_runs.push(...entry.evaluation_runs);
                     }
                     break;
             }
         }

         const spansList = Object.values(spansById).map(span => {
              if (span.duration === null && span.start_time && span.end_time) {
                  span.duration = span.end_time - span.start_time;
              }
             delete span.start_time;
             delete span.end_time;
             return span as CondensedSpanEntry;
         });

         const childrenMap: Record<string, CondensedSpanEntry[]> = {};
         const roots: CondensedSpanEntry[] = [];
         const spanMap: Record<string, CondensedSpanEntry> = {};
         const sortedCondensedList: CondensedSpanEntry[] = [];
         const visited = new Set<string>();

         for (const span of spansList) {
             spanMap[span.span_id] = span;
             const parentId = span.parent_span_id;
             if (parentId === undefined || parentId === null) {
                 roots.push(span);
             } else {
                 if (!childrenMap[parentId]) {
                     childrenMap[parentId] = [];
                 }
                 childrenMap[parentId].push(span);
             }
         }

         roots.sort((a, b) => a.timestamp - b.timestamp);
         for (const parentId in childrenMap) {
             childrenMap[parentId].sort((a, b) => a.timestamp - b.timestamp);
         }

         function buildFlatListDfs(span: CondensedSpanEntry) {
             if (visited.has(span.span_id)) return;
             visited.add(span.span_id);
             sortedCondensedList.push(span);

             const children = childrenMap[span.span_id] || [];
             for (const child of children) {
                 buildFlatListDfs(child);
             }
         }

         for (const rootSpan of roots) {
             buildFlatListDfs(rootSpan);
         }

         for (const span of spansList) {
             if (!visited.has(span.span_id)) {
                 console.warn(`Orphaned span detected: ${span.span_id}, adding to end of list.`);
                 buildFlatListDfs(span);
             }
         }

         return sortedCondensedList;
     }

     async save(emptySave: boolean = false): Promise<{ traceId: string; traceData: TraceSavePayload } | null> {
         if (!this.enableMonitoring || !this.traceManager) {
              return null;
         }

         const totalDuration = this.getDuration();
         const condensedEntries: CondensedSpanEntry[] = this.condenseTrace(this.entries);

         const tokenCounts = {
             prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
             prompt_tokens_cost_usd: 0.0, completion_tokens_cost_usd: 0.0, total_cost_usd: 0.0
         };
         condensedEntries.forEach(entry => {
             if (entry.span_type === 'llm' && entry.output?.usage) {
                 const usage = entry.output.usage;
                 let promptTokens = 0;
                 let completionTokens = 0;

                 if (usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined) {
                     promptTokens = usage.prompt_tokens || 0;
                     completionTokens = usage.completion_tokens || 0;
                 } else if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
                     promptTokens = usage.input_tokens || 0;
                     completionTokens = usage.output_tokens || 0;
                     usage.prompt_tokens = promptTokens;
                     usage.completion_tokens = completionTokens;
                     delete usage.input_tokens;
                     delete usage.output_tokens;
                 }
                 tokenCounts.prompt_tokens += promptTokens;
                 tokenCounts.completion_tokens += completionTokens;
                 tokenCounts.total_tokens += usage.total_tokens || (promptTokens + completionTokens);

                 const modelName = entry.inputs?.model || "";
                 if (modelName) {
                      try {
                          const promptCost = 0.0;
                          const completionCost = 0.0;
                          const callTotalCost = promptCost + completionCost;

                          usage.prompt_tokens_cost_usd = promptCost;
                          usage.completion_tokens_cost_usd = completionCost;
                          usage.total_cost_usd = callTotalCost;

                          tokenCounts.prompt_tokens_cost_usd += promptCost;
                          tokenCounts.completion_tokens_cost_usd += completionCost;
                          tokenCounts.total_cost_usd += callTotalCost;
                      } catch (e) {
                          console.warn(`Error calculating cost for model '${modelName}':`, e);
                          usage.prompt_tokens_cost_usd = null;
                          usage.completion_tokens_cost_usd = null;
                          usage.total_cost_usd = null;
                      }
                 } else {
                      usage.prompt_tokens_cost_usd = null;
                      usage.completion_tokens_cost_usd = null;
                      usage.total_cost_usd = null;
                 }
             }
         });

         // Convert rules array to a dictionary (Record<string, Rule>)
         const rulesDict: Record<string, Rule> = {};
         this.rules.forEach(rule => {
             // Use rule_id if available, otherwise fallback to name
             const key = rule.rule_id ?? rule.name;
             rulesDict[key] = rule;
         });

         const traceData: TraceSavePayload = {
             trace_id: this.traceId,
             name: this.name,
             project_name: this.projectName,
             created_at: new Date(this.startTime * 1000).toISOString(),
             duration: totalDuration,
             token_counts: tokenCounts,
             entries: condensedEntries,
             rules: rulesDict,
             empty_save: emptySave,
             overwrite: this.overwrite,
             parent_trace_id: this.parentTraceId,
             parent_name: this.parentName
         };

         try {
             await this.traceManager.saveTrace(traceData, emptySave);
             logger.info(`Trace ${this.traceId} saved successfully.`);

             if (!emptySave && this.enableEvaluations) {
                 try {
                     await this.traceManager.addTraceToEvalQueue(traceData);
                     logger.info(`Trace ${this.traceId} added to evaluation queue.`);
                 } catch (evalError) {
                     logger.warn(`Failed to add trace ${this.traceId} to evaluation queue.`, { error: evalError instanceof Error ? evalError.message : String(evalError) });
                 }
             }
             return { traceId: this.traceId, traceData };
         } catch (error) {
             logger.error(`Failed to save trace ${this.traceId}.`, { error: error instanceof Error ? error.message : String(error) });
              return null;
         }
     }

     print(): void {
         if (!this.enableMonitoring) {
             // Keep console.log for direct user output when print() is called
             console.log("Monitoring was disabled. No trace entries recorded.");
             return;
         }
         if (this.entries.length === 0) {
             // Keep console.log for direct user output when print() is called
             console.log("No trace entries recorded.");
             return;
         }
 
         // Keep console.log for direct user output when print() is called
         console.log(`\n--- Trace Details: ${this.name} (ID: ${this.traceId}) ---`);
 
         this.entries.forEach(entry => {
             const indent = "  ".repeat(entry.depth ?? 0);
             const timeStr = entry.timestamp ? `@ ${new Date(entry.timestamp * 1000).toISOString()}` : '';
             const shortSpanId = entry.span_id ? `(id: ${entry.span_id.substring(0, 8)}...)` : '';
             const shortParentId = entry.parent_span_id ? `(parent: ${entry.parent_span_id.substring(0, 8)}...)` : '';
 
             try {
                 switch (entry.type) {
                     case 'enter':
                         console.log(`${indent}→ ${entry.function || 'unknown'} ${shortSpanId} ${shortParentId} [${entry.span_type || 'span'}] ${timeStr}`);
                         break;
                     case 'exit':
                         const durationStr = entry.duration !== undefined ? `(${entry.duration.toFixed(3)}s)` : '';
                         // Keep console.log
                         console.log(`${indent}← ${entry.function || 'unknown'} ${shortSpanId} ${durationStr} ${timeStr}`);
                         break;
                     case 'input':
                         let inputStr = JSON.stringify(entry.inputs);
                         if (inputStr && inputStr.length > 200) { inputStr = inputStr.substring(0, 197) + '...'; }
                          // Keep console.log
                         console.log(`${indent}  Input (for ${shortSpanId}): ${inputStr || '{}'}`);
                         break;
                     case 'output':
                     case 'error':
                         let outputStr = JSON.stringify(entry.output);
                         if (outputStr && outputStr.length > 200) { outputStr = outputStr.substring(0, 197) + '...'; }
                         const prefix = entry.type === 'error' ? 'Error' : 'Output';
                          // Keep console.log
                         console.log(`${indent}  ${prefix} (for ${shortSpanId}): ${outputStr || 'null'}`);
                         break;
                     case 'evaluation':
                         let evalStr = JSON.stringify(entry.evaluation_runs);
                          if (evalStr && evalStr.length > 200) { evalStr = evalStr.substring(0, 197) + '...'; }
                          // Keep console.log
                         console.log(`${indent}  Evaluation (for ${shortSpanId}): ${evalStr || '[]'}`);
                         break;
                     default:
                          // Keep console.log
                         console.log(`${indent}? Unknown entry type: ${JSON.stringify(entry)}`);
                 }
             } catch (stringifyError) {
                  const errorMessage = stringifyError instanceof Error ? stringifyError.message : String(stringifyError);
                   // Keep console.log
                  console.log(`${indent}! Error formatting entry: ${errorMessage}`);
                  console.log(`${indent}  Raw entry:`, entry);
             }
         });
          // Keep console.log
         console.log(`--- End Trace: ${this.name} ---`);
     }

     async delete(): Promise<any> {
         if (!this.enableMonitoring || !this.traceManager) {
              logger.warn(`Cannot delete trace ${this.traceId}, monitoring disabled or manager missing.`);
              return null;
         }
         try {
             const result = await this.traceManager.deleteTrace(this.traceId);
             logger.info(`Trace ${this.traceId} deleted successfully.`);
             return result;
         } catch (error) {
             logger.error(`Failed to delete trace ${this.traceId}.`, { error: error instanceof Error ? error.message : String(error) });
             throw error; // Re-throw after logging
         }
     }

    /**
     * Asynchronously evaluate an example using the provided scorers,
     * embedding the evaluation request into the trace data.
     * Ported from the Python SDK's async_evaluate method.
     *
     * @param scorers Array of scorers to use for evaluation (currently assumes APIJudgmentScorer)
     * @param options Evaluation options including input, outputs, and metadata
     * @returns Promise that resolves when the evaluation entry has been added to the trace
     */
    async asyncEvaluate(
        // TODO: Allow JudgevalScorer type if rules are not used?
        scorers: APIJudgmentScorer[],
        options: {
            input?: string;
            actualOutput?: string;
            expectedOutput?: string;
            context?: string[];
            retrievalContext?: string[];
            toolsCalled?: string[];
            expectedTools?: string[];
            additionalMetadata?: Record<string, any>;
            model?: string;
            logResults?: boolean;
        } = {}
    ): Promise<void> {
        if (!this.enableEvaluations) {
            logger.warn("Evaluations are disabled. Skipping async evaluation.");
            return;
        }
        if (!scorers || scorers.length === 0) {
            logger.warn("No scorers provided. Skipping async evaluation.");
            return;
        }

        const startTime = Date.now() / 1000; // Record start time in seconds

        // Create example structure matching Python/backend expectations
        const example = {
            input: options.input || "",
            actual_output: options.actualOutput || "",
            expected_output: options.expectedOutput || "",
            context: options.context || [],
            retrieval_context: options.retrievalContext || [],
            tools_called: options.toolsCalled || [],
            expected_tools: options.expectedTools || [],
            additional_metadata: options.additionalMetadata || {},
            trace_id: this.traceId
        };

        try {
            // Get the current span ID from the context
            const currentSpanId = this.currentSpanId;
            if (!currentSpanId) {
                logger.warn("No active span found for async evaluation. Evaluation will not be associated with a specific step.");
                // Decide if we should proceed or return. For now, proceed without span association.
                // return;
            }

            // Determine function name and depth (best effort if spanId is missing)
            let functionName = "unknown_function";
            let entrySpanType = "evaluation";
            let currentDepth = 0;
            if (currentSpanId) {
                currentDepth = this.spanDepths[currentSpanId] ?? 0;
                for (let i = this.entries.length - 1; i >= 0; i--) {
                    const entry = this.entries[i];
                    if (entry.span_id === currentSpanId && entry.type === 'enter') {
                        functionName = entry.function || "unknown_function";
                        // Keep span_type as 'evaluation' for the entry itself
                        break;
                    }
                }
            }

            // --- Create evaluation run name (similar to Python) ---
            // Capitalize scorer names
            const scorerNames = scorers.map(scorer => {
                // Attempt to get score_type, fallback to class name or Unknown
                const name = scorer?.scoreType || scorer?.constructor?.name || "Unknown";
                return name.charAt(0).toUpperCase() + name.slice(1);
            }).join(',');
            // Use trace name and shortened span ID (or trace ID if no span)
            const idPart = currentSpanId ? currentSpanId.substring(0, 8) : this.traceId.substring(0, 8);
            const evalName = `${this.name.charAt(0).toUpperCase() + this.name.slice(1)}-${idPart}-[${scorerNames}]`;
            // --- End eval name creation ---

            // Process rules (currently just using this.rules directly)
            const loadedRules = this.rules; // TODO: Add ScorerWrapper-like processing if needed in TS

            // Construct the evaluation payload
            const evalRunPayload: EvaluationRunPayload = {
                organization_id: this.organizationId,
                log_results: options.logResults !== false, // Default to true
                project_name: this.projectName,
                eval_name: evalName,
                examples: [example],
                scorers: scorers, // Pass scorers directly
                model: options.model || "",
                metadata: {}, // Matches Python tracer
                judgment_api_key: this.apiKey,
                override: this.overwrite, // Use trace's overwrite setting
                rules: loadedRules // Pass the processed rules
            };

            // Add evaluation entry using the helper method
            this._addEvalRun(evalRunPayload, startTime);

        } catch (error) {
            console.error(`Failed during asyncEvaluate execution: ${error instanceof Error ? error.message : String(error)}`);
            // Decide if we should re-throw or just log
        }
    }

    /**
     * Private helper to add an evaluation entry to the trace.
     * This mirrors the structure of Python's add_eval_run.
     *
     * @param evalRunPayload The constructed payload for the evaluation.
     * @param startTime The start time (in seconds) of the evaluation process.
     */
    private _addEvalRun(evalRunPayload: EvaluationRunPayload, startTime: number): void {
        const currentSpanId = this.currentSpanId;
        if (!currentSpanId) {
            // If no span ID, the evaluation entry won't be linked to a specific span
            // This might happen if asyncEvaluate is called outside a runInSpan context
            console.warn("Adding evaluation entry without an active span ID.");
        }

        let functionName = "unknown_function";
        let currentDepth = 0; // Default depth if no span

        if (currentSpanId) {
            currentDepth = this.spanDepths[currentSpanId] ?? 0;
            // Find the function name associated with the current span_id
            for (let i = this.entries.length - 1; i >= 0; i--) {
                const entry = this.entries[i];
                if (entry.span_id === currentSpanId && entry.type === 'enter') {
                    functionName = entry.function || "unknown_function";
                    break;
                }
            }
        }

        const duration = (Date.now() / 1000) - startTime;

        // Add evaluation entry to the trace
        this.addEntry({
            type: "evaluation",
            function: functionName,
            span_id: currentSpanId, // May be undefined
            depth: currentDepth,
            timestamp: Date.now() / 1000,
            evaluation_runs: [evalRunPayload], // Embed the payload
            duration: duration,
            span_type: "evaluation"
        });
    }

    // OPTIONAL: Add a method to get the original name if needed elsewhere
    getOriginalName(): string {
        return this.originalName;
    }
}

/**
 * Singleton Tracer class. Manages overall tracing configuration and trace creation.
 */
class Tracer {
    private static instance: Tracer;
    public readonly apiKey: string;
    public readonly organizationId: string;
    public readonly projectName: string;
    public readonly defaultRules: Rule[];
    public readonly enableMonitoring: boolean;
    public readonly enableEvaluations: boolean;
    private initialized: boolean = false;
    private currentTrace?: TraceClient;

    private constructor(config?: {
         apiKey?: string,
         organizationId?: string,
         projectName?: string,
         rules?: Rule[],
         enableMonitoring?: boolean,
         enableEvaluations?: boolean
    }) {
         const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

         const envApiKey = isNode ? process.env?.JUDGMENT_API_KEY : undefined;
         const envOrgId = isNode ? process.env?.JUDGMENT_ORG_ID : undefined;
         const envProjectName = isNode ? process.env?.JUDGMENT_PROJECT_NAME : undefined;
         const envMonitoring = isNode ? process.env?.JUDGMENT_MONITORING : 'true';
         const envEvaluations = isNode ? process.env?.JUDGMENT_EVALUATIONS : 'true';

         this.apiKey = config?.apiKey ?? envApiKey ?? '';
         this.organizationId = config?.organizationId ?? envOrgId ?? '';
         this.projectName = config?.projectName ?? envProjectName ?? 'default_project';
         this.defaultRules = config?.rules ?? [];

         let effectiveMonitoring = config?.enableMonitoring ?? (envMonitoring?.toLowerCase() !== 'false');
         if (effectiveMonitoring && (!this.apiKey || !this.organizationId)) {
             console.warn("JUDGMENT_API_KEY or JUDGMENT_ORG_ID missing. Monitoring disabled.");
             effectiveMonitoring = false;
         }
         this.enableMonitoring = effectiveMonitoring;
         this.enableEvaluations = effectiveMonitoring && (config?.enableEvaluations ?? (envEvaluations?.toLowerCase() !== 'false'));

         this.initialized = true;
    }

    public static getInstance(config?: {
         apiKey?: string,
         organizationId?: string,
         projectName?: string,
         rules?: Rule[],
         enableMonitoring?: boolean,
         enableEvaluations?: boolean
     }): Tracer {
        if (!Tracer.instance) {
            Tracer.instance = new Tracer(config);
        } else if (config && !Tracer.instance.initialized) {
             console.warn("Tracer getInstance called with config after implicit initialization. Re-initializing.");
             Tracer.instance = new Tracer(config);
        } else if (config && Tracer.instance.initialized) {
             if (config.projectName && config.projectName !== Tracer.instance.projectName) {
                 console.warn(`Attempting to re-initialize Tracer with different project_name. Original will be used: '${Tracer.instance.projectName}'.`);
             }
             if (config.rules && config.rules.length > 0 && Tracer.instance.defaultRules.length === 0) {
                try {
                    console.warn("Setting default rules on Tracer instance after initial creation.");
                    (Tracer.instance as { -readonly [K in keyof Tracer]: Tracer[K] }).defaultRules = config.rules;
                } catch (e) {
                    console.error("Failed to set default rules after tracer initialization:", e);
                }
             } else if (config.rules && JSON.stringify(config.rules) !== JSON.stringify(Tracer.instance.defaultRules)) {
                  console.warn("Attempting to change default rules on Tracer after initialization. Original rules will be used.");
             }
        }
        return Tracer.instance;
    }

    getCurrentTrace(): TraceClient | undefined {
        return this.currentTrace;
    }

     private _startTraceInternal(config: {
         name: string,
         projectName?: string,
         overwrite?: boolean,
         rules?: Rule[]
     }): TraceClient {
         const parentTrace = this.getCurrentTrace();

         const traceSpecificRules = config.rules ?? [];
         const effectiveRulesMap = new Map<string, Rule>();
         this.defaultRules.forEach(rule => effectiveRulesMap.set(rule.rule_id ?? rule.name, rule));
         traceSpecificRules.forEach(rule => effectiveRulesMap.set(rule.rule_id ?? rule.name, rule));
         const effectiveRules = Array.from(effectiveRulesMap.values());

         const traceClient = new TraceClient({
             tracer: this,
             name: config.name,
             projectName: config.projectName ?? this.projectName,
             overwrite: config.overwrite,
             rules: effectiveRules,
             enableMonitoring: this.enableMonitoring,
             enableEvaluations: this.enableEvaluations,
             parentTraceId: parentTrace?.traceId,
             parentName: parentTrace?.name,
             apiKey: this.apiKey,
             organizationId: this.organizationId,
         });

         if (traceClient.enableMonitoring) {
              traceClient.save(true).catch(err => {
                   console.error(`>>> Tracer: Error saving empty trace for ${traceClient.traceId}:`, err);
              });
         }

         return traceClient;
     }

     *trace(
        name: string,
        options: {
            projectName?: string,
            overwrite?: boolean,
            createRootSpan?: boolean,
            rules?: Rule[]
        } = {}
    ): Generator<TraceClient> {
        const trace = this._startTraceInternal({ name, ...options });
        const shouldCreateRootSpan = options.createRootSpan ?? true;
        const prevTrace = this.currentTrace;

        if (shouldCreateRootSpan) {
            for (const span of trace.span(name, { spanType: 'chain' })) {
                this.currentTrace = trace;
                yield trace;
                this.currentTrace = prevTrace;
            }
        } else {
            this.currentTrace = trace;
            yield trace;
            this.currentTrace = prevTrace;
        }

        if (trace.enableMonitoring) {
            trace.save(false).catch(saveErr => {
                console.error(`Failed to save completed trace '${name}' (${trace.traceId}):`, saveErr);
            });
        }
     }

     observe<T extends (...args: any[]) => any>(options?: {
         name?: string;
         spanType?: SpanType;
     }): (func: T) => T {
         if (!this.enableMonitoring) {
             return (func: T): T => func;
         }

         return (func: T): T => {
             const spanName = options?.name || func.name || 'anonymous_function';
             const spanType = options?.spanType || 'span';

             return ((async (...args) => {
                 const currentTrace = this.getCurrentTrace();

                 if (!currentTrace) {
                    for (const trace of this.trace(spanName, { createRootSpan: false })) {
                        for (const span of trace.span(spanName, { spanType })) {
                            span.recordInput({ args: args });
                            try {
                                span.recordOutput(await func(...args));
                            } catch (error) {
                                span.recordOutput({ error });
                                throw error;
                            }
                        }
                    }
                } else {
                    for (const span of currentTrace.span(spanName, { spanType })) {
                        span.recordInput({ args: args });
                        try {
                            span.recordOutput(await func(...args));
                        } catch (error) {
                            span.recordOutput({ error });
                            throw error;
                        }
                    }
                }
             }) as T).bind(func) as T;
         };
     }
}

// --- Helper Functions for Wrapping LLM Clients --- //

function _getClientConfig(client: ApiClient): { spanName: string; originalMethod: (...args: any[]) => any } | null {
    if (client instanceof OpenAI && typeof client?.chat?.completions?.create === 'function') {
        return { spanName: "OPENAI_API_CALL", originalMethod: client.chat.completions.create.bind(client.chat.completions) };
    } else if (client instanceof Anthropic && typeof client?.messages?.create === 'function') {
        return { spanName: "ANTHROPIC_API_CALL", originalMethod: client.messages.create.bind(client.messages) };
    }
    // Use type assertion for older Together AI version
    else if (client instanceof Together && typeof (client as any)?.completions?.create === 'function') { 
        return { spanName: "TOGETHER_API_CALL", originalMethod: (client as any).completions.create.bind((client as any).completions) }; 
    }
    logger.warn("Cannot wrap client: Unsupported type or incompatible SDK structure.", { clientType: client?.constructor?.name });
    return null;
}

function _formatInputData(client: ApiClient, args: any[]): Record<string, any> {
    const params = args[0] || {};
    try {
        // Handle Together client potentially having different input structure
        if (client instanceof OpenAI || client instanceof Together) {
            return { model: params.model, messages: params.messages, /* other potential params */ } as Record<string, any>;
        } else if (client instanceof Anthropic) {
             return { model: params.model, messages: params.messages, max_tokens: params.max_tokens, } as Record<string, any>;
        }
    } catch (e) {
         logger.error("Error formatting LLM input:", { error: e instanceof Error ? e.message : String(e), params });
         return { raw_params: params } as Record<string, any>;
    }
    return { raw_params: params } as Record<string, any>;
}

function _formatOutputData(client: ApiClient, response: any): Record<string, any> {
     try {
          // Separate handling for OpenAI and Together, assuming Together might differ
          if (client instanceof OpenAI && response?.choices?.[0]?.message) {
              const message = response.choices[0].message;
              return { content: message.content, usage: response.usage, };
          } else if (client instanceof Together && response?.choices?.[0]?.message) {
              // Assume Together v0.5.1 has a similar structure for now, but access defensively
              const message = response.choices[0].message;
              return { content: message?.content, usage: response?.usage, }; // Optional chaining for safety
          } else if (client instanceof Anthropic && response?.content?.[0]) {
               const textContent = response.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('');
               // Reconstruct usage for Anthropic if needed
               const usage = { 
                   input_tokens: response.usage?.input_tokens, 
                   output_tokens: response.usage?.output_tokens, 
                   total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0) 
               };
               return { content: textContent, usage: usage, };
          }
     } catch (e) {
          logger.error("Error formatting LLM output:", { error: e instanceof Error ? e.message : String(e) });
           return { formatting_error: String(e), raw_response: response };
     }
      // Return raw if structure doesn't match known patterns
      return { raw_response: response };
}

// --- The Wrap Function --- //

export function wrap<T extends ApiClient>(client: T): T {
    const tracer = Tracer.getInstance();

    if (!tracer.enableMonitoring) {
        logger.info("Global monitoring disabled, client wrapping skipped.");
        return client;
    }

    const config = _getClientConfig(client);
    if (!config) {
        return client;
    }

    const { spanName, originalMethod } = config;

    const tracedMethod = async (...args: any[]) => {
        const currentTrace = tracer.getCurrentTrace();

        if (!currentTrace || !currentTrace.enableMonitoring) {
            return originalMethod(...args);
        }

        let response;
        for (const span of currentTrace.span(spanName, { spanType: 'llm' })) {
            const inputData = _formatInputData(client, args);
            currentTrace.recordInput(inputData);

            try {
                response = await originalMethod(...args);
            } catch (error) {
                currentTrace.recordOutput({ error });
                throw error;
            }

            const outputData = _formatOutputData(client, response);
            currentTrace.recordOutput(outputData);
        }
        
        return response;
    };

    // Apply the wrapper
    if (client instanceof OpenAI && client.chat?.completions) {
        (client.chat.completions as any).create = tracedMethod;
    } else if (client instanceof Anthropic && client.messages) {
        (client.messages as any).create = tracedMethod;
    }
    // Use type assertion for older Together AI version
    else if (client instanceof Together && (client as any).completions) { 
        ((client as any).completions as any).create = tracedMethod;
    }
     else {
         // Log if we couldn't apply the wrapper despite getting a config
         logger.error("Failed to apply wrapper: Could not find method to replace after config check.", { clientType: client?.constructor?.name });
         return client;
    }

    logger.info(`Successfully wrapped client: ${client?.constructor?.name}`);
    return client;
}

// --- Exports --- //
export {
    Tracer,
    TraceClient,
    TraceManagerClient,
    Rule,
    Condition,
    NotificationConfig,
    CombineType,
    TraceEntry,
    SpanType,
    ApiClient,
    TraceSavePayload,
    CondensedSpanEntry
}; 