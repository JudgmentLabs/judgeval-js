import { ExportResult, ExportResultCode, hrTime } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { v4 as uuidv4 } from 'uuid';

// Import using relative path from within the src directory - ADD .js EXTENSION
import { TraceManagerClient, type TraceSavePayload, type CondensedSpanEntry } from '../common/tracer.js';

// --- Helper Functions --- Reintroduce types
function parseOtelAttributes(attributesMap: Record<string, any>): Record<string, any> {
    const attributes: Record<string, any> = {};
    for (const key in attributesMap) {
        attributes[key] = attributesMap[key];
    }
    return attributes;
}

function mapToInternalInput(attributes: Record<string, any>): any {
    const kwargs: Record<string, any> = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith('ai.telemetry.metadata.')) {
            kwargs[key.replace('ai.telemetry.metadata.', 'metadata_')] = value;
        }
    }
    let messages = attributes['ai.prompt.messages'];
    if (typeof messages === 'string') {
        try {
            messages = JSON.parse(messages);
        } catch (e) {
            console.warn(`[OtelExporter] Could not parse messages JSON: ${messages}`);
            messages = [];
        }
    } else if (!Array.isArray(messages)) {
        console.warn(`[OtelExporter] Messages attribute is not an array or valid JSON string: ${messages}`);
        messages = [];
    }

    return {
        model: attributes['gen_ai.request.model'],
        messages: messages || [],
        kwargs: kwargs,
    };
}

function mapToInternalOutput(attributes: Record<string, any>): any {
    const inputTokens = attributes['gen_ai.usage.input_tokens'] || attributes['ai.usage.promptTokens'];
    const outputTokens = attributes['gen_ai.usage.output_tokens'] || attributes['ai.usage.completionTokens'];
    let totalTokens = null;
    if (inputTokens != null && outputTokens != null) {
        totalTokens = inputTokens + outputTokens;
    }

    return {
        content: attributes['ai.response.text'],
        usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens,
            prompt_tokens_cost_usd: 0.0, // Initialize to 0.0
            completion_tokens_cost_usd: 0.0, // Initialize to 0.0
            total_cost_usd: 0.0 // Initialize to 0.0
        },
    };
}

// Define an intermediate structure used during processing
interface ProcessedSpan extends CondensedSpanEntry { 
    // We don't strictly need ProcessedSpan anymore if we use OTel IDs directly,
    // but keep it for minimal changes for now. Children removed.
    otel_span_id: string; // Keep for reference during processing if needed
    otel_parent_span_id?: string; // Keep for reference
    trace_id: string;
    // Ensure children is NOT part of this intermediate type if buildTraceTree won't use it
    // children?: ProcessedSpan[]; 
}

