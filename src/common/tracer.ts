// Core Node.js imports
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

// Installed SDKs
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// --- Type Aliases and Interfaces (Minimal for wrap) ---
type ApiClient = OpenAI | Anthropic; // Add Together later if needed
type SpanType = 'span' | 'tool' | 'llm' | 'evaluation' | 'chain';

interface TraceEntry { // Minimal structure needed by runInSpan/recordInput/Output
    type: 'enter' | 'exit' | 'input' | 'output' | 'error'; // Simplified types
    function: string;
    span_id: string;
    depth: number;
    timestamp: number;
    duration?: number;
    output?: any;
    inputs?: Record<string, any>;
    span_type: SpanType;
    parent_span_id?: string;
}

// --- Context Management ---
// Holds the active TraceClient instance for the current async context
const currentTraceAsyncLocalStorage = new AsyncLocalStorage<TraceClient>();
// Holds the ID of the currently active span within a trace
const currentSpanAsyncLocalStorage = new AsyncLocalStorage<string>();

// --- Placeholder Classes (Minimal for wrap functionality) ---

/**
 * Represents an ongoing trace context. Minimal implementation for wrap.
 */
class TraceClient {
    public traceId: string = uuidv4();
    public entries: Partial<TraceEntry>[] = []; // Store partial entries for simplicity now
    public spanDepths: Record<string, number> = {};
    public enableMonitoring: boolean = true; // Assume enabled

    constructor() { /* Minimal */ }

    // Adds a trace entry (simplified)
    addEntry(entry: Partial<TraceEntry>): void {
        if (!this.enableMonitoring) return;
        entry.timestamp = entry.timestamp || Date.now() / 1000;
        // Simple logging for now, replace with proper storage/printing later
        console.log(`[Trace ${this.traceId}] Add Entry: ${entry.type} - ${entry.function || 'N/A'} (Span: ${entry.span_id})`); 
        this.entries.push(entry);
    }

    // Records inputs (simplified, no serialization yet)
    recordInput(inputs: any): void {
        const spanId = currentSpanAsyncLocalStorage.getStore();
        if (!spanId || !this.enableMonitoring) return;
         // Find enter entry to get context like function name, depth etc. if needed later for richer entry
        this.addEntry({ type: 'input', span_id: spanId, inputs });
    }

    // Records outputs (simplified, no serialization yet)
    recordOutput(output: any): void {
        const spanId = currentSpanAsyncLocalStorage.getStore();
        if (!spanId || !this.enableMonitoring) return;
        // Find enter entry to get context like function name, depth etc. if needed later for richer entry
        this.addEntry({ type: 'output', span_id: spanId, output });
    }

    // Core logic to run a function within a span context
    async runInSpan<T>(
        name: string,
        options: { spanType?: SpanType },
        func: () => Promise<T> | T
    ): Promise<T> {
        if (!this.enableMonitoring) {
             const result = func();
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

        this.addEntry({ type: 'enter', function: name, span_id: spanId, depth: currentDepth, timestamp: startTime, span_type: spanType, parent_span_id: parentSpanId });

        try {
            // Run the function within the context of the new span ID
            const result = await currentSpanAsyncLocalStorage.run(spanId, async () => {
                 const res = func();
                 return res instanceof Promise ? await res : res;
            });
            return result;
        } catch (error) {
             console.error(`Error in span '${name}':`, error);
             this.recordOutput({ error: String(error) }); // Record error as output
             throw error; // Re-throw
        } finally {
            const endTime = Date.now() / 1000;
            const duration = endTime - startTime;
            this.addEntry({ type: 'exit', function: name, span_id: spanId, depth: currentDepth, timestamp: endTime, duration: duration, span_type: spanType });
            delete this.spanDepths[spanId]; // Clean up depth tracking
        }
    }
}

/**
 * Singleton Tracer class. Minimal implementation for wrap.
 */
class Tracer {
    private static instance: Tracer;
    public enableMonitoring: boolean = true; // Assume enabled, load from env later

    private constructor() {
        console.log("Tracer Initialized (Minimal for Wrap)");
        // Read JUDGMENT_MONITORING env var later if needed
        // this.enableMonitoring = process.env.JUDGMENT_MONITORING?.toLowerCase() !== 'false';
    }

    public static getInstance(): Tracer {
        if (!Tracer.instance) {
            Tracer.instance = new Tracer();
        }
        return Tracer.instance;
    }

