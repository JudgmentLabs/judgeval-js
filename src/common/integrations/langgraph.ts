// judgeval-js/src/integrations/langgraph.ts

import { BaseCallbackHandler, } from "@langchain/core/callbacks/base";
import { CallbackManager } from '@langchain/core/callbacks/manager';
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { LLMResult } from "@langchain/core/outputs";
import { BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import { Tracer, TraceClient } from "../tracer";

export class JudgevalLanggraphCallbackHandler extends BaseCallbackHandler {
    name = "judgeval_langgraph_callback_handler";

    private tracer: Tracer;
    private previousNode: string | undefined;
    readonly executedNodeTools: string[] = [];
    readonly executedNodes: string[] = [];
    readonly executedTools: string[] = [];

    constructor(tracer?: Tracer) {
        super();
        this.tracer = tracer ?? Tracer.getInstance();
        console.log(`[Judgeval Handler] Initialized. Monitoring Enabled: ${this.tracer.enableMonitoring}`); // Added prefix
    }

    private getTraceClient(): TraceClient | undefined {
        if (!this.tracer.enableMonitoring) return undefined;

        const client = this.tracer.getCurrentTrace();
        if (!client) {
            console.warn("No trace client found");
        }
        return client;
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
        if (serialized?.name) {
            name_ = `RETRIEVER_${serialized.name.toUpperCase()}`;
        }

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.startSpan(name_, { spanType: "retriever" });
        traceClient.recordInput({
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
        const docSummary = documents.map((doc, i) => ({
            index: i,
            page_content: doc.pageContent.length > 100
                ? doc.pageContent.substring(0, 97) + "..."
                : doc.pageContent,
            metadata: doc.metadata,
        }));

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordOutput({
            document_count: documents.length,
            documents: docSummary,
        });
        traceClient.endSpan();
    }

    async handleRetrieverError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordError(error);
    }

    async handleChainStart(
        serialized: Serialized,
        inputs: Record<string, unknown>,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        runName?: string | undefined,
        runType?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        let traceClient = this.getTraceClient();
        if (!traceClient) {
            console.warn("No trace client found");
            return;
        }

        traceClient.startSpan(name ?? "unknown_chain", { spanType: "chain" });
        traceClient.recordInput(inputs);
    }

    async handleChainEnd(
        outputs: Record<string, unknown> | string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordOutput(outputs);
        traceClient.endSpan();
    }

    async handleChainError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.log(`Chain error: ${error}`);

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordError(error);
        traceClient.endSpan();
    }

    async handleToolStart(
        serialized: Serialized,
        inputStr: string,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        runType?: string | undefined,
        runName?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        // Python SDK doesn't handle name None case
        traceClient.startSpan(name ?? "unknown_tool", { spanType: "tool" });
        if (name) {
            this.executedTools.push(name);
            this.executedNodeTools.push(this.previousNode ? `${this.previousNode}:${name}` : name);
        }
        traceClient.recordInput({
            args: inputStr,
            kwargs: options,
        });
    }

    async handleToolEnd(
        output: string,
        runId: string,
        parentRunId?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordOutput(output);
        traceClient.endSpan();
    }

    async handleToolError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.log(`Tool error: ${error}`);

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordError(error);
        traceClient.endSpan();
    }

    async handleAgentAction(
        action: AgentAction,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.log(`Agent action: ${action}`);
    }

    async handleAgentFinish(
        finish: AgentFinish,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        console.log(`Agent finish: ${finish}`);
    }

    async handleLLMStart(
        serialized: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        runName?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const name = "LLM call";
        
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.startSpan(name, { spanType: "llm" });
        traceClient.recordInput({
            args: prompts,
            kwargs: {
                extra_params: extraParams,
                tags: tags,
                metadata: metadata,
                ...options,
            },
        });
    }

    // Also called on chat model end
    async handleLLMEnd(
        output: LLMResult,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordOutput(output.generations[0][0].text);
        traceClient.endSpan();
    }

    async handleLLMError(
        error: Error | any,
        runId: string,
        parentRunId?: string | undefined,
        tags?: string[] | undefined,
        options?: Record<string, any>
    ): Promise<void> {  
        console.log(`LLM error: ${error}`);

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.recordError(error);
        traceClient.endSpan();
    }

    // Why is there no handleChatModelEnd?
    async handleChatModelStart(
        serialized: Serialized,
        messages: BaseMessage[][],
        runId: string,
        parentRunId?: string | undefined,
        extraParams?: Record<string, unknown> | undefined,
        tags?: string[] | undefined,
        metadata?: Record<string, unknown> | undefined,
        name?: string | undefined,
        runType?: string | undefined,
        runName?: string | undefined,
        options?: Record<string, any>
    ): Promise<void> {
        let name_ = "LLM call";
        if (serialized.id.includes("openai")) {
            name_ = "OPENAI_API_CALL";
        } else if (serialized.id.includes("anthropic")) {
            name_ = "ANTHROPIC_API_CALL";
        } else if (serialized.id.includes("together")) {
            name_ = "TOGETHER_API_CALL";
        } else {
            name_ = "LLM call";
        }

        const traceClient = this.getTraceClient();
        if (!traceClient) return;

        traceClient.startSpan(name_, { spanType: "llm" });
        traceClient.recordInput({
            args: messages,
            kwargs: {
                extra_params: extraParams,
                tags: tags,
                metadata: metadata,
                ...options,
            },
        });
    }
}