// Revert buildTraceTree to return a FLAT list, relying on parent_span_id for hierarchy
// parent_span_id here refers to the GENERATED UUID of the parent.
function buildTraceTree(spansList: ProcessedSpan[]): CondensedSpanEntry[] {
    if (!spansList || spansList.length === 0) {
        return [];
    }

    // Assign depth using parent references (UUIDs)
    const spansById: { [key: string]: ProcessedSpan } = {};
    // Use the generated span_id (UUID) for the map key
    spansList.forEach(span => { spansById[span.span_id] = span; }); 

    const depths: { [key: string]: number } = {};
    const visited = new Set<string>();

    function calculateDepth(spanId: string): number { // spanId is the generated UUID
        if (depths[spanId] !== undefined) return depths[spanId];
        if (visited.has(spanId)) {
            console.warn(`[OtelExporter BuildTree] Cycle or re-visit detected for span ${spanId}`);
            return 0; 
        }
        visited.add(spanId);

        const span = spansById[spanId];
        if (!span) {
            console.warn(`[OtelExporter BuildTree] Span ${spanId} not found in spansById map.`);
            visited.delete(spanId); // Clean up visited set
            return 0; 
        }
        
        // Check parent_span_id (which should be the parent's generated UUID)
        if (!span.parent_span_id || !spansById[span.parent_span_id]) {
            depths[spanId] = 0; // Root span
        } else {
            try {
                depths[spanId] = calculateDepth(span.parent_span_id) + 1;
            } catch (e: any) {
                console.error(`[OtelExporter BuildTree] Error calculating depth for span ${spanId}, parent ${span.parent_span_id}: ${e.message}`);
                depths[spanId] = -1; // Indicate an error
            }
        }
        
        // visited.delete(spanId); // Optional: remove if cycles/revisits need different handling

        return depths[spanId];
    }

    spansList.forEach(span => {
        // Use the generated span_id (UUID) here
        if (depths[span.span_id] === undefined) { 
            visited.clear(); 
            try {
                 span.depth = calculateDepth(span.span_id);
            } catch (e: any) {
                console.error(`[OtelExporter BuildTree] Failed initial depth calculation for ${span.span_id}: ${e.message}`);
                 span.depth = -1; // Assign error depth
            }
        } else {
             span.depth = depths[span.span_id];
        }
    });

    // Create the final flat list, ensuring no 'children' field
    const sortedSpans: CondensedSpanEntry[] = spansList.map(span => {
        const finalSpan: CondensedSpanEntry = {
            span_id: span.span_id, // Generated UUID
            function: span.function,
            depth: span.depth < 0 ? 0 : span.depth, // Reset error depth to 0
            created_at: span.created_at,
            parent_span_id: span.parent_span_id, // Parent's generated UUID or null/undefined
            span_type: span.span_type,
            inputs: span.inputs,
            output: span.output,
            duration: span.duration,
            trace_id: span.trace_id,
        };
        // Explicitly remove children property if it somehow exists on the object
        delete (finalSpan as any).children; 
        return finalSpan;
    });

    // Sort the flat list by creation time as a fallback ordering
    sortedSpans.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return sortedSpans;
}

// --- End Helper Functions ---

interface OtelExporterConfig {
    apiKey: string;
    organizationId: string;
    serviceName?: string;
}

export class JudgevalExporter implements SpanExporter {
    private serviceName: string;
    private apiKey: string;
    private organizationId: string;

    constructor(config: OtelExporterConfig) {
        this.serviceName = config.serviceName || 'otel-judgeval-export';
        if (!config.apiKey) {
            throw new Error("JudgevalExporter requires apiKey in config");
        }
        if (!config.organizationId) {
            throw new Error("JudgevalExporter requires organizationId in config");
        }
        this.apiKey = config.apiKey;
        this.organizationId = config.organizationId;
        console.log('[OtelExporter] Initialized with API Key and Org ID.');
    }

    async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
        console.log('[OtelExporter] Export method called.');
        console.log(`[OtelExporter] Number of spans received: ${spans.length}`);
        if (spans.length === 0) {
            return resultCallback({ code: ExportResultCode.SUCCESS });
        }

        const traces = new Map<string, ReadableSpan[]>();

        for (const span of spans) {
            const traceId = span.spanContext().traceId;
            if (!traces.has(traceId)) {
                traces.set(traceId, []);
            }
            traces.get(traceId)!.push(span);
        }

        console.log(`[OtelExporter] Processing ${traces.size} unique trace(s).`);

        const exportPromises: Promise<ExportResult>[] = [];
        const traceManager = new TraceManagerClient(this.apiKey, this.organizationId);

