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

// It's my understanding that you can only be on one node in the graph at a time
// That means we don't need to worry about the async problem
export class JudgevalLanggraphCallbackHandler extends BaseCallbackHandler {
    name = "judgeval_langgraph_callback_handler";

    private tracer: Tracer;
    private traceClient: TraceClient | undefined;
    private previousNode: string | undefined;
    private _startTime: number = 0;
    private finished: boolean = false;
    private rootSpanStarted: boolean = false;

    readonly executedNodeTools: string[] = [];
    readonly executedNodes: string[] = [];
    readonly executedTools: string[] = [];

    constructor(tracer?: Tracer) {
        super();
        this.tracer = tracer ?? Tracer.getInstance();
        console.log(`[Judgeval Handler] Initialized. Monitoring Enabled: ${this.tracer.enableMonitoring}`);
    }

    private initializeRunState() {
        this.traceClient = this.tracer.getCurrentTrace();
        this.previousNode = undefined;
        this._startTime = 0;
        this.finished = false;
        this.rootSpanStarted = false;
        this.executedNodeTools.length = 0;
        this.executedNodes.length = 0;
        this.executedTools.length = 0;
    }

    private startSpan(name: string, spanType: SpanType = "span") {
        if (!this.traceClient) return;
        const parentSpanId = this.traceClient.getCurrentSpanId(); // Get parent ID before starting new span
        this._startTime = Date.now();
        this.traceClient.startSpan(name, { spanType });
        console.log(`[Judgeval Handler] Started span: ${name} (ID: ${this.traceClient.getCurrentSpanId()}), Parent: ${parentSpanId}, Type: ${spanType}`);
    }

    private endSpan() {
        if (!this.traceClient) return;
        const currentSpanId = this.traceClient.getCurrentSpanId();
        this.traceClient.endSpan();
        console.log(`[Judgeval Handler] Ended span: ${currentSpanId}. Current Span ID after end: ${this.traceClient.getCurrentSpanId()}`);

        if (this.rootSpanStarted && this.finished && this.traceClient.getCurrentSpanId() === undefined) {
            console.log("[Judgeval Handler] Root span ended and graph finished. Saving trace.");
            this.traceClient.save(true);
            this.traceClient = undefined;
            this.rootSpanStarted = false;
        }
    }

    private getOrCreateTraceClient(): TraceClient | undefined {
        if (!this.tracer.enableMonitoring) {
            // console.log("[Judgeval Handler] Monitoring is disabled.");
            return undefined;
        }

        let client = this.tracer.getCurrentTrace();
        if (client) {
            // console.log(`[Judgeval Handler] Found active trace client in context: ${client.traceId}`);
            this.traceClient = client;
            return this.traceClient;
        } else {
            // If no client is found in the context, log a warning and do nothing.
            // This handler relies on the trace context being set up externally.
            console.warn("[Judgeval Handler] No active trace client found in AsyncLocalStorage context. Spans may be missed. Ensure the LangGraph execution is wrapped in tracer.trace() or tracer.observe().");
            this.traceClient = undefined; // Ensure internal client is also undefined
            return undefined;
        }
        // Code below is removed as the handler should not create traces itself.
        /*
        console.log("[Judgeval Handler] No active trace found in context, creating a new one for LangGraph run.");
        const traceId = uuid.v4();
        const project = this.tracer.projectName;
        client = new TraceClient({
            tracer: this.tracer,
            traceId: traceId,
            name: "LangGraphRun",
            projectName: project,
            overwrite: false,
            rules: this.tracer.defaultRules,
            enableMonitoring: this.tracer.enableMonitoring,
            enableEvaluations: this.tracer.enableEvaluations,
            apiKey: this.tracer.apiKey,
            organizationId: this.tracer.organizationId
        });
        this.traceClient = client;
        this.traceClient.save(false);
        return this.traceClient;
        */
    }

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
        let name_ = "RETRIEVER_CALL";
        if (name) {
            name_ = `RETRIEVER_${name.toUpperCase()}`;
        } else if (serialized?.name) {
            name_ = `RETRIEVER_${serialized.name.toUpperCase()}`;
        }

        this.getOrCreateTraceClient();
        if (!this.traceClient) return;

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
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;

        const docSummary = documents.map((doc, i) => ({
            index: i,
            page_content: doc.pageContent.length > 100
                ? doc.pageContent.substring(0, 97) + "..."
                : doc.pageContent,
            metadata: doc.metadata,
        }));

