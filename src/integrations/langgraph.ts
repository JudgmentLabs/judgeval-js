// judgeval-js/src/integrations/langgraph.ts

import {
    BaseCallbackHandler,
    // Import specific types for parameters as needed, e.g.:
    // Serialized, LLMResult, BaseMessage, Document, AgentAction, AgentFinish
} from "@langchain/core/callbacks/base";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { LLMResult, Generation } from "@langchain/core/outputs";
import type { BaseMessage, AIMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import { BaseTracer } from "@langchain/core/tracers/base";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGeneration } from "@langchain/core/outputs"; // Import ChatGeneration

import { v4 as uuidv4 } from 'uuid';
import { Tracer, TraceClient, SpanType } from "../common/tracer"; // Adjust path

// --- Global Handler Setup (Manual) ---
// NOTE: LangChain JS context propagation might work differently than Python's hooks.
// This provides a way to manually set a handler for a specific execution context.
// More robust solutions might involve AsyncLocalStorage or specific Langchain config.
let globalJudgevalHandler: JudgevalLanggraphCallbackHandler | null = null;

export function setGlobalJudgevalHandler(handler: JudgevalLanggraphCallbackHandler | null): void {
    globalJudgevalHandler = handler;
}

export function getGlobalJudgevalHandler(): JudgevalLanggraphCallbackHandler | null {
    return globalJudgevalHandler;
}
// ---

export class JudgevalLanggraphCallbackHandler extends BaseCallbackHandler {
    name = "judgeval_langgraph_callback_handler"; // Identifier for the handler

    private tracer: Tracer;
    private traceClient: TraceClient | null = null;
    private spanIdStack: string[] = []; // To track nested spans managed by this handler
    private spanStartTimes: Record<string, number> = {}; // Store start time per spanId
    private rootSpanId: string | null = null; // Track the top-level LangGraph span
    private handlerCreatedTrace: boolean = false; // Flag if this handler initiated the trace

    // Add state similar to Python if needed (e.g., for node tracking)
    private previousNode: string | null = null;
    // executed_nodes: string[] = []; // Not directly used in Python logic shown
    // executed_tools: string[] = []; // Not directly used in Python logic shown

    constructor(tracer?: Tracer) {
        super(); // Call parent constructor
        this.tracer = tracer ?? Tracer.getInstance(); // Use provided or singleton tracer
        // Attempt to get trace client if already in a context (e.g., wrapped in runInTrace)
        this.traceClient = this.tracer.getCurrentTrace() ?? null;
        console.log(`Judgeval Handler Initialized. Initial TraceClient: ${this.traceClient ? this.traceClient.traceId : 'None'}`);
    }

    private _ensureTraceClient(parentRunId?: string): boolean {
        // If a traceClient already exists (from higher context), use it.
        if (this.traceClient) {
            // If an outer trace exists, this handler didn't create it.
            this.handlerCreatedTrace = false;
            return true;
        }
        // If monitoring is disabled globally, don't create a trace.
        if (!this.tracer.enableMonitoring) {
            console.log("Judgeval Handler: Monitoring disabled, skipping trace creation.");
            return false;
        }

        // If no trace client, this is likely the root call for LangGraph within this handler's scope.
        // Create a new root trace specifically for this LangGraph run.
        const traceName = `langgraph-run-${parentRunId ?? uuidv4()}`;
        console.log(`Judgeval Handler: No active trace found. Creating new root trace: ${traceName}`);

        // Use the internal method directly if accessible, otherwise replicate its core logic
        // Assuming _startTraceInternal is not directly public/callable
        try {
            const traceClient = new TraceClient({
                tracer: this.tracer,
                name: traceName,
                projectName: this.tracer.projectName,
                overwrite: false,
                enableMonitoring: this.tracer.enableMonitoring,
                enableEvaluations: this.tracer.enableEvaluations,
                apiKey: this.tracer.apiKey,
                organizationId: this.tracer.organizationId,
            });

            this.traceClient = traceClient;
            this.handlerCreatedTrace = true; // Mark that this handler instance created the trace

            // Save empty trace immediately
             this.traceClient.save(true).catch((err: any) => {
                 console.error(`Judgeval Handler: Failed to save initial empty trace for '${traceName}':`, err);
             });
             return true;
        } catch (error: any) {
             console.error("Judgeval Handler: Error creating TraceClient:", error);
             this.traceClient = null;
             this.handlerCreatedTrace = false;
             return false;
         }
    }