        for (const [otelTraceId, traceSpans] of traces.entries()) {
            const backendTraceId = uuidv4(); 
            console.log(`[OtelExporter] Mapping OTEL trace ${otelTraceId} to backend UUID ${backendTraceId}`);

            const processAndSave = async (): Promise<ExportResult> => {
                try {
                    console.log(`[OtelExporter] Processing trace data for backend UUID ${backendTraceId} (${traceSpans.length} span(s)).`);
                    const otelIdToDbUuidMap: { [key: string]: string } = {}; 
                    const processedSpans: ProcessedSpan[] = [];
                    let traceMetadata = {
                        projectName: 'default-otel-project',
                        traceName: 'Unnamed OTel Trace',
                    };

                    for (const span of traceSpans) {
                        const ctx = span.spanContext();
                        const attributes = parseOtelAttributes(span.attributes);
                        const dbSpanUuid = uuidv4(); 
                        otelIdToDbUuidMap[ctx.spanId] = dbSpanUuid;

                        if (attributes['ai.telemetry.metadata.project_name']) {
                            traceMetadata.projectName = attributes['ai.telemetry.metadata.project_name'];
                        }
                        if (attributes['ai.telemetry.metadata.trace_name']) {
                            traceMetadata.traceName = attributes['ai.telemetry.metadata.trace_name'];
                        }

                        const startTime = span.startTime[0] + span.startTime[1] / 1e9;
                        const endTime = span.endTime[0] + span.endTime[1] / 1e9;
                        const duration = endTime - startTime;

                        // --- Determine Span Type --- START
                        let determinedSpanType: string = 'span'; // Default to 'span' (Use string type)
                        if (span.name === 'ai.generateText') {
                            // If it's the main generateText call, maybe treat it as a chain or agent span?
                            determinedSpanType = 'chain'; // Or 'agent' or 'span' depending on backend expectation
                        } else if (span.name === 'ai.generateText.doGenerate') {
                            // The actual LLM call part
                            determinedSpanType = 'llm'; 
                        } else if (span.name.includes('tool') || span.attributes['ai.tool.name']) {
                             determinedSpanType = 'tool'; // Example for tool spans
                        }
                        // Add more heuristics based on span.name or span.attributes if needed
                        // --- Determine Span Type --- END

                        processedSpans.push({
                            trace_id: backendTraceId, 
                            span_id: dbSpanUuid, 
                            otel_span_id: ctx.spanId, 
                            otel_parent_span_id: span.parentSpanId,
                            parent_span_id: undefined, 
                            function: span.name, // Keep using OTel span name for now
                            depth: 0, 
                            created_at: new Date(startTime * 1000).toISOString(),
                            duration: duration < 0 ? 0 : duration,
                            inputs: mapToInternalInput(attributes),
                            output: mapToInternalOutput(attributes),
                            span_type: determinedSpanType, 
                        });
                    }

                    processedSpans.forEach(span => {
                        if (span.otel_parent_span_id && otelIdToDbUuidMap[span.otel_parent_span_id]) {
                            span.parent_span_id = otelIdToDbUuidMap[span.otel_parent_span_id]; 
                        }
                    });

                    const traceEntries = buildTraceTree(processedSpans); 

                    const traceStartTimeIso = traceEntries.length > 0 ? traceEntries.reduce((min, p) => (p.created_at < min ? p.created_at : min), traceEntries[0].created_at) : new Date().toISOString();
                    const traceEndTime = traceEntries.length > 0 ? traceEntries.reduce((max, p) => {
                        const endTs = new Date(p.created_at).getTime() + ((p.duration || 0) * 1000);
                        return endTs > max ? endTs : max;
                    }, 0) : Date.now();
                    const overallDuration = (traceEndTime - new Date(traceStartTimeIso).getTime()) / 1000;

                    const tokenCounts = {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                        prompt_tokens_cost_usd: 0.0,
                        completion_tokens_cost_usd: 0.0,
                        total_cost_usd: 0.0
                    };
                    let firstModel: string | null = null;
                    for (const entry of traceEntries) {
                        if (entry.span_type === 'llm' && entry.output?.usage) {
                            tokenCounts.prompt_tokens += entry.output.usage.prompt_tokens || 0;
                            tokenCounts.completion_tokens += entry.output.usage.completion_tokens || 0;
                            tokenCounts.total_tokens += entry.output.usage.total_tokens || 
                                      ((entry.output.usage.prompt_tokens || 0) + 
                                      (entry.output.usage.completion_tokens || 0));
                            if (!firstModel && entry.inputs?.model) {
                                firstModel = entry.inputs.model;
                            }
                        }
                    }

                    if (firstModel && (tokenCounts.prompt_tokens > 0 || tokenCounts.completion_tokens > 0)) {
                        try {
                            console.log(`[OtelExporter] Calculating token costs for model ${firstModel}...`);
                            const costResponse = await traceManager.calculateTokenCosts(
                                firstModel,
                                tokenCounts.prompt_tokens,
                                tokenCounts.completion_tokens
                            );
                            if (costResponse) {
                                tokenCounts.prompt_tokens_cost_usd = costResponse.prompt_tokens_cost_usd;
                                tokenCounts.completion_tokens_cost_usd = costResponse.completion_tokens_cost_usd;
                                tokenCounts.total_cost_usd = costResponse.total_cost_usd;
                                console.log(`[OtelExporter] Calculated costs for model ${firstModel}: $${tokenCounts.total_cost_usd.toFixed(6)}`);
                            } else {
                                console.log(`[OtelExporter] Could not fetch token costs for model ${firstModel}. Costs will be 0.`);
                            }
                        } catch (error) {
                            console.error(`[OtelExporter] Error fetching token costs: ${error}`);
                        }
                    }

                    // <<< NEW: Update individual span costs >>>
                    // Assign the calculated *total* costs back to individual LLM spans
                    // Note: This might not be perfectly accurate if multiple models were used,
                    // but it ensures costs are numeric and mirrors native client approach.
                    for (const entry of traceEntries) {
                        if (entry.span_type === 'llm' && entry.output?.usage) {
                            entry.output.usage.prompt_tokens_cost_usd = tokenCounts.prompt_tokens_cost_usd;
                            entry.output.usage.completion_tokens_cost_usd = tokenCounts.completion_tokens_cost_usd;
                            entry.output.usage.total_cost_usd = tokenCounts.total_cost_usd;
                        }
                    }
                    // <<< END NEW >>>

                    const traceSavePayload: TraceSavePayload = {
                        trace_id: backendTraceId, 
                        name: traceMetadata.traceName || traceEntries[0]?.function || 'Unnamed OTel Trace',
                        project_name: traceMetadata.projectName,
                        created_at: traceStartTimeIso,
                        duration: overallDuration < 0 ? 0 : overallDuration,
                        token_counts: tokenCounts,
                        entries: traceEntries,
                        evaluation_runs: [],
                        overwrite: true,
                        parent_trace_id: null,
                        parent_name: null,
                    };

                    console.log(`[OtelExporter] Preparing to save trace with backend UUID ${backendTraceId} using TraceManagerClient.`);
                    console.log("[OtelExporter] Payload to be sent:", JSON.stringify(traceSavePayload, null, 2));

                    const response = await traceManager.saveTrace(traceSavePayload);

                    console.log(`[OtelExporter] TraceManagerClient.saveTrace call completed for backend UUID ${backendTraceId}. Response received:`, response);
                    console.log(`[OtelExporter] Successfully exported trace group originally from OTEL trace ${otelTraceId} as backend UUID ${backendTraceId}.`);
                    return { code: ExportResultCode.SUCCESS };

                } catch (error: any) {
                    console.error(`[OtelExporter] Error exporting trace group originally from OTEL trace ${otelTraceId} (backend UUID ${backendTraceId}):`, error);
                    return { code: ExportResultCode.FAILED, error };
                }
            };
            exportPromises.push(processAndSave());
        }

        try {
            const results = await Promise.all(exportPromises);
            const overallResult = results.some(r => r.code === ExportResultCode.FAILED)
                ? { code: ExportResultCode.FAILED, error: results.find(r => r.error)?.error }
                : { code: ExportResultCode.SUCCESS };
            console.log(`[OtelExporter] Batch export finished. Overall result: ${overallResult.code === ExportResultCode.SUCCESS ? 'SUCCESS' : 'FAILED'}`);
            resultCallback(overallResult);
        } catch (error: any) {
            console.error('[OtelExporter] Unexpected error during batch processing:', error);
            resultCallback({ code: ExportResultCode.FAILED, error });
        }
    }

    async shutdown(): Promise<void> {
        console.log('[OtelExporter] Shutting down.');
        return Promise.resolve();
    }
} 