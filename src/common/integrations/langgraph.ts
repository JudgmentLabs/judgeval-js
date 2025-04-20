import { BaseCallbackHandler, } from "@langchain/core/callbacks/base";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { LLMResult } from "@langchain/core/outputs";
import { BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import { Tracer, TraceClient, SpanType, Rule } from "../tracer.js";
import { ChainValues } from "@langchain/core/utils/types";
import { OpenAIAssistantRunnable } from "langchain/experimental/openai_assistant";
import * as uuid from "uuid";

// Removed ActiveNodeSpan interface

// Match Python structure more closely
export class JudgevalLanggraphCallbackHandler extends BaseCallbackHandler {
    name = "judgeval_langgraph_callback_handler";

    private tracer: Tracer;
    private traceClient: TraceClient | undefined;
    private previousNode: string | undefined;
    private _startTime: number = 0; // Needed for TS manual duration calculation (if needed)
    private finished: boolean = false;
    private rootSpanStarted: boolean = false; // Still useful to track root
    // Removed activeNodeSpans array

    // Attributes for users to access (matching Python)
    readonly executedNodeTools: string[] = [];
    readonly executedNodes: string[] = []; // Add this like Python
    readonly executedTools: string[] = [];

    constructor(tracer?: Tracer) {
        super();
        this.tracer = tracer ?? Tracer.getInstance();
        console.log(`[Judgeval Handler] Initialized. Monitoring Enabled: ${this.tracer.enableMonitoring}`);
        // traceClient will be initialized in handleChainStart if needed
    }

    // --- Reset state helper (called internally) ---
    private initializeRunState(client: TraceClient) {
        this.traceClient = client;
        this.previousNode = undefined;
        this._startTime = 0;
        this.finished = false;
        this.rootSpanStarted = true; // Mark as started since we just created/found the client
        this.executedNodeTools.length = 0;
        this.executedNodes.length = 0;
        this.executedTools.length = 0;
        console.log(`[Judgeval Handler] Run state initialized for TraceClient ID: ${client.traceId}`);
    }

    // --- Span management (simplified, relies on TraceClient internals) ---
    private startSpan(name: string, spanType: SpanType = "span"): string | undefined {
        if (!this.traceClient) {
            console.warn(`[Judgeval Handler] startSpan(${name}, ${spanType}) called but traceClient is undefined.`);
            return undefined;
        }
        const parentSpanId = this.traceClient.getCurrentSpanId();
        console.log(`[Judgeval Handler] Before startSpan(${name}): Current Span ID = ${parentSpanId}`);
        this.traceClient.startSpan(name, { spanType }); // TraceClient handles stack
        const newSpanId = this.traceClient.getCurrentSpanId();
        console.log(`[Judgeval Handler] Started span: ${name} (ID: ${newSpanId}), Parent reported: ${parentSpanId}, Type: ${spanType}`);
        return newSpanId;
    }

    private endSpan(context?: string) {
        if (!this.traceClient) {
             console.warn(`[Judgeval Handler] endSpan(${context ?? ''}) called but traceClient is undefined.`);
             return;
        }
        const currentSpanId = this.traceClient.getCurrentSpanId();
        console.log(`[Judgeval Handler] Before endSpan(${context ?? ''}): Current Span ID = ${currentSpanId}`);
        this.traceClient.endSpan(); // TraceClient handles stack
        const spanIdAfterEnd = this.traceClient.getCurrentSpanId();
        console.log(`[Judgeval Handler] Ended span: ${currentSpanId} (Context: ${context ?? 'N/A'}). Current Span ID after end: ${spanIdAfterEnd}`);

        // Save logic: Python saves when depth returns to 0.
        // TS TraceClient doesn't expose depth. Rely on external context ending or manual save?
        // For now, let's stick to the previous logic: save if root finished and stack is empty.
        // The final endSpan call will be triggered by the tracer wrapper ideally.
         if (this.rootSpanStarted && this.finished && spanIdAfterEnd === undefined) {
             console.log("[Judgeval Handler] Root context likely ended and graph finished. Saving trace.");
              if (this.traceClient) {
                 // Save might need to happen *before* clearing the client
                 const clientToSave = this.traceClient;
                 this.traceClient = undefined; // Clear reference first?
                 this.rootSpanStarted = false;
                 clientToSave.save(true) // Save with overwrite=true
                   .then(() => console.log(`[Judgeval Handler] Trace ${clientToSave.traceId} saved.`))
                   .catch(err => console.error(`[Judgeval Handler] Error saving trace ${clientToSave.traceId}:`, err));
              } else {
                  console.warn("[Judgeval Handler] Cannot save trace as traceClient is undefined after root span ended.");
              }
         }
    }

    // --- Get or Create Client (Python logic adapted) ---
    private getOrCreateRootTraceClient(name?: string, runType?: string): TraceClient | undefined {
         if (!this.tracer.enableMonitoring) return undefined;

        // If a client already exists for this handler instance, return it
        if (this.traceClient) {
             // console.log(`[Judgeval Handler] Re-using existing TraceClient instance (ID: ${this.traceClient.traceId}).`);
             return this.traceClient;
        }

        // Check if we are starting the root LangGraph run (like Python's check)
        const isLangGraphRootStart = (name === 'LangGraph' || runType === 'Graph'); // Check both name and runType

        if (isLangGraphRootStart) {
            console.log("[Judgeval Handler] LangGraph root run detected. Getting/Creating TraceClient.");
             // Check context first, in case external wrapper is used
             let client = this.tracer.getCurrentTrace();
             if (client) {
                 console.log(`[Judgeval Handler] Found existing TraceClient in context (ID: ${client.traceId}). Initializing run state.`);
                 this.initializeRunState(client);
             } else {
                 // Create a new TraceClient if none exists (like Python)
                 console.log("[Judgeval Handler] No TraceClient in context, creating new one.");
                 const traceId = uuid.v4();
                 client = new TraceClient({
                     tracer: this.tracer,
                     traceId: traceId,
                     name: "LangGraphRun", // Default name
                     projectName: this.tracer.projectName,
                     overwrite: false,
                     rules: this.tracer.defaultRules,
                     enableMonitoring: this.tracer.enableMonitoring,
                     enableEvaluations: this.tracer.enableEvaluations,
                     apiKey: this.tracer.apiKey,
                     organizationId: this.tracer.organizationId
                 });
                 // Save empty trace immediately (like Python)
                 client.save(false).catch(err => console.error("[Judgeval Handler] Error saving initial empty trace:", err));
                 this.initializeRunState(client);
                 // We might need to manually set this client into the async context
                 // if LangChain doesn't propagate it from the initial invoke context.
                 // This is complex and might require changes to the Tracer class or usage pattern.
                 // For now, we store it locally in the handler.
                 console.log(`[Judgeval Handler] Created new TraceClient (ID: ${client.traceId}). Run state initialized.`);
             }
             // Start the root span *after* initializing the state
             this.startSpan("LangGraphRoot", "Main Function");
             return this.traceClient;
        } else {
            // If it's not the root start, try to get the client from context (might exist due to wrapper)
             let client = this.tracer.getCurrentTrace();
             if (client) {
                 // If we find a client but haven't initialized state, initialize now
                 if (!this.traceClient) {
                     console.log(`[Judgeval Handler] Found TraceClient in context mid-run (ID: ${client.traceId}). Initializing run state.`);
                      this.initializeRunState(client);
                 }
                 return this.traceClient;
             } else {
                 // No client found, and it's not the root start - likely context issue
                 console.warn(`[Judgeval Handler] handleChainStart called for non-root chain ('${name}') but no TraceClient found in context.`);
                 return undefined;
             }
        }
    }


    // --- Callback Handlers (Adapted to Python logic) ---

    async handleRetrieverStart(
        serialized: Serialized,
        query: string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        // Ensure client exists, but don't create it here
        this.traceClient = this.tracer.getCurrentTrace();
        if (!this.traceClient) {
             console.warn(`[Judgeval Handler] handleRetrieverStart: No TraceClient found.`);
             return;
        }

        let name_ = "RETRIEVER_CALL";
        if (name) {
            name_ = `RETRIEVER_${name.toUpperCase()}`;
        } else if (serialized?.name) {
            name_ = `RETRIEVER_${serialized.name.toUpperCase()}`;
        }

        this.startSpan(name_, "retriever");
        this.traceClient.recordInput({
            query,
            tags,
            metadata,
            options,
        });
    }

    async handleRetrieverEnd(
        documents: Document[],
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        // Use existing client
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;
        // ... record output (docSummary)
        const docSummary = documents.map((doc, i) => ({
            index: i,
            page_content: doc.pageContent.length > 100
                ? doc.pageContent.substring(0, 97) + "..."
                : doc.pageContent,
            metadata: doc.metadata,
        }));
        this.traceClient.recordOutput({ document_count: documents.length, documents: docSummary});
        this.endSpan("RetrieverEnd");
    }

    async handleRetrieverError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] Retriever error: ${error}`);
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;
        this.traceClient.recordError(error);
        this.endSpan("RetrieverError");
    }

    async handleChainStart(
        serialized: Serialized,
        inputs: Record<string, unknown>,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        runType?: string | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.log(`[Judgeval Handler] handleChainStart: Name=${name}, Type=${runType}, Node=${metadata?.langgraph_node}, RunID=${runId}`);

        // Initialize client and root span if this is the LangGraph start
        // Otherwise, ensure client exists from context
        const client = this.getOrCreateRootTraceClient(name, runType);
        if (!client) return; // If no client (monitoring off or context issue), do nothing

        // Now handle node detection (if not the root start event itself)
        const isLangGraphRootStartEvent = (name === 'LangGraph' || runType === 'Graph') && this.rootSpanStarted;
        const nodeName = metadata?.langgraph_node as string | undefined;

        // Don't process the root start event as a node start
        if (isLangGraphRootStartEvent && nodeName === undefined) { // Check nodeName too
            console.log(`[Judgeval Handler] Skipping node processing for root start event.`);
            return;
        }

        // If it's a node and different from the previous one
        if (nodeName && nodeName !== this.previousNode) {
             console.log(`[Judgeval Handler] New node detected: ${nodeName}`);
             // Start a span for the node
             this.startSpan(nodeName, "node");

             // Update tracking (like Python)
             this.executedNodes.push(nodeName);
             // Update node:tool tracking context
             this.previousNode = nodeName;

             // Record input for the node span (like Python)
             this.traceClient?.recordInput({
                 args: inputs,
                 kwargs: { tags, metadata, runType, name: nodeName, options }
             });

        } else if (nodeName && nodeName === this.previousNode) {
             // It's a chain start within the *same* node, log but don't start new node span
             console.log(`[Judgeval Handler] Chain start ('${name}') within existing node context ('${nodeName}').`);
        } else {
             // It's some other chain, maybe log it?
             console.log(`[Judgeval Handler] Generic chain start ('${name}') detected. Node context: '${this.previousNode}'.`);
        }
    }

    async handleChainEnd(
        outputs: Record<string, unknown> | string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined, // Need metadata
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.traceClient?.getCurrentSpanId();
        const nodeNameFromMetadata = metadata?.langgraph_node as string | undefined;
        console.log(`[Judgeval Handler] handleChainEnd: RunID=${runId}, Node=${nodeNameFromMetadata}, CurrentSpanID=${currentSpanId}`);

        if (!this.traceClient || !currentSpanId) {
             console.warn(`[Judgeval Handler] handleChainEnd called but no active span. RunID=${runId}`);
             return;
        }

        // Always record output
        this.traceClient.recordOutput(outputs);

        // Check if this marks the end of a graph step (node)
        const isGraphStepEnd = tags?.some(tag => tag.includes("graph:step"));

        if (isGraphStepEnd) {
            console.log(`[Judgeval Handler] Graph step end detected for span: ${currentSpanId}. Ending span as 'node'.`);
            // Assume the current span *is* the node span
            this.endSpan(`NodeEnd: ${this.previousNode ?? 'unknown'}`); // Use previousNode hint
        }

        // Check for graph finish signal AFTER potentially ending the node span
        const isEndSignal = outputs === "__end__";
        const isGraphFinishTag = tags?.some(tag => tag.includes(":graph:finish") || tag.includes(":__end__"));
        if (isEndSignal || isGraphFinishTag) {
            console.log(`[Judgeval Handler] Graph finished signal detected.`);
            this.finished = true;

            // End the root span if it's currently active
            const currentSpanIdAfterNodeEnd = this.traceClient?.getCurrentSpanId();
            if (this.rootSpanStarted && !currentSpanIdAfterNodeEnd) {
                console.log(`[Judgeval Handler] Graph finished signal and span stack is empty. Save should occur.`);
            }
        }
    }

    async handleChainError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] Chain error: ${error}`);
        const currentSpanId = this.traceClient?.getCurrentSpanId();
        console.log(`[Judgeval Handler] ChainError occurred during span: ${currentSpanId}`);

        if (!this.traceClient || !currentSpanId) return;

        this.traceClient.recordError(error);

        // Check if the error occurred within a node span we are tracking
        // Need a robust way to know if the current span is a node span started by us
        // For now, assume if it's a graph step error, end the current span as node error
        const isGraphStepError = tags?.some(tag => tag.includes("graph:step"));
        if (isGraphStepError) {
             console.log(`[Judgeval Handler] Ending current span ${currentSpanId} as NodeError due to graph:step tag.`);
             this.endSpan(`NodeError: ${this.previousNode ?? 'unknown'}`);
        }
         // Don't end generic chain errors otherwise, might pop root span too early.
    }

    async handleToolStart(
        serialized: Serialized,
        inputStr: string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const toolName = name ?? serialized?.name ?? "unknown_tool";
        console.log(`[Judgeval Handler] handleToolStart: Name=${toolName}, RunID=${runId}`);

        // Ensure client exists
        this.traceClient = this.tracer.getCurrentTrace();
        if (!this.traceClient) {
            console.warn(`[Judgeval Handler] handleToolStart: No TraceClient found.`);
            return;
        }

        // this.previousNode should be set by the last handleChainStart for the node
        console.log(`[Judgeval Handler] Starting tool span: ${toolName} (Parent Node Hint: ${this.previousNode})`);
        this.startSpan(toolName, "tool");

        this.executedTools.push(toolName);
        const nodeTool = this.previousNode ? `${this.previousNode}:${toolName}` : toolName;
        this.executedNodeTools.push(nodeTool);

        this.traceClient.recordInput({
            args: inputStr,
            kwargs: { tags, metadata, options }
        });
    }

    async handleToolEnd(
        output: string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const currentSpanId = this.traceClient?.getCurrentSpanId();
        console.log(`[Judgeval Handler] handleToolEnd: RunID=${runId}, CurrentSpanID=${currentSpanId}`);
        if (!this.traceClient || !currentSpanId) return;
        this.traceClient.recordOutput(output);
        this.endSpan("ToolEnd"); // End specifically for tool
    }

    async handleToolError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] Tool error: ${error}`);
        const currentSpanId = this.traceClient?.getCurrentSpanId();
        if (!this.traceClient || !currentSpanId) return;
        this.traceClient.recordError(error);
        this.endSpan("ToolError"); // End specifically for tool error
    }

    // AgentAction / AgentFinish remain no-op for span management
    async handleAgentAction(/* ... */): Promise<void> {}
    async handleAgentFinish(/* ... */): Promise<void> {}

    async handleLLMStart(
        serialized: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const llmName = name ?? "LLM call";
        // Ensure client exists
        this.traceClient = this.tracer.getCurrentTrace();
        if (!this.traceClient) {
            console.warn(`[Judgeval Handler] handleLLMStart: No TraceClient found.`);
            return;
        }

        console.log(`[Judgeval Handler] Starting LLM span: ${llmName}`);
        this.startSpan(llmName, "llm");
        this.traceClient.recordInput({
            args: prompts,
            kwargs: {
                extra_params: extraParams,
                tags: tags,
                metadata: metadata,
                serialized_id: serialized?.id,
                ...options,
            },
        });
    }

    async handleLLMEnd(
        output: LLMResult,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;
        // ... extract textOutput ...
        let textOutput = "No text output found";
        try {
            if (output.generations && output.generations.length > 0 && output.generations[0].length > 0) {
                 const firstGen = output.generations[0][0];
                 if (firstGen.text) {
                    textOutput = firstGen.text;
                 } else if ('message' in firstGen && firstGen.message && typeof firstGen.message === 'object' && firstGen.message !== null && 'content' in firstGen.message) {
                    const messageContent = firstGen.message.content;
                    textOutput = typeof messageContent === 'string'
                        ? messageContent
                        : JSON.stringify(messageContent);
                 }
            } else if (output.llmOutput) {
                textOutput = JSON.stringify(output.llmOutput);
            }
        } catch (e) {
             console.error("[Judgeval Handler] Error extracting LLM output text:", e);
             textOutput = `Error extracting output: ${e instanceof Error ? e.message : String(e)}`;
        }
        this.traceClient.recordOutput(textOutput);
        console.log(`[Judgeval Handler] Ending LLM span: ${this.traceClient.getCurrentSpanId()}`);
        this.endSpan("LLMEnd"); // End specifically for LLM
    }

    async handleLLMError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] LLM error: ${error}`);
        const currentSpanId = this.traceClient?.getCurrentSpanId();
        if (!this.traceClient || !currentSpanId) return;
        this.traceClient.recordError(error);
        this.endSpan("LLMError"); // End specifically for LLM error
    }

    async handleChatModelStart(
        serialized: Serialized,
        messages: BaseMessage[][],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        // Ensure client exists
        this.traceClient = this.tracer.getCurrentTrace();
        if (!this.traceClient) {
            console.warn(`[Judgeval Handler] handleChatModelStart: No TraceClient found.`);
            return;
        }

        let modelName = "LLM call";
        const serializedId = serialized?.id?.join("::") ?? "";

        if (name) {
            modelName = name;
        } else if (serializedId.includes("openai")) {
            modelName = "OPENAI_API_CALL";
        } else if (serializedId.includes("anthropic")) {
            modelName = "ANTHROPIC_API_CALL";
        } else if (serializedId.includes("together")) {
            modelName = "TOGETHER_API_CALL";
        }

        console.log(`[Judgeval Handler] Starting ChatModel span: ${modelName}`);
        this.startSpan(modelName, "llm");
        this.traceClient.recordInput({
            args: JSON.stringify(messages.map(msgList => msgList.map(msg => msg.toDict()))),
            kwargs: {
                extra_params: extraParams,
                tags: tags,
                metadata: metadata,
                serialized_id: serializedId,
                ...options,
            },
        });
        // Note: handleLLMEnd will end this span
    }
}