    private _startSpan(name: string, spanType: SpanType = "span"): string | null {
        if (!this.traceClient || !this.traceClient.enableMonitoring) return null;

        const startTime = Date.now() / 1000;
        const spanId = uuidv4();
        // Use stack top as parent, fallback to rootSpanId ONLY if the stack is empty (direct child of root)
        // Ensure result is string | undefined to match TraceEntry type
        const parentSpanId = this.spanIdStack.length > 0 ? this.spanIdStack[this.spanIdStack.length - 1] : (this.rootSpanId ?? undefined);

        // Calculate depth based on the handler's stack relative to the root span
        const depth = this.spanIdStack.length + (this.rootSpanId ? 1 : 0);

        this.traceClient.addEntry({
            type: 'enter',
            function: name,
            span_id: spanId,
            depth: depth,
            timestamp: startTime,
            span_type: spanType,
            parent_span_id: parentSpanId
        });

        this.spanStartTimes[spanId] = startTime;
        this.spanIdStack.push(spanId);

        // If this is the *first* span started by the handler in a trace it created, mark it as root
        if (this.handlerCreatedTrace && !this.rootSpanId) {
            this.rootSpanId = spanId;
            console.log(`Judgeval Handler: Marked ${spanId} as root span for trace ${this.traceClient.traceId}`);
        }

        return spanId;
    }

    // Helper to get the function name associated with a span ID from the enter entry
    private _getFunctionNameForSpan(spanId: string): string {
        if (!this.traceClient) return "unknown_function";
        const enterEntry = this.traceClient.entries.find(e => e.span_id === spanId && e.type === 'enter');
        return enterEntry?.function ?? "unknown_function";
    }


    private _endSpan(spanId: string | null, spanType: SpanType = "span"): void {
         if (!spanId || !this.traceClient || !this.traceClient.enableMonitoring || !(spanId in this.spanStartTimes)) {
             // console.log(`Judgeval Handler: Skipping endSpan for ${spanId} - trace/time missing`);
             return;
         }

         // Pop the correct span from the stack
         if (this.spanIdStack.length > 0 && this.spanIdStack[this.spanIdStack.length - 1] === spanId) {
             this.spanIdStack.pop();
         } else {
              console.warn(`Judgeval Handler: Span ID mismatch on exit. Stack top: ${this.spanIdStack[this.spanIdStack.length - 1]}, ending span: ${spanId}.`);
              // Avoid popping if mismatch to prevent errors, but log it.
         }

         const startTime = this.spanStartTimes[spanId];
         const endTime = Date.now() / 1000;
         const duration = endTime - startTime;
         const depth = this.spanIdStack.length + (this.rootSpanId ? 1 : 0); // Depth after pop
         const functionName = this._getFunctionNameForSpan(spanId); // Get function name

         this.traceClient.addEntry({
             type: 'exit',
             function: functionName, // Use stored function name
             span_id: spanId,
             depth: depth,
             timestamp: endTime,
             duration: duration,
             span_type: spanType
         });

         // Clean up start time
         delete this.spanStartTimes[spanId];

         // If this was the root span ending AND the handler created the trace, save it.
         if (spanId === this.rootSpanId && this.handlerCreatedTrace && this.traceClient) {
             console.log(`Judgeval Handler: Root span ${this.rootSpanId} ended. Saving trace ${this.traceClient.traceId}`);
             const clientToSave = this.traceClient; // Capture client in case it gets reset
             this.rootSpanId = null; // Reset root marker
             this.handlerCreatedTrace = false; // Reset flag
             this.traceClient = this.tracer.getCurrentTrace() ?? null; // Reset to any outer trace *before* async save

             clientToSave.save(false).catch((err: any) => {
                 console.error(`Judgeval Handler: Failed to save final trace ${clientToSave.traceId}:`, err);
             }).finally(() => {
                 // Additional cleanup if needed after save completes/fails
                 console.log(`Judgeval Handler: Trace ${clientToSave.traceId} save process finished.`);
                 // Reset stack/times only after ensuring save is attempted
                 this.spanIdStack = [];
                 this.spanStartTimes = {};
             });
         }
    }

