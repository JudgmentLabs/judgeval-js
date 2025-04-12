// judgeval-js/src/integrations/langgraph.ts

import {
    BaseCallbackHandler,
    // Import specific types for parameters as needed, e.g.:
    // Serialized, LLMResult, BaseMessage, Document, AgentAction, AgentFinish
} from "@langchain/core/callbacks/base";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { LLMResult, Generation } from "@langchain/core/outputs"; // Keep type import for Generation
import { ChatGeneration } from "@langchain/core/outputs"; // Regular import for ChatGeneration value
import { BaseMessage } from "@langchain/core/messages"; // Regular import for BaseMessage value
import type { AIMessage } from "@langchain/core/messages"; // Type import for AIMessage
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import { BaseTracer } from "@langchain/core/tracers/base";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { v4 as uuidv4 } from 'uuid';
import { Tracer, TraceClient, SpanType, currentSpanAsyncLocalStorage, TraceEntry } from "../tracer.js"; // Adjust path

// --- Global Handler Setup (REMOVED - No longer needed with context propagation) ---

export class JudgevalLanggraphCallbackHandler extends BaseCallbackHandler {
    name = "judgeval_langgraph_callback_handler"; // Identifier for the handler

    private tracer: Tracer;
    private spanStartTimes: Record<string, number> = {}; // Store start time per spanId (using Judgeval spanId)
    private runIdToSpanId: Record<string, string> = {}; // Map Langchain runId to Judgeval spanId

    // Optional: Track executed nodes/tools if needed for external use cases like evaluation
    // public executedNodes: string[] = [];
    // public executedTools: string[] = [];

    constructor(tracer?: Tracer) {
        super(); // Call parent constructor
        this.tracer = tracer ?? Tracer.getInstance(); // Use provided or singleton tracer
        // No need to get traceClient here, will be fetched from context in methods
        console.log(`[Judgeval Handler] Initialized. Monitoring Enabled: ${this.tracer.enableMonitoring}`); // Added prefix
    }

    // Helper to safely get the current TraceClient from context
    private _getActiveTraceClient(): TraceClient | null {
        if (!this.tracer.enableMonitoring) {
            // console.log("Judgeval Handler: Monitoring disabled."); // Reduce noise
            return null;
        }
        const client = this.tracer.getCurrentTrace();
        if (!client) {
            console.log("[Judgeval Handler] _getActiveTraceClient: No active trace client found in context."); // Added log
        }
        // Explicitly return null if client is undefined
        return client ?? null;
    }

    // Helper to create a unique span ID
    private _generateSpanId(): string {
        return uuidv4();
    }

    // Start a new span, associating it with the LangChain runId
    private _startSpan(lcRunId: string, name: string, spanType: SpanType = "span"): void {
        const traceClient = this._getActiveTraceClient();
        if (!traceClient) return;

        const startTime = Date.now() / 1000;
        const spanId = this._generateSpanId();
        this.runIdToSpanId[lcRunId] = spanId; // Map Langchain runId to our new spanId

        // Get parent span ID from the current async context
        const parentSpanId = currentSpanAsyncLocalStorage.getStore();
        // Calculate depth based on parent
        let depth = 0;
        if (parentSpanId) {
             const parentEntry = traceClient.entries.find(
                 (e) => e.span_id === parentSpanId && e.type === 'enter'
             );
             if (parentEntry) {
                 depth = (parentEntry.depth ?? -1) + 1; // Increment parent depth
             } else {
                  // If parent entry not found (should be rare in async context), start at 0
                 console.warn(`Judgeval Handler: Parent span entry ${parentSpanId} not found for child ${spanId}. Defaulting depth to 0.`);
                 depth = 0;
             }
        } else {
             // No parent in context, this is a root span (relative to this handler's context)
             depth = 0;
        }

        // console.log(`>>> _startSpan: Creating span ${spanId} ('${name}') depth: ${depth}, parent: ${parentSpanId ?? 'None'}, lcRunId: ${lcRunId}`); // Debug log

        traceClient.addEntry({
            type: 'enter',
            function: name,
            span_id: spanId,
            depth: depth,
            timestamp: startTime,
            span_type: spanType,
            parent_span_id: parentSpanId
        });

        this.spanStartTimes[spanId] = startTime;

        // Set this new span as the current one in the context *for child operations*
        // Note: This relies on Langchain's async flow preserving the context.
        // If Langchain breaks context, this might not propagate correctly.
        // It's generally better to *read* the parent from context when starting a span,
        // rather than trying to manage pushing/popping onto the context here.
        // The Tracer's observe/runInTrace methods handle setting the context.
    }