        this.traceClient.recordOutput({
            document_count: documents.length,
            documents: docSummary
        });

        this.endSpan();
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
        this.endSpan();
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
        this.getOrCreateTraceClient();
        if (!this.traceClient) return;

        const isLangGraphRoot = runType === 'Graph' || name === 'LangGraph';

        if (isLangGraphRoot && !this.rootSpanStarted) {
            console.log("[Judgeval Handler] Starting LangGraph root span.");
            this.initializeRunState();
            this.getOrCreateTraceClient();
            if (!this.traceClient) return;

            const rootSpanName = "LangGraphRoot";
            this.startSpan(rootSpanName, "Main Function");
            this.rootSpanStarted = true;
            this.traceClient.recordInput({
                 args: inputs,
                 kwargs: { tags, metadata, runType, name, options }
            });
            return;
        }

        // --- Handle Node Starts (Primary Check: metadata.langgraph_node) ---
        const nodeName = metadata?.langgraph_node as string | undefined;

        if (nodeName && nodeName !== this.previousNode) {
            // Ensure we are inside the root span before starting a node span
            if (this.traceClient.getCurrentSpanId()) { // Simple check if *any* span is active
                console.log(`[Judgeval Handler] Starting node span: ${nodeName}`);
                this.startSpan(nodeName, "node");
                this.executedNodes.push(nodeName);
                this.executedNodeTools.push(nodeName);
                this.traceClient.recordInput({
                    args: inputs,
                    kwargs: { tags, metadata, runType, name: nodeName, options }
                });
                this.previousNode = nodeName;
            } else {
                console.warn(`[Judgeval Handler] Tried to start node span '${nodeName}' but no parent span found.`);
            }
            return;
        }
        // Optional: Log if node metadata is missing when a step tag is present
        const isNodeStepTag = tags?.some(tag => tag.startsWith("graph:step:"));
        if (isNodeStepTag && !nodeName) {
            console.warn(`[Judgeval Handler] Chain start event with 'graph:step:' tag but missing 'langgraph_node' in metadata. Name: ${name}, RunType: ${runType}`);
        }
        // Avoid starting generic chain spans unless specifically needed and identifiable
    }

    async handleChainEnd(
        outputs: Record<string, unknown> | string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) {
            return;
        }

        const currentSpanId = this.traceClient.getCurrentSpanId();
        console.log(`[Judgeval Handler] Entering handleChainEnd for span: ${currentSpanId}`);

        const isEndSignal = outputs === "__end__";
        const isEndNodeTag = tags?.some(tag => tag.includes(":end:") || tag.includes(":finish:"));
        if (isEndSignal || isEndNodeTag) {
            console.log(`[Judgeval Handler] Graph finished signal detected for span: ${currentSpanId}.`);
            this.finished = true;
        }

        this.traceClient.recordOutput(outputs);
        this.endSpan();
    }

    async handleChainError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] Chain error: ${error}`);
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;

        this.traceClient.recordError(error);
        console.log(`[Judgeval Handler] Ending span due to ChainError: ${this.traceClient.getCurrentSpanId()}`);
        this.endSpan();
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

        this.getOrCreateTraceClient();
        if (!this.traceClient) return;

        console.log(`[Judgeval Handler] Starting tool span: ${toolName}`);
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
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;

        this.traceClient.recordOutput(output);
        console.log(`[Judgeval Handler] Ending tool span: ${this.traceClient.getCurrentSpanId()}`);
        this.endSpan();
    }

    async handleToolError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] Tool error: ${error}`);
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;

        this.traceClient.recordError(error);
        console.log(`[Judgeval Handler] Ending tool span due to error: ${this.traceClient.getCurrentSpanId()}`);
        this.endSpan();
    }

    async handleAgentAction(
        action: AgentAction,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
    }

    async handleAgentFinish(
        finish: AgentFinish,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
    }

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

        this.getOrCreateTraceClient();
        if (!this.traceClient) return;

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
        this.endSpan();
    }

    async handleLLMError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.error(`[Judgeval Handler] LLM error: ${error}`);
        if (!this.traceClient || !this.traceClient.getCurrentSpanId()) return;

        this.traceClient.recordError(error);
        console.log(`[Judgeval Handler] Ending LLM span due to error: ${this.traceClient.getCurrentSpanId()}`);
        this.endSpan();
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

        this.getOrCreateTraceClient();
        if (!this.traceClient) return;

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
    }
}