    // --- Chain Events ---
    async onChainStart(
        serialized: Serialized,
        inputs: Record<string, unknown>,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        // kwargs?: any // Langchain JS often uses a single 'options' or 'config' object at the end
        options?: Record<string, any> // Check if options are passed here
    ): Promise<void> {
        const currentSpanIdBeforeStart = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        // Ensure trace exists, potentially creating a root trace for this graph run
        const traceActive = this._ensureTraceClient(parentRunId ?? runId);
        if (!traceActive || !this.traceClient) {
            // console.log("Judgeval Handler: Trace not active in onChainStart");
            return;
        }

        let spanName = "CHAIN";
        let spanType: SpanType = "chain";
        // Langchain JS might pass invocation name in metadata or serialized object
        const executionName = metadata?.name ?? serialized?.name ?? metadata?.langgraph_node ?? 'unknown_chain';
        const nodeName = metadata?.langgraph_node ? String(metadata.langgraph_node) : null;

        // Check if this is the root LangGraph call (heuristic based on Python)
        // Needs adjustment based on how Langchain JS identifies the root call
        // Using a simple check: if no rootSpanId is set *by this handler* yet.
        if (!this.rootSpanId && this.handlerCreatedTrace) {
            // console.log(`Judgeval Handler: Detected potential root chain start: ${executionName}`);
            spanName = `LangGraph Root: ${executionName}`; // More descriptive
            spanType = "chain";
            const spanId = this._startSpan(spanName, spanType);
            // this.rootSpanId is now set inside _startSpan for handler-created traces
            if(this.traceClient) { // Re-check traceClient after _startSpan
                 this.traceClient.recordInput({ args: inputs, options: options });
             }
        } else if (nodeName) {
            // This is a node within the graph
            spanName = `NODE: ${nodeName}`;
            spanType = "chain";
            const spanId = this._startSpan(spanName, spanType);
            if(this.traceClient) {
                 this.traceClient.recordInput({ args: inputs, options: options });
             }
            this.previousNode = nodeName;
        } else {
            // Generic chain step
            spanName = `CHAIN: ${executionName}`;
            spanType = "chain";
            const spanId = this._startSpan(spanName, spanType);
             if(this.traceClient) {
                 this.traceClient.recordInput({ args: inputs, options: options });
             }
        }
        // console.log(`Judgeval Handler: Started span ${spanName} (${this.spanIdStack[this.spanIdStack.length - 1]})`);
    }

    async onChainEnd(
        outputs: Record<string, unknown> | string, // Output can sometimes be a simple string
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        // console.log(`Judgeval Handler: onChainEnd called for span ${currentSpanId}, stack: ${this.spanIdStack}`);
        if (!this.traceClient || !currentSpanId) {
            // console.log("Judgeval Handler: Trace not active or no span ID in onChainEnd");
            return;
        }

        this.traceClient.recordOutput(outputs);

        // Determine span type based on stored function name (more reliable)
        const functionName = this._getFunctionNameForSpan(currentSpanId);
        let spanType: SpanType = "chain"; // Default
        if (functionName.startsWith("NODE:")) {
            spanType = "chain"; // Keep node type
            this.previousNode = null; // Reset previous node after ending its span
        } else if (functionName.startsWith("LangGraph Root:")) {
            spanType = "chain"; // Root span type
        }

        this._endSpan(currentSpanId, spanType);
        // console.log(`Judgeval Handler: Ended span ${functionName} (${currentSpanId})`);

         // Check for final graph end signal (adjust key if different in JS)
         // Langchain JS might use specific output keys or states
         const isEndSignal = (typeof outputs === 'object' && outputs !== null && ('__end__' in outputs || 'final_output' in outputs)) ||
                             (tags?.includes('graph:final_output')); // Check tags too

         if (isEndSignal) {
             console.log("Judgeval Handler: Graph finished signal detected.");
             // Ensure root span closure if it hasn't happened
             if (this.rootSpanId && this.spanStartTimes[this.rootSpanId]) {
                 console.log(`Judgeval Handler: Force closing root span ${this.rootSpanId} due to end signal.`);
                 this._endSpan(this.rootSpanId, "chain");
             }
         }
    }

    async onChainError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        // console.log(`Judgeval Handler: onChainError called for span ${currentSpanId}, stack: ${this.spanIdStack}`);
        if (!this.traceClient || !currentSpanId) {
             // console.log("Judgeval Handler: Trace not active or no span ID in onChainError");
             return;
        }

        console.error("Judgeval Handler: Chain Error:", error);
        this.traceClient.recordOutput(error instanceof Error ? error : new Error(String(error)));

        // Determine span type based on stored function name
        const functionName = this._getFunctionNameForSpan(currentSpanId);
        let spanType: SpanType = "chain";
        if (functionName.startsWith("NODE:")) {
            spanType = "chain";
            this.previousNode = null;
        } else if (functionName.startsWith("LangGraph Root:")) {
            spanType = "chain";
        }

        this._endSpan(currentSpanId, spanType);
        // console.log(`Judgeval Handler: Ended span ${functionName} (${currentSpanId}) due to error`);

