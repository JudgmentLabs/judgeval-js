// Core Node.js imports
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

// Installed SDKs
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Local Imports
import {
    JUDGMENT_TRACES_SAVE_API_URL,
    JUDGMENT_TRACES_FETCH_API_URL,
    JUDGMENT_TRACES_DELETE_API_URL,
    JUDGMENT_TRACES_ADD_TO_EVAL_QUEUE_API_URL,
    // Add other necessary constants if needed
} from '../constants';

// --- Type Aliases and Interfaces ---
type ApiClient = OpenAI | Anthropic; // Add Together later if needed
type SpanType = 'span' | 'tool' | 'llm' | 'evaluation' | 'chain';

interface TraceEntry { // Minimal structure needed by runInSpan/recordInput/Output
    type: 'enter' | 'exit' | 'input' | 'output' | 'error' | 'evaluation'; // Added 'evaluation'
    function: string;
    span_id: string;
    depth: number;
    timestamp: number; // Unix timestamp (seconds)
    duration?: number; // Seconds
    output?: any;
    inputs?: Record<string, any>;
    span_type: SpanType;
    parent_span_id?: string;
    // Evaluation specific fields can be added later if needed
    evaluation_runs?: any[]; // Placeholder for evaluation results
}

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
    entries: any[]; // Use specific condensed entry type later
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

// --- Context Management ---
// Holds the active TraceClient instance for the current async context
const currentTraceAsyncLocalStorage = new AsyncLocalStorage<TraceClient>();
// Holds the ID of the currently active span within a trace
const currentSpanAsyncLocalStorage = new AsyncLocalStorage<string>();

// --- Core Trace Classes ---

/**
 * Represents an ongoing trace context.
 */
class TraceClient {
    public readonly traceId: string;
    public readonly name: string;
    public readonly projectName: string;
    public readonly overwrite: boolean;
    public readonly enableMonitoring: boolean;
    public readonly enableEvaluations: boolean;
    public readonly parentTraceId?: string | null;
    public readonly parentName?: string | null;

    // Internal state
    public entries: Partial<TraceEntry>[] = [];
    public spanDepths: Record<string, number> = {};
    private startTime: number; // Unix timestamp (seconds)
    private traceManager: TraceManagerClient; // Instance of the API client
    private apiKey: string; // Keep for potential use? Or rely on traceManager?
    private organizationId: string;

    constructor(
         config: {
             tracer: Tracer, // Reference back to parent Tracer
             traceId?: string,
             name?: string,
             projectName?: string,
             overwrite?: boolean,
             // rules?: Rule[], // Add later if needed
             enableMonitoring?: boolean,
             enableEvaluations?: boolean,
             parentTraceId?: string | null,
             parentName?: string | null,
             apiKey: string, // Passed from Tracer
             organizationId: string // Passed from Tracer
         }
    ) {
         this.traceId = config.traceId || uuidv4();
         this.name = config.name || 'default_trace';
         // Use project name from config, fallback to tracer's project name
         this.projectName = config.projectName ?? config.tracer.projectName;
         this.overwrite = config.overwrite ?? false;
         // Inherit monitoring/evaluation settings from the tracer instance
         this.enableMonitoring = config.enableMonitoring ?? config.tracer.enableMonitoring;
         this.enableEvaluations = config.enableEvaluations ?? config.tracer.enableEvaluations;
         this.parentTraceId = config.parentTraceId;
         this.parentName = config.parentName;
         this.apiKey = config.apiKey; // Store API key from Tracer
         this.organizationId = config.organizationId; // Store Org ID from Tracer

         this.startTime = Date.now() / 1000;
         // Instantiate the API client only if monitoring is enabled
         if (this.enableMonitoring) {
            this.traceManager = new TraceManagerClient(this.apiKey, this.organizationId);
         } else {
            // Provide a null/dummy manager if monitoring is off? Or handle calls conditionally.
            // For now, methods calling traceManager should check enableMonitoring.
            this.traceManager = null as any; // Avoid TS errors, ensure checks later
         }

         // TODO: Add rules handling later if needed
         // this.rules = config.rules || [];
    }

    addEntry(entry: Partial<TraceEntry>): void {
        if (!this.enableMonitoring) return;
        // Ensure timestamp is in seconds
        entry.timestamp = entry.timestamp || Date.now() / 1000;
        // Simple logging for now, replace with proper storage/printing later
        // Consider more structured logging or removing noisy logs
        // console.log(`[Trace ${this.traceId}] Add Entry: ${entry.type} - ${entry.function || 'N/A'} (Span: ${entry.span_id})`);
        this.entries.push(entry);
    }