    // End the span corresponding to the LangChain runId
    private _endSpan(lcRunId: string, output?: any, error?: Error | any): void {
        const traceClient = this._getActiveTraceClient();
        // Retrieve the spanId using the LangChain runId
        const spanId = this.runIdToSpanId[lcRunId];

        if (!traceClient || !spanId || !(spanId in this.spanStartTimes)) {
            // console.log(`>>> _endSpan: Skipping endSpan for lcRunId ${lcRunId} / spanId ${spanId} - ID/trace/time missing or monitoring disabled.`); // Debug log
            // Clean up the map even if we can't end the span fully
            if (lcRunId in this.runIdToSpanId) delete this.runIdToSpanId[lcRunId];
            return;
        }

        const startTime = this.spanStartTimes[spanId];
        const endTime = Date.now() / 1000;
        const duration = endTime - startTime;

        // Find the original 'enter' entry to get details like name and depth
        const enterEntry = traceClient.entries.find(e => e.span_id === spanId && e.type === 'enter');
        if (!enterEntry) {
            console.warn(`Judgeval Handler: Could not find 'enter' entry for span ${spanId} (lcRunId: ${lcRunId}) during _endSpan.`);
            // Clean up maps even if entry isn't found
            delete this.spanStartTimes[spanId];
            delete this.runIdToSpanId[lcRunId];
            return;
        }

        // Record output or error *before* the exit entry
        if (error) {
            traceClient.recordOutput(error instanceof Error ? error : new Error(String(error)));
        } else if (output !== undefined) {
            // Avoid recording 'undefined' as output explicitly
            traceClient.recordOutput(output);
        }

        traceClient.addEntry({
            type: 'exit',
            function: enterEntry.function, // Use name from 'enter' entry
            span_id: spanId,
            depth: enterEntry.depth, // Use depth from 'enter' entry
            timestamp: endTime,
            duration: duration,
            span_type: enterEntry.span_type // Use type from 'enter' entry
        });

        // Clean up maps
        delete this.spanStartTimes[spanId];
        delete this.runIdToSpanId[lcRunId];

        // console.log(`>>> _endSpan: Ended span ${spanId} ('${enterEntry.function}'), lcRunId: ${lcRunId}`); // Debug log
    }

    // --- Chain Events ---
    async onChainStart(
        serialized: Serialized,
        inputs: Record<string, unknown>,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        options?: Record<string, any> // Langchain-JS doesn't seem to pass options here consistently
    ): Promise<void> {
        console.log(`[Judgeval Handler] onChainStart called for runId: ${runId}`); // Added log
        // console.log(`>>> onChainStart: runId: ${runId}, parentRunId: ${parentRunId}, metadata: ${JSON.stringify(metadata)}, tags: ${JSON.stringify(tags)}`); // Debug log
        const traceClient = this._getActiveTraceClient();
        if (!traceClient) return;

        let spanName: string;
        const spanType: SpanType = "chain"; // Keep type as chain

        // Determine span name based on Python logic: prioritize 'LangGraph' root, then serialized name
        const executionName = serialized?.name ?? 'Unknown Chain';
        if (executionName === 'LangGraph') {
            spanName = 'LangGraph'; // Match Python root span name
        } else {
            // Use the serialized name or a generic fallback, avoiding node-specific prefixes
            spanName = executionName;
        }
        // Removed node-specific logic:
        // const nodeName = metadata?.langgraph_node ? String(metadata.langgraph_node) : null;
        // if (nodeName) { ... } else { ... }

        this._startSpan(runId, spanName, spanType);
        // Record input associated with the started span
        const currentSpanId = this.runIdToSpanId[runId];
        if (currentSpanId) {
            // Input is recorded in the current context span of the TraceClient
            traceClient.recordInput({ args: inputs /* , options: options */ }); // Removed spanId
        }
    }