         // Also ensure root span closure if an error occurs and handler created the trace
         if (this.rootSpanId && this.spanStartTimes[this.rootSpanId] && currentSpanId !== this.rootSpanId && this.handlerCreatedTrace) {
             console.error("Judgeval Handler: Error occurred, force closing root span.");
             this._endSpan(this.rootSpanId, "chain");
         }
    }

    // --- LLM Events ---
    async onLlmStart(
        serialized: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        if (!this._ensureTraceClient(parentRunId ?? runId) || !this.traceClient) return;

        const invocationParams = extraParams?.invocation_params as Record<string, any> ?? extraParams ?? {};
        const modelName = invocationParams?.model_name ?? invocationParams?.model ?? 'unknown_model';

        let spanName = "LLM_CALL";
        const serializedIdStr = JSON.stringify(serialized?.id ?? '').toLowerCase();
        if (serializedIdStr.includes("openai")) spanName = "OPENAI_API_CALL";
        else if (serializedIdStr.includes("anthropic")) spanName = "ANTHROPIC_API_CALL";
        else if (serializedIdStr.includes("together")) spanName = "TOGETHER_API_CALL";

        const spanId = this._startSpan(spanName, "llm");
        if(this.traceClient) {
             this.traceClient.recordInput({
                 model: modelName,
                 prompts: prompts, // Record prompts for basic LLMs
                 params: invocationParams,
                 options: options
             });
         }
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
         options?: Record<string, any>
     ): Promise<void> {
         if (!this._ensureTraceClient(parentRunId ?? runId) || !this.traceClient) return;

         const invocationParams = extraParams?.invocation_params as Record<string, any> ?? extraParams ?? {};
         const modelName = invocationParams?.model_name ?? invocationParams?.model ?? 'unknown_model';

         let spanName = "LLM_CALL";
         const serializedIdStr = JSON.stringify(serialized?.id ?? '').toLowerCase();
         if (serializedIdStr.includes("openai")) spanName = "OPENAI_API_CALL";
         else if (serializedIdStr.includes("anthropic")) spanName = "ANTHROPIC_API_CALL";
         else if (serializedIdStr.includes("together")) spanName = "TOGETHER_API_CALL";

         const spanId = this._startSpan(spanName, "llm");
         if(this.traceClient) {
             // Record inputs (assuming non-batch call for typical tracing)
             this.traceClient.recordInput({
                 model: modelName,
                 messages: messages[0], // Extract first batch element
                 params: invocationParams,
                 options: options
             });
         }
     }


    /**
     * Handles the end of an LLM call. Extracts the output, usage data, and ends the corresponding span.
     * @param output The result from the LLM call.
     * @param runId The unique ID of the run.
     * @param parentRunId The unique ID of the parent run, if any.
     */
    async onLlmEnd(output: LLMResult, runId: string): Promise<void> {
        // Get the current span ID. Ensure traceClient exists.
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        if (!this.traceClient || !currentSpanId) {
             console.warn(`Judgeval Handler: Skipping onLlmEnd for runId ${runId}. Trace client or span ID missing.`);
             return;
         }

        // Safely access the first generation object.
        const generation: Generation | undefined = output.generations?.[0]?.[0];

        // Initialize containers for extracted output and usage data.
        let llmOutputPayload: Record<string, any> = {};
        let usageData: Record<string, any> = {};

        if (generation) {
            // Extract content based on whether it's a chat message or plain text.
            // Check if it's a ChatGeneration which has the 'message' property
            if ("message" in generation) { // Check if 'message' property exists
                const chatGeneration = generation as ChatGeneration; // Cast to ChatGeneration
                if (chatGeneration.message._getType() === 'ai') {
                    const aiMessage = chatGeneration.message as AIMessage;
                    llmOutputPayload.content = aiMessage.content;
                    // Include other relevant fields from AIMessage if needed
                    llmOutputPayload.tool_calls = aiMessage.tool_calls;
                    llmOutputPayload.invalid_tool_calls = aiMessage.invalid_tool_calls;
                    llmOutputPayload.usage_metadata = aiMessage.usage_metadata;
                }
            } else if (generation.text) {
                llmOutputPayload.content = generation.text;
            }

            // Process generationInfo for usage data and other metadata.
            const { tokenUsage, ...restGenerationInfo } = generation.generationInfo ?? {};
            if (tokenUsage) {
                // Standardize keys (e.g., completionTokens vs completion_tokens)
                usageData.completionTokens = (tokenUsage as any).completionTokens ?? (tokenUsage as any).completion_tokens;
                usageData.promptTokens = (tokenUsage as any).promptTokens ?? (tokenUsage as any).prompt_tokens;
                usageData.totalTokens = (tokenUsage as any).totalTokens ?? (tokenUsage as any).total_tokens;
            } else {
                // Handle cases where tokenUsage might be nested differently or missing
                console.warn(`Judgeval Handler: Token usage data missing or in unexpected format for runId ${runId}.`);
            }

            // Merge the rest of generationInfo into the output payload.
            llmOutputPayload = { ...llmOutputPayload, ...restGenerationInfo };
        }

        // Include raw LLM output if available.
        if (output.llmOutput) {
            llmOutputPayload = { ...llmOutputPayload, rawLlmOutput: output.llmOutput };
        }

        // Record the output and end the span.
        this.traceClient.recordOutput(llmOutputPayload);
        this._endSpan(currentSpanId, "llm"); // Use _endSpan with the retrieved ID
    }

    async onLlmError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        if (!this.traceClient || !currentSpanId) return;

        console.error("Judgeval Handler: LLM Error:", error);
        this.traceClient.recordOutput(error instanceof Error ? error : new Error(String(error)));
        this._endSpan(currentSpanId, "llm");
    }

    // --- Tool Events ---
    async onToolStart(
        serialized: Serialized,
        inputStr: string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        options?: Record<string, any>
    ): Promise<void> {
         if (!this._ensureTraceClient(parentRunId ?? runId) || !this.traceClient) return;

         const toolName = serialized?.name ?? 'unknown_tool';
         const spanId = this._startSpan(toolName, "tool");
         if(this.traceClient) {
             this.traceClient.recordInput({ input_string: inputStr, options: options });
         }
    }

    async onToolEnd(
        output: string,
        runId: string,
        parentRunId?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        if (!this.traceClient || !currentSpanId) return;

        this.traceClient.recordOutput(output);
        this._endSpan(currentSpanId, "tool");
    }

    async onToolError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
        if (!this.traceClient || !currentSpanId) return;

        console.error("Judgeval Handler: Tool Error:", error);
        this.traceClient.recordOutput(error instanceof Error ? error : new Error(String(error)));
        this._endSpan(currentSpanId, "tool");
    }

     // --- Retriever Events ---
     async onRetrieverStart(
         serialized: Serialized,
         query: string,
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         metadata?: Record<string, unknown> | undefined,
         options?: Record<string, any>
     ): Promise<void> {
         if (!this._ensureTraceClient(parentRunId ?? runId) || !this.traceClient) return;

         const retrieverName = serialized?.name ?? 'unknown_retriever';
         const spanName = `RETRIEVER: ${retrieverName}`; // Match Python naming convention
         const spanId = this._startSpan(spanName, "tool"); // Treat retriever as a type of tool span

         if(this.traceClient) {
             this.traceClient.recordInput({ query: query, options: options });
         }
     }

     async onRetrieverEnd(
         documents: Document[],
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         options?: Record<string, any>
     ): Promise<void> {
         const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
         if (!this.traceClient || !currentSpanId) return;

         // Format output similar to Python
         const docSummary = documents.map((doc, i) => ({
             index: i,
             // Use pageContent for JS Document type
             page_content: doc.pageContent.substring(0, 100) + (doc.pageContent.length > 100 ? "..." : ""),
             metadata: doc.metadata,
         }));

         this.traceClient.recordOutput({
             document_count: documents.length,
             documents: docSummary,
         });
         this._endSpan(currentSpanId, "tool");
     }

      async onRetrieverError(
         error: Error | any,
         runId: string,
         parentRunId?: string | undefined,
         tags?: string[] | undefined,
         options?: Record<string, any>
      ): Promise<void> {
          const currentSpanId = this.spanIdStack[this.spanIdStack.length - 1] ?? null;
          if (!this.traceClient || !currentSpanId) return;

         console.error("Judgeval Handler: Retriever Error:", error);
         this.traceClient.recordOutput(error instanceof Error ? error : new Error(String(error)));
         this._endSpan(currentSpanId, "tool");
     }

    // --- Agent Events (Implement if needed, often less critical for basic tracing) ---
    // Add implementations based on Python if required
    // async onAgentAction(action: AgentAction, runId: string, parentRunId?: string | undefined, options?: Record<string, any>): Promise<void> { ... }
    // async onAgentFinish(finish: AgentFinish, runId: string, parentRunId?: string | undefined, options?: Record<string, any>): Promise<void> { ... }

    // Add other relevant on_... methods if needed (e.g., on_text)

} 