    recordInput(inputs: any): void {
        const spanId = currentSpanAsyncLocalStorage.getStore();
        if (!spanId || !this.enableMonitoring) return;

        // Find enter entry to get context like function name, depth etc.
        const enterEntry = this.entries.find(e => e.span_id === spanId && e.type === 'enter');
        const functionName = enterEntry?.function || 'unknown_function';
        const depth = enterEntry?.depth ?? this.spanDepths[spanId] ?? 0; // Use depth from enter entry if possible
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

    // Updated to get context from the 'enter' entry for consistency
    recordOutput(output: any): void {
        const spanId = currentSpanAsyncLocalStorage.getStore();
        if (!spanId || !this.enableMonitoring) return;

        const enterEntry = this.entries.find(e => e.span_id === spanId && e.type === 'enter');
        const functionName = enterEntry?.function || 'unknown_function';
        const depth = enterEntry?.depth ?? this.spanDepths[spanId] ?? 0;
        const spanType = enterEntry?.span_type || 'span';

        // Handle potential errors passed as output
        let entryType: TraceEntry['type'] = 'output';
        let outputData = output;
        if (output instanceof Error) {
            entryType = 'error';
            outputData = {
                 name: output.name,
                 message: output.message,
                 stack: output.stack?.substring(0, 1000) // Limit stack trace length
            };
        } else if (output?.error) { // Handle structured errors recorded manually
             entryType = 'error';
             outputData = output; // Assume it's already structured
        }


        this.addEntry({
             type: entryType,
             span_id: spanId,
             output: outputData,
             function: functionName,
             depth: depth,
             span_type: spanType
         });

         // TODO: Add async handling like Python's _update_coroutine_output if needed for Promises
    }


    // Core logic to run a function within a span context
    async runInSpan<T>(
        name: string,
        options: { spanType?: SpanType },
        func: () => Promise<T> | T
    ): Promise<T> {
        // If monitoring is disabled, just run the function without tracing overhead
        if (!this.enableMonitoring) {
             const result = func();
             // Handle both sync and async results
             return result instanceof Promise ? await result : result;
        }

        const startTime = Date.now() / 1000;
        const spanId = uuidv4();
        const parentSpanId = currentSpanAsyncLocalStorage.getStore();
        const spanType = options.spanType || 'span';

        // Calculate depth based on parent span
        let currentDepth = 0;
        if (parentSpanId && this.spanDepths[parentSpanId] !== undefined) {
            currentDepth = this.spanDepths[parentSpanId] + 1;
        }
        this.spanDepths[spanId] = currentDepth; // Store depth for this span

        this.addEntry({
             type: 'enter',
             function: name,
             span_id: spanId,
             depth: currentDepth,
             timestamp: startTime,
             span_type: spanType,
             parent_span_id: parentSpanId
         });

        let result: T;
        try {
            // Run the function within the context of the new span ID using AsyncLocalStorage
            result = await currentSpanAsyncLocalStorage.run(spanId, async () => {
                 const res = func();
                 // Await if it's a promise, otherwise return directly
                 return res instanceof Promise ? await res : res;
            });
            // Record output *after* successful execution, before finally block
            // This allows output recording before the exit entry
            // this.recordOutput(result); // Moved recording logic outside span potentially
            return result; // Return result immediately after successful execution
        } catch (error) {
             console.error(`Error in span '${name}' (spanId: ${spanId}):`, error);
             // Record error details as the output of the span
             this.recordOutput({ // Use recordOutput to capture error structure
                 error: String(error),
                 error_details: error instanceof Error
                     ? { name: error.name, message: error.message, stack: error.stack?.substring(0, 500) }
                     : { detail: String(error) }
             });
             throw error; // Re-throw the error to maintain original behavior
        } finally {
            // This block executes regardless of success or error
            const endTime = Date.now() / 1000;
            const duration = endTime - startTime;
            this.addEntry({
                 type: 'exit',
                 function: name,
                 span_id: spanId,
                 depth: currentDepth, // Use depth stored at the start of the span
                 timestamp: endTime,
                 duration: duration,
                 span_type: spanType
            });
            // Clean up depth tracking for this specific span ID once it exits
            delete this.spanDepths[spanId];
            // No need to reset currentSpanAsyncLocalStorage manually when using .run()
        }
    }


    getDuration(): number {
         return (Date.now() / 1000) - this.startTime;
     }

     // Updated condenseTrace implementation based on Python logic
     private condenseTrace(rawEntries: Partial<TraceEntry>[]): CondensedSpanEntry[] {
         const spansById: Record<string, CondensedSpanEntry & { start_time?: number; end_time?: number }> = {};

         // First pass: Group entries by span_id and gather data
         for (const entry of rawEntries) {
             const spanId = entry.span_id;
             if (!spanId) continue;

             // Initialize span data on first encounter (usually 'enter')
             if (!spansById[spanId]) {
                 spansById[spanId] = {
                     span_id: spanId,
                     function: entry.function || 'unknown',
                     depth: entry.depth ?? 0,
                     timestamp: entry.timestamp ?? 0, // Defaulting timestamp, 'enter' should set it
                     parent_span_id: entry.parent_span_id,
                     span_type: entry.span_type || 'span',
                     inputs: null,
                     output: null,
                     evaluation_runs: [],
                     duration: null,
                     children: [] // Initialize children array
                 };
             }

             const currentSpanData = spansById[spanId];

             // Update span data based on entry type
             switch (entry.type) {
                 case 'enter':
                     currentSpanData.function = entry.function || currentSpanData.function;
                     currentSpanData.depth = entry.depth ?? currentSpanData.depth;
                     currentSpanData.timestamp = entry.timestamp ?? currentSpanData.timestamp; // Entry timestamp is the start
                     currentSpanData.parent_span_id = entry.parent_span_id; // Capture parent ID
                     currentSpanData.span_type = entry.span_type || currentSpanData.span_type;
                     currentSpanData.start_time = entry.timestamp; // Record start time
                     break;
                 case 'exit':
                     currentSpanData.duration = entry.duration ?? currentSpanData.duration;
                     currentSpanData.end_time = entry.timestamp; // Record end time
                     // Recalculate duration if exit entry doesn't have it but start/end times exist
                     if (currentSpanData.duration === null && currentSpanData.start_time && currentSpanData.end_time) {
                          currentSpanData.duration = currentSpanData.end_time - currentSpanData.start_time;
                     }
                     break;
                 case 'input':
                     // Simple overwrite/merge logic (can be enhanced)
                     if (currentSpanData.inputs === null && entry.inputs) {
                         currentSpanData.inputs = entry.inputs;
                     } else if (typeof currentSpanData.inputs === 'object' && typeof entry.inputs === 'object') {
                         // Basic merge, could be deeper if needed
                         currentSpanData.inputs = { ...currentSpanData.inputs, ...entry.inputs };
                     }
                     break;
                 case 'output':
                 case 'error':
                     currentSpanData.output = entry.output; // Capture output or error structure
                     break;
                 case 'evaluation':
                     if (entry.evaluation_runs) {
                         currentSpanData.evaluation_runs.push(...entry.evaluation_runs);
                     }
                     break;
             }
         }

         // Convert map to list and clean up temporary fields
         const spansList = Object.values(spansById).map(span => {
              // Ensure duration is calculated if possible
              if (span.duration === null && span.start_time && span.end_time) {
                  span.duration = span.end_time - span.start_time;
              }
             delete span.start_time;
             delete span.end_time;
             return span as CondensedSpanEntry; // Cast to final type
         });

         // --- Build Tree Structure and Sort --- //
         // Declare all variables for this section together
         const childrenMap: Record<string, CondensedSpanEntry[]> = {};
         const roots: CondensedSpanEntry[] = [];
         const spanMap: Record<string, CondensedSpanEntry> = {};
         const sortedCondensedList: CondensedSpanEntry[] = [];
         const visited = new Set<string>();

         // Populate spanMap and identify roots
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

         // Sort roots and children
         roots.sort((a, b) => a.timestamp - b.timestamp);
         for (const parentId in childrenMap) {
             childrenMap[parentId].sort((a, b) => a.timestamp - b.timestamp);
         }

         // Define the DFS helper function
         function buildFlatListDfs(span: CondensedSpanEntry) {
             if (visited.has(span.span_id)) {
                  return; // Avoid cycles
              }
             visited.add(span.span_id);
             sortedCondensedList.push(span); // Add to flat list (pre-order)

             const children = childrenMap[span.span_id] || [];
             for (const child of children) {
                 buildFlatListDfs(child); // Recurse
             }
         }

         // --- Perform DFS --- //
         // Start DFS from each root
         for (const rootSpan of roots) {
             buildFlatListDfs(rootSpan);
         }

         // Handle orphaned spans
         for (const span of spansList) {
             if (!visited.has(span.span_id)) {
                 console.warn(`Orphaned span detected: ${span.span_id}, adding to end of list.`);
                 buildFlatListDfs(span); // Process orphan and its potential subtree
             }
         }

         return sortedCondensedList;
     }

     // Save the trace data via the TraceManagerClient
     async save(emptySave: boolean = false): Promise<{ traceId: string; traceData: TraceSavePayload } | null> {
         if (!this.enableMonitoring || !this.traceManager) {
              console.log("Monitoring disabled or TraceManager not initialized, skipping save.");
              return null;
         }

         const totalDuration = this.getDuration();
         // Call the implemented condenseTrace method
         const condensedEntries: CondensedSpanEntry[] = this.condenseTrace(this.entries);

         // Implement token counting logic
         const tokenCounts = {
             prompt_tokens: 0,
             completion_tokens: 0,
             total_tokens: 0,
             prompt_tokens_cost_usd: 0, // Cost calculation needs separate handling (litellm equivalent)
             completion_tokens_cost_usd: 0,
             total_cost_usd: 0
         };

         condensedEntries.forEach(entry => {
             if (entry.span_type === 'llm' && entry.output?.usage) {
                 const usage = entry.output.usage;
                 // Check for OpenAI/Together format
                 if (usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined) {
                     tokenCounts.prompt_tokens += usage.prompt_tokens || 0;
                     tokenCounts.completion_tokens += usage.completion_tokens || 0;
                     tokenCounts.total_tokens += usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
                 }
                 // Check for Anthropic format (avoid double counting)
                 else if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
                     tokenCounts.prompt_tokens += usage.input_tokens || 0;
                     tokenCounts.completion_tokens += usage.output_tokens || 0;
                     // Anthropic total needs summing if not provided directly
                     tokenCounts.total_tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
                 }

                 // --- START: Add per-call cost calculation (mirroring Python) ---
                 const modelName = entry.inputs?.model || ""; // Get model name from inputs
                 const promptTokens = usage.prompt_tokens || usage.input_tokens || 0;
                 const completionTokens = usage.completion_tokens || usage.output_tokens || 0;

                 if (modelName) {
                     try {
                         // --- Placeholder for cost calculation ---
                         // Replace this with actual cost calculation logic,
                         // similar to Python's `cost_per_token(model=modelName, prompt_tokens=..., completion_tokens=...)`
                         // You'll need a way to access model cost data (e.g., a library, a map, an API call).
                         const promptCost = 0.0; // Replace with calculated prompt cost
                         const completionCost = 0.0; // Replace with calculated completion cost
                         const callTotalCost = promptCost + completionCost;
                         // --- End Placeholder ---

                         // Add cost info directly to the entry's usage object
                         entry.output.usage.prompt_tokens_cost_usd = promptCost;
                         entry.output.usage.completion_tokens_cost_usd = completionCost;
                         entry.output.usage.total_cost_usd = callTotalCost;

                         // Accumulate total costs
                         tokenCounts.prompt_tokens_cost_usd += promptCost;
                         tokenCounts.completion_tokens_cost_usd += completionCost;
                         tokenCounts.total_cost_usd += callTotalCost;

                     } catch (e) {
                         console.warn(`Error calculating cost for model '${modelName}':`, e);
                         // Assign null or 0 if cost calculation fails for this call
                         entry.output.usage.prompt_tokens_cost_usd = null;
                         entry.output.usage.completion_tokens_cost_usd = null;
                         entry.output.usage.total_cost_usd = null;
                     }
                 } else {
                     // Handle cases where model name is missing, if necessary
                      entry.output.usage.prompt_tokens_cost_usd = null;
                      entry.output.usage.completion_tokens_cost_usd = null;
                      entry.output.usage.total_cost_usd = null;
                 }
                  // --- END: Add per-call cost calculation ---
             }
         });


         const traceData: TraceSavePayload = {
             trace_id: this.traceId,
             name: this.name,
             project_name: this.projectName,
             created_at: new Date(this.startTime * 1000).toISOString(),
             duration: totalDuration,
             token_counts: tokenCounts,
             entries: condensedEntries,
             empty_save: emptySave,
             overwrite: this.overwrite,
             parent_trace_id: this.parentTraceId,
             parent_name: this.parentName
         };

         try {
             // Avoid logging sensitive data in production
             // console.log(`Saving trace ${this.traceId} (emptySave=${emptySave}). Data:`, JSON.stringify(traceData, null, 2));
             console.log(`Saving trace ${this.traceId} (emptySave=${emptySave})...`);
             await this.traceManager.saveTrace(traceData, emptySave);

             // Trigger evaluation queue add *after* successful save (if not empty and enabled)
             if (!emptySave && this.enableEvaluations) {
                 try {
                     console.log(`Adding trace ${this.traceId} to evaluation queue...`);
                     // Pass the same traceData used for saving
                     await this.traceManager.addTraceToEvalQueue(traceData);
                 } catch (evalError) {
                     console.warn(`Failed to add trace ${this.traceId} to evaluation queue:`, evalError);
                     // Decide if this should be a critical error or just a warning
                 }
             }
              console.log(`Trace ${this.traceId} saved successfully.`);
             return { traceId: this.traceId, traceData };
         } catch (error) {
             console.error(`Failed to save trace ${this.traceId}:`, error);
              return null; // Indicate failure
         }
     }