    async onChainEnd(
        outputs: Record<string, unknown> | string, // Output can sometimes be a simple string
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        // console.log(`>>> onChainEnd: runId: ${runId}`); // Debug log
        // Output is recorded within _endSpan
        this._endSpan(runId, outputs);
    }

    async onChainError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        // console.error(`>>> onChainError: runId: ${runId}`, error); // Debug log
         // Error is recorded within _endSpan
        this._endSpan(runId, undefined, error);
    }

    // --- LLM Events ---
    private _getLlmSpanName(serialized?: Serialized): string {
        // Simplify extraction if possible, check common patterns
        const idPath = (serialized?.id ?? []).join('/').toLowerCase();
        if (idPath.includes("openai")) return "OPENAI_API_CALL";
        if (idPath.includes("anthropic")) return "ANTHROPIC_API_CALL";
        if (idPath.includes("together")) return "TOGETHER_API_CALL";
        // Add other common providers if needed (e.g., google, bedrock)
        return "LLM_CALL"; // Default
    }

    // Generic LLM Start handler (covers both base LLM and ChatModel)
    private async _handleLlmStart(
        serialized: Serialized,
        runId: string,
        inputData: { prompts: string[] } | { messages: BaseMessage[][] },
        extraParams?: Record<string, unknown> | undefined,
        // tags?: string[] | undefined, // Often unused for LLM spans
        // metadata?: Record<string, unknown> | undefined, // Often unused for LLM spans
        options?: Record<string, any> // Langchain passes invocation params here
    ): Promise<void> {
        // console.log(`>>> _handleLlmStart: runId: ${runId}`); // Debug log
        const traceClient = this._getActiveTraceClient();
        if (!traceClient) return;

        // Extract model name from options (common pattern) or extraParams
        const invocationParams = options?.invocation_params as Record<string, any> ?? extraParams ?? {};
        const modelName = invocationParams?.model_name ?? invocationParams?.model ?? 'unknown_model';
        const spanName = this._getLlmSpanName(serialized);

        this._startSpan(runId, spanName, "llm");

        // Prepare input payload
        let inputPayload: Record<string, any> = {
            model: modelName,
            params: invocationParams, // Record all invocation params
            // options: options // May include other config besides invocation_params
        };
        if ('prompts' in inputData) {
            inputPayload.prompts = inputData.prompts;
        } else if ('messages' in inputData) {
            // Langchain JS passes messages as BaseMessage[][]
            inputPayload.messages = inputData.messages[0] ?? []; // Extract first batch element safely
        }

        // Record input associated with the started span
        const currentSpanId = this.runIdToSpanId[runId];
        if (currentSpanId) {
            // Input is recorded in the current context span of the TraceClient
            traceClient.recordInput(inputPayload); // Removed spanId
        }
    }

    async onLlmStart(
        serialized: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        options?: Record<string, any> // options might contain invocation_params
    ): Promise<void> {
        console.log(`[Judgeval Handler] onLlmStart called for runId: ${runId}`); // Added log
        await this._handleLlmStart(serialized, runId, { prompts }, extraParams, options);
    }

     // Handles Chat Model start specifically
     async onChatModelStart(
         serialized: Serialized,
         messages: BaseMessage[][],
         runId: string,
         parentRunId?: string | undefined,
         extraParams?: Record<string, unknown> | undefined,
         tags?: string[] | undefined,
         metadata?: Record<string, unknown> | undefined,
         options?: Record<string, any> // options might contain invocation_params
     ): Promise<void> {
         console.log(`[Judgeval Handler] onChatModelStart called for runId: ${runId}`); // Added log
         await this._handleLlmStart(serialized, runId, { messages }, extraParams, options);
     }


    /**
     * Handles the end of an LLM call. Extracts the output, usage data, and ends the corresponding span.
     * @param output The result from the LLM call.
     * @param runId The unique ID of the run.
     */
    async onLlmEnd(output: LLMResult, runId: string): Promise<void> {
        // console.log(`>>> onLlmEnd: runId: ${runId}`); // Debug log
        const traceClient = this._getActiveTraceClient();
        const spanId = this.runIdToSpanId[runId]; // Needed for context if recording output directly here
        if (!traceClient || !spanId) {
            // console.warn(`Judgeval Handler: Skipping onLlmEnd for runId ${runId}. Trace client or span ID missing.`); // Debug log
            this._endSpan(runId, output); // Still attempt to end span if possible, passing raw output
            return;
         }

        // Process LLMResult to extract relevant data
        const generation: Generation | undefined = output.generations?.[0]?.[0];
        let llmOutputPayload: Record<string, any> = {};

        if (generation) {
             // Handle ChatGeneration vs regular Generation
            if ("message" in generation && generation.message instanceof BaseMessage) {
                const aiMessage = generation.message as AIMessage; // Assume AI message for output
                llmOutputPayload.content = aiMessage.content;
                // Include tool calls if present
                if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                    llmOutputPayload.tool_calls = aiMessage.tool_calls;
                }
                if (aiMessage.invalid_tool_calls && aiMessage.invalid_tool_calls.length > 0) {
                     llmOutputPayload.invalid_tool_calls = aiMessage.invalid_tool_calls;
                }
                // Usage metadata might be here (e.g., OpenAI)
                if (aiMessage.usage_metadata) {
                    llmOutputPayload.usage_metadata = aiMessage.usage_metadata;
                }
            } else if (generation.text) {
                // Handle plain text generation
                llmOutputPayload.content = generation.text;
            }

            // Standardize token usage extraction if not in usage_metadata
            // Check generationInfo first, then llmOutput
            const tokenUsage = generation.generationInfo?.tokenUsage ?? output.llmOutput?.tokenUsage;
            if (tokenUsage && !llmOutputPayload.usage_metadata?.token_usage) { // Avoid duplication if already in usage_metadata
                llmOutputPayload.token_usage = { // Nest under a consistent key
                     completionTokens: (tokenUsage as any).completionTokens ?? (tokenUsage as any).completion_tokens,
                     promptTokens: (tokenUsage as any).promptTokens ?? (tokenUsage as any).prompt_tokens,
                     totalTokens: (tokenUsage as any).totalTokens ?? (tokenUsage as any).total_tokens,
                 };
                 // Normalize keys within usage_metadata if present
            } else if (llmOutputPayload.usage_metadata?.token_usage) {
                 const usageMeta = llmOutputPayload.usage_metadata.token_usage as any;
                 llmOutputPayload.token_usage = {
                     completionTokens: usageMeta.completionTokens ?? usageMeta.completion_tokens,
                     promptTokens: usageMeta.promptTokens ?? usageMeta.prompt_tokens,
                     totalTokens: usageMeta.totalTokens ?? usageMeta.total_tokens,
                 }
            }

             // Include other generationInfo if available and potentially useful
             if (generation.generationInfo) {
                 llmOutputPayload.generation_info = generation.generationInfo;
             }

        }

        // Include raw LLM output if available and potentially useful (can be verbose)
        // if (output.llmOutput) {
        //      llmOutputPayload.raw_llm_output = output.llmOutput;
        // }

        // Output is recorded within _endSpan
        this._endSpan(runId, llmOutputPayload);
    }

    async onLlmError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        // console.error(`>>> onLlmError: runId: ${runId}`, error); // Debug log
        // Error is recorded within _endSpan
        this._endSpan(runId, undefined, error);
    }

    // --- Tool Events ---
    async onToolStart(
        serialized: Serialized,
        inputStr: string, // input is often a stringified object
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        console.log(`[Judgeval Handler] onToolStart called for runId: ${runId}`); // Added log
        // console.log(`>>> onToolStart: runId: ${runId}, name: ${serialized?.name}`); // Debug log
        const traceClient = this._getActiveTraceClient();
        if (!traceClient) return;

        // Match Python: Use the tool name directly as the span name
        const toolName = serialized?.name ?? 'Unknown Tool';
        const spanName = toolName; // Removed "TOOL: " prefix
        this._startSpan(runId, spanName, "tool");

        // Try to parse inputStr if it's JSON, otherwise keep as string
        let parsedInput: any = inputStr;
        try {
            // Avoid parsing null/empty strings
            if (inputStr && inputStr.trim().startsWith('{') && inputStr.trim().endsWith('}')) {
                parsedInput = JSON.parse(inputStr);
            }
        } catch (e) {
            // Ignore error, keep as string if parsing fails
        }

        // Record input associated with the started span
        const currentSpanId = this.runIdToSpanId[runId];
        if (currentSpanId) {
           // Input is recorded in the current context span of the TraceClient
           traceClient.recordInput({ input: parsedInput /* , options: options */ }); // Removed spanId
        }
        // Track tool execution (if needed externally)
        // this.executedTools.push(toolName); // Example
    }

    async onToolEnd(
        output: string, // Tool output is typically a string
        runId: string,
        parentRunId?: string | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        // console.log(`>>> onToolEnd: runId: ${runId}`); // Debug log
        // Output is recorded within _endSpan
        this._endSpan(runId, output);
    }

    async onToolError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        // options?: Record<string, any> // Not typically passed here
    ): Promise<void> {
        // console.error(`>>> onToolError: runId: ${runId}`, error); // Debug log
        // Error is recorded within _endSpan
        this._endSpan(runId, undefined, error);
    }

     // --- Retriever Events ---
     async onRetrieverStart(
         serialized: Serialized,
         query: string,
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         metadata?: Record<string, unknown> | undefined,
         // options?: Record<string, any> // Not typically passed here
     ): Promise<void> {
         console.log(`[Judgeval Handler] onRetrieverStart called for runId: ${runId}`); // Added log
         // console.log(`>>> onRetrieverStart: runId: ${runId}, name: ${serialized?.name}`); // Debug log
         const traceClient = this._getActiveTraceClient();
         if (!traceClient) return;

         // Match Python naming convention
         const retrieverName = serialized?.name;
         let spanName: string;
         if (retrieverName) {
             spanName = `RETRIEVER_${retrieverName.toUpperCase()}`;
         } else {
             spanName = "RETRIEVER_CALL";
         }
         // const spanName = `RETRIEVER: ${retrieverName}`; // Old naming
         this._startSpan(runId, spanName, "retriever"); // Use 'retriever' span type

         // Record input associated with the started span
         const currentSpanId = this.runIdToSpanId[runId];
         if (currentSpanId) {
            // Input is recorded in the current context span of the TraceClient
            traceClient.recordInput({ query: query /* , options: options */ }); // Removed spanId
         }
     }

     async onRetrieverEnd(
         documents: Document[],
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         // options?: Record<string, any> // Not typically passed here
     ): Promise<void> {
         // console.log(`>>> onRetrieverEnd: runId: ${runId}, docs: ${documents.length}`); // Debug log
         const traceClient = this._getActiveTraceClient();
         if (!traceClient) {
             // If no trace client, we still need to clean up the runId mapping potentially
             this._endSpan(runId);
             return;
         }

         // Format output similar to Python's handler
         const docSummary = documents.map((doc, i) => ({
             index: i,
             page_content: doc.pageContent.substring(0, 150) + (doc.pageContent.length > 150 ? "..." : ""), // Slightly longer preview
             metadata: doc.metadata,
         }));

         const output = {
             document_count: documents.length,
             documents: docSummary,
         };
         // Output is recorded within _endSpan
         this._endSpan(runId, output);
     }

      async onRetrieverError(
         error: Error | any,
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         // options?: Record<string, any> // Not typically passed here
      ): Promise<void> {
          // console.error(`>>> onRetrieverError: runId: ${runId}`, error); // Debug log
          // Error is recorded within _endSpan
          this._endSpan(runId, undefined, error);
     }

    // --- Agent Events (Implement if needed) ---
    // These are less common in standard LangGraph agent flows but can be added if using AgentExecutor directly
    // async onAgentAction(action: AgentAction, runId: string, ...): Promise<void> { ... }
    // async onAgentFinish(finish: AgentFinish, runId: string, ...): Promise<void> { ... }

    // --- Text Event (Rarely needed for LangGraph tracing) ---
    // async onText(text: string, runId: string, ...): Promise<void> { ... }

}