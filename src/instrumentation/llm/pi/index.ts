import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Model,
  SimpleStreamOptions,
  TranscriptContext,
} from "@earendil-works/pi-ai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions/completions";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { AttributeKeys } from "../../../JudgmentAttributeKeys";
import { BaseTracer } from "../../../trace/BaseTracer";
import { getActiveBaggage } from "../../../trace/baggage";
import { dontThrow } from "../../../utils/dont-throw";
import { anthropicMessage, chatCompletion, openAIResponse } from "./responses";

/** A pi stream function, such as `streamSimple` or an Agent's `streamFn`. */
export type PiStreamFn = (
  model: Model<Api>,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;

/** Builds the provider's response object from its raw stream events, by pi API. */
const RESPONSE_BUILDERS: Partial<Record<Api, (events: unknown[]) => unknown>> =
  {
    "anthropic-messages": (events) =>
      anthropicMessage(events as BetaRawMessageStreamEvent[]),
    "openai-completions": (events) =>
      chatCompletion(events as ChatCompletionChunk[]),
    "openai-responses": (events) =>
      openAIResponse(events as ResponseStreamEvent[]),
    "azure-openai-responses": (events) =>
      openAIResponse(events as ResponseStreamEvent[]),
  };

/** Records one pi model call as an LLM span. */
function startCall(
  model: Model<Api>,
  options: SimpleStreamOptions | undefined,
): {
  options: SimpleStreamOptions;
  end: (message: AssistantMessage | undefined, error?: unknown) => void;
} {
  const span = BaseTracer.startSpan("PI_API_CALL");
  BaseTracer.setSpanKind("llm", span);
  BaseTracer.recordLLMMetadata(
    { model: model.id, provider: model.provider },
    span,
  );
  // A session ID the app set on the trace wins over pi's.
  if (
    options?.sessionId &&
    !getActiveBaggage()?.getEntry(AttributeKeys.JUDGMENT_SESSION_ID)
  ) {
    BaseTracer.setAttribute(
      AttributeKeys.JUDGMENT_SESSION_ID,
      options.sessionId,
      span,
    );
  }

  const buildResponse = RESPONSE_BUILDERS[model.api];
  const events: unknown[] = [];
  return {
    options: {
      ...options,
      onPayload: async (payload, payloadModel) => {
        const replaced = await options?.onPayload?.(payload, payloadModel);
        BaseTracer.setInput(replaced ?? payload, span);
        return replaced;
      },
      onProviderStreamEvent: async (event, eventModel) => {
        if (buildResponse) events.push(event);
        await options?.onProviderStreamEvent?.(event, eventModel);
      },
    },
    end: (message, error) => {
      dontThrow("wrapPi.end", () => {
        const response = buildResponse?.(events);
        if (response !== undefined) BaseTracer.setOutput(response, span);
        if (message) {
          const { usage } = message;
          BaseTracer.recordLLMMetadata(
            {
              model: message.responseModel ?? message.model,
              non_cached_input_tokens: usage.input,
              output_tokens: usage.output,
              cache_read_input_tokens: usage.cacheRead,
              cache_creation_input_tokens: usage.cacheWrite,
            },
            span,
          );
          if (
            message.stopReason === "error" ||
            message.stopReason === "aborted"
          ) {
            error ??= new Error(message.errorMessage ?? message.stopReason);
          }
        }
        if (error !== undefined) BaseTracer.setError(error, span);
      });
      span.end();
    },
  };
}

/**
 * Instrument a pi (`@earendil-works/pi-ai` 1.x) stream function to emit one
 * Judgment LLM span per model call.
 *
 * Each span records the provider request body exactly as pi sends it
 * (`onPayload`) and the provider's response object assembled from its raw
 * stream events (`onProviderStreamEvent`): an Anthropic Message for
 * `anthropic-messages`, a `chat.completion` for `openai-completions`, and the
 * Response object for `openai-responses` and `azure-openai-responses`. Calls
 * to other pi APIs record their request, model and usage only. The call's
 * `sessionId` becomes the Judgment session ID, unless the active trace already
 * has one set with `Tracer.setSessionId`.
 *
 * Hooks passed in the call's options still run; the request body is never
 * changed.
 *
 * @param streamFn - The stream function to wrap, usually `streamSimple` from
 *   `@earendil-works/pi-ai/compat`.
 * @returns A stream function to call, or to pass as an Agent's `streamFn`.
 *
 * @example
 * ```typescript
 * import { Agent } from "@earendil-works/pi-agent-core";
 * import { streamSimple } from "@earendil-works/pi-ai/compat";
 * import { wrapPi } from "judgeval";
 *
 * const agent = new Agent({ streamFn: wrapPi(streamSimple), sessionId });
 * ```
 */
export function wrapPi<F extends PiStreamFn>(streamFn: F): F {
  return function (
    model: Model<Api>,
    context: TranscriptContext,
    options?: SimpleStreamOptions,
  ) {
    const call = dontThrow("wrapPi.start", () => startCall(model, options));
    if (!call) return streamFn(model, context, options);
    let stream: ReturnType<PiStreamFn>;
    try {
      stream = streamFn(model, context, call.options);
    } catch (err) {
      call.end(undefined, err);
      throw err;
    }
    void Promise.resolve(stream)
      .then((resolved) => resolved.result())
      .then(
        (message) => call.end(message),
        (err: unknown) => call.end(undefined, err),
      );
    return stream;
  } as F;
}