     // Delete the trace via the TraceManagerClient
     async delete(): Promise<any> {
         if (!this.enableMonitoring || !this.traceManager) {
              console.log("Monitoring disabled or TraceManager not initialized, skipping delete.");
              return null;
         }
         try {
             console.log(`Deleting trace ${this.traceId}...`);
             const result = await this.traceManager.deleteTrace(this.traceId);
             console.log(`Trace ${this.traceId} deleted successfully.`);
             return result; // Return the API response (often null on success for DELETE)
         } catch (error) {
             console.error(`Failed to delete trace ${this.traceId}:`, error);
             throw error; // Re-throw or handle as needed
         }
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
    public readonly enableMonitoring: boolean;
    public readonly enableEvaluations: boolean;
    // public readonly rules: Rule[]; // Add later
    private initialized: boolean = false;

    // Private constructor for singleton pattern
    private constructor(config?: {
         apiKey?: string,
         organizationId?: string,
         projectName?: string,
         // rules?: Rule[], // Add later
         enableMonitoring?: boolean,
         enableEvaluations?: boolean
    }) {
         // Load defaults from environment variables, checking for process object existence
         const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

         const envApiKey = isNode ? process.env?.JUDGMENT_API_KEY : undefined;
         const envOrgId = isNode ? process.env?.JUDGMENT_ORG_ID : undefined;
         const envProjectName = isNode ? process.env?.JUDGMENT_PROJECT_NAME : undefined; // Keep as potentially undefined here
         const envMonitoring = isNode ? process.env?.JUDGMENT_MONITORING : 'true';
         const envEvaluations = isNode ? process.env?.JUDGMENT_EVALUATIONS : 'true';

         this.apiKey = config?.apiKey ?? envApiKey ?? '';
         this.organizationId = config?.organizationId ?? envOrgId ?? '';
         // Add final fallback to ensure projectName is always a string
         this.projectName = config?.projectName ?? envProjectName ?? 'default_project';
         // Default to true if not explicitly set or passed as false
         this.enableMonitoring = config?.enableMonitoring ?? (envMonitoring?.toLowerCase() !== 'false');
         this.enableEvaluations = config?.enableEvaluations ?? (envEvaluations?.toLowerCase() !== 'false');

         // Validate essential configuration only if monitoring is intended to be enabled
         if (this.enableMonitoring) {
             if (!this.apiKey) {
                console.warn("JUDGMENT_API_KEY not found in environment or config. Monitoring will be effectively disabled.");
                this.enableMonitoring = false; // Disable if key is missing
                this.enableEvaluations = false; // Evaluations depend on monitoring/saving
             }
             if (!this.organizationId) {
                console.warn("JUDGMENT_ORG_ID not found in environment or config. Monitoring will be effectively disabled.");
                this.enableMonitoring = false; // Disable if org ID is missing
                this.enableEvaluations = false;
             }
         }

         // this.rules = config?.rules ?? []; // Initialize rules later

         this.initialized = true;
         console.log(`Tracer Initialized. Monitoring: ${this.enableMonitoring}, Evaluations: ${this.enableEvaluations}, Project: ${this.projectName}`);
    }

    // Static method to get the singleton instance
    public static getInstance(config?: { // Allow optional config on first call
         apiKey?: string,
         organizationId?: string,
         projectName?: string,
         enableMonitoring?: boolean,
         enableEvaluations?: boolean
         // rules?: Rule[]
     }): Tracer {
        if (!Tracer.instance) {
            Tracer.instance = new Tracer(config);
        } else if (config && !Tracer.instance.initialized) {
             // This scenario should ideally not happen with correct singleton usage
             console.warn("Tracer getInstance called with config after implicit initialization. Re-initializing.");
             Tracer.instance = new Tracer(config); // Overwrite with new config
        } else if (config && Tracer.instance.initialized) {
             // Warn if trying to reconfigure *mutable* properties after initialization
             // Currently, properties are readonly after construction, but project name might be conceptually mutable.
             if (config.projectName && config.projectName !== Tracer.instance.projectName) {
                 console.warn(`Attempting to re-initialize Tracer with project_name='${config.projectName}' but it was already initialized with project_name='${Tracer.instance.projectName}'. The original project_name ('${Tracer.instance.projectName}') will be used.`);
             }
             // Note: API Key and Org ID changes would require creating a new instance.
        }
        return Tracer.instance;
    }

    // Gets the current TraceClient from async context
    getCurrentTrace(): TraceClient | undefined {
        // No need to check enableMonitoring here, as getCurrentTrace is passive
        return currentTraceAsyncLocalStorage.getStore();
    }

    // --- Trace creation method (Handles setting up the context) ---
    // This replaces the Python context manager approach with an explicit start/end or runInTrace
     private _startTraceInternal(config: {
         name: string,
         projectName?: string,
         overwrite?: boolean,
         // rules?: Rule[] // Add later
     }): TraceClient {
         // Get parent trace *before* setting the new one in context
         const parentTrace = this.getCurrentTrace();

         const traceClient = new TraceClient({
             tracer: this, // Pass reference to this Tracer instance
             name: config.name,
             projectName: config.projectName ?? this.projectName, // Use specific or default project name
             overwrite: config.overwrite,
             // Inherit monitoring settings from Tracer
             enableMonitoring: this.enableMonitoring,
             enableEvaluations: this.enableEvaluations,
             parentTraceId: parentTrace?.traceId,
             parentName: parentTrace?.name,
             apiKey: this.apiKey, // Pass credentials down
             organizationId: this.organizationId,
             // rules: config.rules ?? this.rules // Combine rules later
         });

         // Save empty trace immediately if monitoring is enabled
         // This helps establish the trace record early for potential async operations or UI visibility
         if (traceClient.enableMonitoring) {
              traceClient.save(true).catch(err => {
                   // Log error but don't block execution
                   console.error(`Failed to save initial empty trace for '${config.name}':`, err);
              }); // Fire-and-forget initial save
         }

         return traceClient;
     }

     /**
      * Runs a function within a new trace context.
      * Handles context setup, execution, and saving the trace.
      * Similar to using `with tracer.trace(...)` in Python.
      *
      * @param config Configuration for the trace (name, project, etc.)
      * @param func The async function to execute within the trace context.
      *             It receives the TraceClient instance as an argument.
      * @returns The result of the executed function.
      */
      async runInTrace<T>(
          config: {
              name: string,
              projectName?: string,
              overwrite?: boolean,
              // rules?: Rule[] // Add later
          },
          func: (traceClient: TraceClient) => Promise<T> | T // Allow sync or async func
      ): Promise<T> {
          // Start the trace internally (creates client, saves empty trace)
          const traceClient = this._startTraceInternal(config);

          // Run the user's function within the AsyncLocalStorage context for this trace
          return await currentTraceAsyncLocalStorage.run(traceClient, async () => {
              let result: T;
              try {
                  // Automatically create a top-level span for the traced function
                  // Use 'chain' to indicate a logical sequence or workflow root
                  result = await traceClient.runInSpan(config.name, { spanType: 'chain' }, async () => {
                      // Execute the user-provided function, passing the client
                      const funcResult = func(traceClient);
                      // Await if the user function is async
                      return funcResult instanceof Promise ? await funcResult : funcResult;
                  });

                  // Save the completed trace data (not empty) after successful execution
                  if (traceClient.enableMonitoring) {
                       await traceClient.save(false).catch(saveErr => {
                           console.error(`Failed to save completed trace '${config.name}' (${traceClient.traceId}):`, saveErr);
                       });
                  }
                  return result; // Return the result of the user's function

              } catch (error) {
                   console.error(`Error during traced execution of '${config.name}' (${traceClient.traceId}):`, error);
                   // Attempt to save the trace even if there was an error during execution
                   if (traceClient.enableMonitoring) {
                        await traceClient.save(false).catch(saveErr => {
                             console.error(`Failed to save trace '${config.name}' after error:`, saveErr);
                        });
                   }
                   throw error; // Re-throw the original error after attempting save
              }
              // AsyncLocalStorage context is automatically managed by .run()
          });
      }

     /**
      * Decorator/higher-order function to automatically trace function execution.
      *
      * @param options Configuration for the observation (name, spanType, etc.)
      * @returns A function that takes the target function and returns a wrapped version.
      */
     observe<T extends (...args: any[]) => any>(options?: {
         name?: string;
         spanType?: SpanType;
         // project_name?: string; // Add later if needed
         // overwrite?: boolean; // Add later if needed
     }) {
         // If monitoring is globally disabled, return a no-op HOF
         if (!this.enableMonitoring) {
             return (func: T): T => func;
         }

         // Return the actual higher-order function
         return (func: T): T => {
             const spanName = options?.name || func.name || 'anonymous_function';
             const spanType = options?.spanType || 'span';

             const wrapper = (...args: Parameters<T>): ReturnType<T> | Promise<ReturnType<T>> => {
                 const currentTrace = this.getCurrentTrace();

                 // --- Case 1: Called outside an active trace context ---
                 if (!currentTrace) {
                     // Create a new root trace context automatically
                     // Use runInTrace which handles creation, saving empty, running func, saving result
                     return this.runInTrace({ name: spanName /*, projectName, overwrite */ }, async (traceClient) => {
                         // Inside runInTrace, a top-level span is already created.
                         // We might want to skip creating *another* span here, or adjust runInTrace.
                         // For simplicity matching python's observe creating its own root span, let's run directly.

                         // TODO: Reconcile runInTrace's automatic span with observe's desire to create *the* span.
                         // Current simple approach: runInTrace creates a 'chain' span, observe's logic runs inside it.
                         // Alternative: runInTrace doesn't create a span, observe does.

                         // Let's stick to the simple approach for now:
                         try {
                            // Execute the original function
                            const result = func(...args);
                            // Await if it's async
                            const finalResult = result instanceof Promise ? await result : result;
                            // Note: runInSpan within runInTrace *should* record output, but maybe not inputs?
                            // traceClient.recordInput({ args: args }); // Maybe record input manually?
                            // traceClient.recordOutput(finalResult); // And output?
                            return finalResult;
                         } catch(error) {
                             // Error is caught and trace saved by runInTrace
                             throw error;
                         }
                     }) as Promise<ReturnType<T>>; // Assume async if starting trace
                 }

                 // --- Case 2: Called within an existing trace context ---
                 else {
                      // Use runInSpan on the existing trace client
                      const executionLogic = () => {
                          const result = func(...args);
                          return result instanceof Promise ? result : Promise.resolve(result);
                      };

                      return currentTrace.runInSpan(spanName, { spanType }, async () => {
                          // Record inputs *inside* the span
                          // Convert args to a serializable format if needed
                          const serializableArgs = args.map(arg => {
                               try {
                                   // Basic serialization check - improve if needed
                                   return JSON.parse(JSON.stringify(arg));
                               } catch {
                                   return String(arg); // Fallback to string
                               }
                          });
                          currentTrace.recordInput({ args: serializableArgs });

                          try {
                              const finalResult = await executionLogic();
                              // Record output *inside* the span
                              currentTrace.recordOutput(finalResult);
                              return finalResult;
                          } catch (error) {
                              // runInSpan handles recording the error output
                              console.error(`Error captured by observe decorator in span '${spanName}':`, error);
                              throw error; // Re-throw error after it's recorded
                          }
                      }) as Promise<ReturnType<T>>; // runInSpan returns a Promise
                 }
             };

             // Preserve original function name and properties if possible
             Object.defineProperty(wrapper, 'name', { value: func.name, configurable: true });
             // Copy other static properties if necessary

             return wrapper as T;
         };
     }

     // TODO: Add score() decorator equivalent and async_evaluate() direct call
     // public score(...) { ... }
     // public async evaluate(...) { ... }
}

// --- Helper Functions for Wrapping LLM Clients --- //

// Gets the correct method and span name for supported clients
function _getClientConfig(client: ApiClient): { spanName: string; originalMethod: (...args: any[]) => any } | null {
    // Ensure 'this' context is preserved using .bind()
    if (client instanceof OpenAI && typeof client?.chat?.completions?.create === 'function') {
        return { spanName: "openai.chat.completions.create", originalMethod: client.chat.completions.create.bind(client.chat.completions) };
    } else if (client instanceof Anthropic && typeof client?.messages?.create === 'function') {
        return { spanName: "anthropic.messages.create", originalMethod: client.messages.create.bind(client.messages) };
    }
    // TODO: Add support for Together client if needed
    // else if (client instanceof Together && typeof client?.chat?.completions?.create === 'function') {
    //     return { spanName: "together.chat.completions.create", originalMethod: client.chat.completions.create.bind(client.chat.completions) };
    // }

    console.warn("Cannot wrap client: Unsupported type or incompatible SDK structure.", client?.constructor?.name);
    return null;
}

// Formats input parameters for tracing (more aligned with Python version)
// Use explicit casting as a final attempt to resolve persistent type error
function _formatInputData(client: ApiClient, args: any[]): Record<string, any> {
    // Assume args[0] contains the primary request payload (like Python's kwargs)
    const params = args[0] || {};
    try {
        if (client instanceof OpenAI /* || client instanceof Together */) {
            // Extract common parameters
            return {
                model: params.model, // Keep defaults or allow undefined based on desired behavior
                messages: params.messages,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                top_p: params.top_p,
                stream: params.stream,
            } as Record<string, any>; // Explicit cast
        } else if (client instanceof Anthropic) {
             // Extract Anthropic parameters
             return {
                 model: params.model,
                 messages: params.messages,
                 max_tokens: params.max_tokens,
                 system: params.system,
                 temperature: params.temperature,
                 top_p: params.top_p,
                 stream: params.stream,
             } as Record<string, any>; // Explicit cast
        }
    } catch (e) {
         console.error("Error formatting LLM input:", e);
         // Fallback: Return raw parameters if formatting fails
         return { raw_params: params } as Record<string, any>; // Explicit cast
    }
    // Fallback for unknown client types or errors
    return { raw_params: params } as Record<string, any>; // Explicit cast
}

// Formats output/response for tracing (more aligned with Python version)
// Handles both standard responses and stream chunks if applicable
function _formatOutputData(client: ApiClient, response: any): Record<string, any> {
     // TODO: Add proper handling for streaming responses.
     // This currently assumes a complete, non-streamed response object.
     try {
          // OpenAI / Together Structure
          if (client instanceof OpenAI /* || client instanceof Together */ && response?.choices?.[0]?.message) {
              const message = response.choices[0].message;
              return {
                  id: response.id,
                  model: response.model,
                  // Combine content parts if needed (e.g., tool calls)
                  content: message.content, // Primary text content
                  role: message.role,
                  tool_calls: message.tool_calls, // Include tool calls if present
                  finish_reason: response.choices[0].finish_reason,
                  usage: response.usage, // { prompt_tokens, completion_tokens, total_tokens }
              };
          }
          // Anthropic Structure
          else if (client instanceof Anthropic && response?.content?.[0]) {
               // Anthropic might return multiple content blocks, join text ones for preview
               const textContent = response.content
                   .filter((block: any) => block.type === 'text')
                   .map((block: any) => block.text)
                   .join('');
               // Include other block types (e.g., tool_use) if needed
               const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');

               return {
                   id: response.id,
                   model: response.model,
                   role: response.role,
                   content: textContent, // Combined text content
                   tool_uses: toolUseBlocks.length > 0 ? toolUseBlocks : undefined, // Include tool use blocks
                   stop_reason: response.stop_reason,
                   stop_sequence: response.stop_sequence,
                   usage: response.usage, // { input_tokens, output_tokens }
               };
          }
     } catch (e) {
          console.error("Error formatting LLM output:", e);
          // Fallback: Return raw response with error indicator
           return { formatting_error: String(e), raw_response: response };
     }
     // Fallback for unknown structures or streaming chunks (needs specific handling)
      return { raw_response: response };
}

// --- The Wrap Function --- //

/**
 * Wraps an API client (OpenAI, Anthropic) to automatically trace its standard 'create' calls.
 * Modifies the client object in place by replacing the target method.
 * IMPORTANT: This does NOT currently handle streaming responses correctly for tracing.
 *
 * Usage:
 *   const openai = wrap(new OpenAI());
 *   const anthropic = wrap(new Anthropic());
 *
 * @param client The API client instance (OpenAI or Anthropic).
 * @returns The same client instance, now wrapped for tracing non-streaming calls.
 */
export function wrap<T extends ApiClient>(client: T): T {
    const tracer = Tracer.getInstance(); // Get singleton instance

    // Skip wrapping if monitoring is disabled globally
    if (!tracer.enableMonitoring) {
        console.log("Global monitoring disabled, client wrapping skipped.");
        return client;
    }

    const config = _getClientConfig(client);
    if (!config) {
        // Client type not supported or config failed
        return client;
    }

    const { spanName, originalMethod } = config;
    console.log(`Wrapping method ${spanName} for tracing...`);

    // Define the replacement (traced) method
    const tracedMethod = async (...args: any[]) => {
        // Get the current trace context *at the time of the call*
        const currentTrace = tracer.getCurrentTrace();

        // If there's no active trace context OR monitoring is disabled for this specific trace,
        // call the original method directly without tracing overhead.
        if (!currentTrace || !currentTrace.enableMonitoring) {
            // Optional: Warn if called outside a trace when monitoring is expected
            // if (tracer.enableMonitoring && !currentTrace) {
            //     console.warn(`${spanName} called outside of an active trace context.`);
            // }
            return originalMethod(...args); // Pass arguments as received
        }

        // Run the original API call within a new 'llm' span
        // Use runInSpan from the currentTrace instance
        return await currentTrace.runInSpan(spanName, { spanType: 'llm' }, async () => {
            // Format and record inputs *inside* the span context
            const inputData = _formatInputData(client, args);
            currentTrace.recordInput(inputData);

            try {
                 // Call the original API method (already bound to the correct client context)
                 const response = await originalMethod(...args); // Pass arguments as received

                 // TODO: Add proper handling for streaming responses.
                 // If response is a stream, we need to iterate and record chunks,
                 // then potentially summarize or record the final aggregated output.
                 // This simplified version assumes a non-streaming response.

                 // Format and record the complete output
                 const outputData = _formatOutputData(client, response);
                 currentTrace.recordOutput(outputData);

                 return response; // Return the original response

            } catch (error) {
                 console.error(`${spanName} API call failed:`, error);
                 // Record the error details using recordOutput
                 currentTrace.recordOutput(error); // Pass the Error object directly
                 throw error; // Re-throw the error
            }
        });
    };

    // Replace the original method on the client instance
    // This modifies the client object directly.
    // Use 'as any' carefully to bypass strict SDK type checking for the assignment.
    if (client instanceof OpenAI && client.chat?.completions) {
        (client.chat.completions as any).create = tracedMethod;
         console.log(`Successfully wrapped OpenAI client: chat.completions.create`);
    } else if (client instanceof Anthropic && client.messages) {
        (client.messages as any).create = tracedMethod;
         console.log(`Successfully wrapped Anthropic client: messages.create`);
    }
    // TODO: Add Together wrapping if needed
    // else if (client instanceof Together && client.chat?.completions) {
    //     (client.chat.completions as any).create = tracedMethod;
    //     console.log(`Successfully wrapped Together client: chat.completions.create`);
    // }
     else {
         // This case should ideally be caught by _getClientConfig, but added for safety
         console.error("Failed to apply wrapper: Could not find method to replace after config check.");
         return client; // Return original client if replacement fails unexpectedly
    }

    return client; // Return the modified client
}

// --- Exports --- //
export {
    Tracer,
    TraceClient,
    TraceManagerClient, // Export the new client
    // wrap, // Removed from here as it's exported inline
    currentTraceAsyncLocalStorage,
    currentSpanAsyncLocalStorage,
    // Export types if needed for external use
    TraceEntry,
    SpanType,
    ApiClient,
    TraceSavePayload
}; 