    // Gets the current TraceClient from async context
    getCurrentTrace(): TraceClient | undefined {
        return currentTraceAsyncLocalStorage.getStore();
    }
}

// --- Helper Functions for Wrapping LLM Clients --- //

// Gets the correct method and span name for supported clients
function _getClientConfig(client: ApiClient): { spanName: string; originalMethod: (...args: any[]) => any } | null {
    if (client instanceof OpenAI) {
        const method = client?.chat?.completions?.create;
        if (typeof method === 'function') {
             // Ensure 'this' context is correct when calling the original method
             return { spanName: "openai_chat_completions_create", originalMethod: method.bind(client.chat.completions) };
        }
    } else if (client instanceof Anthropic) {
         const method = client?.messages?.create;
         if (typeof method === 'function') {
              // Ensure 'this' context is correct
              return { spanName: "anthropic_messages_create", originalMethod: method.bind(client.messages) };
         }
    }
    console.warn("Cannot wrap client: Unsupported type or incompatible SDK structure.", client?.constructor?.name);
    return null;
}

// Formats input parameters for tracing (simplified)
function _formatInputData(client: ApiClient, args: any[]): Record<string, any> {
    const params = args[0] || {}; // Assume first arg holds parameters
    try {
        if (client instanceof OpenAI) {
            // Basic OpenAI params
            return {
                model: params.model,
                messages: params.messages,
                // Consider adding temperature, top_p, stream, etc. if needed
            };
        } else if (client instanceof Anthropic) {
             // Basic Anthropic params
             return {
                 model: params.model,
                 messages: params.messages,
                 max_tokens: params.max_tokens,
                 system: params.system,
                 // Add temperature, top_p, stream, etc. if needed
             };
        }
    } catch (e) {
         console.error("Error formatting LLM input:", e);
    }
    // Fallback: attempt to serialize the first argument safely
    try {
         // Basic JSON serialization, may fail on complex objects/circular refs
         return { params: JSON.parse(JSON.stringify(params)) }; 
    } catch { return { raw_args_0: String(params) }; }
}

// Formats output/response for tracing (simplified)
function _formatOutputData(client: ApiClient, response: any): Record<string, any> {
     try {
          if (client instanceof OpenAI && response?.choices?.[0]?.message) {
              // Standard OpenAI response structure
              return {
                  // Extract key parts of the response
                  id: response.id,
                  model: response.model,
                  content_preview: String(response.choices[0].message.content).slice(0, 200) + '...', 
                  role: response.choices[0].message.role,
                  finish_reason: response.choices[0].finish_reason,
                  usage: response.usage, // { prompt_tokens, completion_tokens, total_tokens }
              };
          } else if (client instanceof Anthropic && response?.content?.[0]?.text) {
               // Standard Anthropic response structure
               return {
                   id: response.id,
                   model: response.model,
                   role: response.role,
                   content_preview: String(response.content[0].text).slice(0, 200) + '...',
                   stop_reason: response.stop_reason,
                   usage: response.usage, // { input_tokens, output_tokens }
               };
          }
     } catch (e) {
          console.error("Error formatting LLM output:", e);
     }
    // Fallback: attempt basic serialization safely
     try {
          return { response: JSON.parse(JSON.stringify(response)) };
     } catch { return { raw_response: String(response) }; }
}

// --- The Wrap Function --- //

/**
 * Wraps an API client (OpenAI, Anthropic) to automatically trace its standard 'create' calls.
 * Modifies the client object in place by replacing the target method.
 *
 * Usage:
 *   const openai = wrap(new OpenAI());
 *   const anthropic = wrap(new Anthropic());
 *
 * @param client The API client instance.
 * @returns The same client instance, now wrapped for tracing.
 */
export function wrap<T extends ApiClient>(client: T): T {
    const tracer = Tracer.getInstance();
    if (!tracer.enableMonitoring) {
        console.log("Monitoring disabled, client wrapping skipped.");
        return client; // Return original if monitoring is off
    }

    const config = _getClientConfig(client);
    if (!config) {
        return client; // Return original if not supported or config failed
    }

    const { spanName, originalMethod } = config;
    console.log(`Attempting to wrap method for ${spanName}...`);

    // Define the replacement (traced) method
    const tracedMethod = async (...args: any[]) => {
        const currentTrace = tracer.getCurrentTrace();

        // If there's no active trace context, call original method directly
        if (!currentTrace) {
            // Optional: Warn if called outside a trace
            // console.warn(`${spanName} called outside of an active trace context.`);
            return originalMethod(...args);
        }

        // Run the original API call within a new span
        return await currentTrace.runInSpan(spanName, { spanType: 'llm' }, async () => {
            const inputData = _formatInputData(client, args);
            currentTrace.recordInput(inputData); // Record formatted inputs

            try {
                 const response = await originalMethod(...args);
                 const outputData = _formatOutputData(client, response);
                 currentTrace.recordOutput(outputData); // Record formatted output
                 return response; // Return the original response
            } catch (error) {
                 console.error(`${spanName} API call failed:`, error);
                 // Record the error details as the output of the span
                 currentTrace.recordOutput({ 
                     error: String(error), 
                     // Add basic error details, avoid overly large stacks if possible
                     error_details: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack?.substring(0, 500) } : {}
                 }); 
                 throw error; // Re-throw the error to maintain original behavior
            }
        });
    };

    // Replace the original method on the client instance
    // Use 'as any' to bypass strict SDK type checking for the assignment
    if (client instanceof OpenAI && client.chat?.completions) {
        client.chat.completions.create = tracedMethod as any;
         console.log(`Successfully wrapped OpenAI client: chat.completions.create`);
    } else if (client instanceof Anthropic && client.messages) {
        client.messages.create = tracedMethod as any;
         console.log(`Successfully wrapped Anthropic client: messages.create`);
    } else {
         console.error("Failed to apply wrapper: Could not find method to replace after config.");
         return client; // Return original client if replacement fails
    }

    return client; // Return the modified client
}

// --- Exports --- //
// Export only what's needed externally for now
export { Tracer, TraceClient, currentTraceAsyncLocalStorage, currentSpanAsyncLocalStorage }; 