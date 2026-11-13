import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { ChatCompletionChunk } from "openai/resources/chat/completions/completions";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

type JsonObject = Record<string, unknown>;

/** Copies the entries of `source` that have a value onto `target`. */
function assignPresent(target: JsonObject, source: object): void {
  for (const [key, value] of Object.entries(source)) {
    if (value != null) target[key] = value;
  }
}

/**
 * The Anthropic Message a Messages API stream describes, assembled as the
 * Anthropic SDK's `finalMessage()` does. Blocks that arrive whole, such as
 * `redacted_thinking`, are kept as they are.
 */
export function anthropicMessage(
  events: readonly BetaRawMessageStreamEvent[],
): JsonObject | undefined {
  let message:
    | (JsonObject & { content: JsonObject[]; usage: JsonObject })
    | undefined;
  const toolInputs = new Map<number, string>();
  for (const event of events) {
    if (event.type === "message_start") {
      message = {
        ...event.message,
        content: event.message.content.map((block) => ({ ...block })),
        usage: { ...event.message.usage },
      };
      toolInputs.clear();
      continue;
    }
    if (!message) continue;
    switch (event.type) {
      case "content_block_start":
        message.content[event.index] = { ...event.content_block };
        break;
      case "content_block_delta": {
        const block = message.content[event.index];
        const { delta } = event;
        if (!block) break;
        if (delta.type === "text_delta") {
          block.text = String(block.text ?? "") + delta.text;
        } else if (delta.type === "thinking_delta") {
          block.thinking = String(block.thinking ?? "") + delta.thinking;
        } else if (delta.type === "signature_delta") {
          block.signature = delta.signature;
        } else if (delta.type === "citations_delta") {
          const citations = Array.isArray(block.citations)
            ? block.citations
            : [];
          block.citations = [...citations, delta.citation];
        } else if (delta.type === "input_json_delta") {
          toolInputs.set(
            event.index,
            (toolInputs.get(event.index) ?? "") + delta.partial_json,
          );
        } else if (delta.type === "compaction_delta") {
          const { type: _type, ...fields } = delta;
          Object.assign(block, fields);
        }
        break;
      }
      case "content_block_stop": {
        const json = toolInputs.get(event.index);
        const block = message.content[event.index];
        if (json === undefined || !block) break;
        try {
          block.input = json ? JSON.parse(json) : {};
        } catch {
          block.input = {};
        }
        break;
      }
      case "message_delta": {
        const { type: _type, delta, usage, ...rest } = event;
        Object.assign(message, delta);
        assignPresent(message, rest);
        assignPresent(message.usage, usage);
        break;
      }
    }
  }
  return message;
}

/**
 * The field each kind of streamed tool call sends in fragments: a function
 * call's arguments and a custom tool call's input. Other fields, such as the
 * name, arrive whole and are kept as the last chunk sent them.
 */
const STREAMED_TOOL_INPUTS: Partial<Record<string, string>> = {
  function: "arguments",
  custom: "input",
};

/**
 * The `chat.completion` a Chat Completions stream describes, assembled as the
 * OpenAI SDK's `ChatCompletionStream` does. Delta fields beyond OpenAI's own,
 * such as `reasoning_content`, are accumulated as they arrive.
 */
export function chatCompletion(
  chunks: readonly ChatCompletionChunk[],
): JsonObject | undefined {
  if (chunks.length === 0) return undefined;
  const completion: JsonObject = {};
  const choices: JsonObject[] = [];
  for (const { choices: chunkChoices, ...rest } of chunks) {
    Object.assign(completion, rest);
    for (const { index, delta, ...fields } of chunkChoices) {
      const choice = (choices[index] ??= {
        index,
        message: {},
        finish_reason: null,
        logprobs: null,
      });
      assignPresent(choice, fields);
      const message = choice.message as JsonObject;
      const { tool_calls: toolCalls, ...deltaFields } = delta as JsonObject &
        Pick<ChatCompletionChunk.Choice.Delta, "tool_calls">;
      for (const [key, value] of Object.entries(deltaFields)) {
        if (value == null) continue;
        const current = message[key];
        if (key !== "role" && typeof value === "string") {
          message[key] = (typeof current === "string" ? current : "") + value;
        } else if (Array.isArray(value)) {
          message[key] = [...(Array.isArray(current) ? current : []), ...value];
        } else {
          message[key] = value;
        }
      }
      for (const { index: callIndex, ...call } of toolCalls ?? []) {
        const calls = (message.tool_calls ??= []) as JsonObject[];
        const toolCall = (calls[callIndex] ??= {});
        for (const [kind, value] of Object.entries(call)) {
          const streamed = STREAMED_TOOL_INPUTS[kind];
          if (!streamed || typeof value !== "object" || value === null) {
            if (value != null) toolCall[kind] = value;
            continue;
          }
          const { [streamed]: fragment, ...fields } = value as JsonObject;
          const target = (toolCall[kind] ??= {}) as JsonObject;
          assignPresent(target, fields);
          target[streamed] =
            String(target[streamed] ?? "") +
            (typeof fragment === "string" ? fragment : "");
        }
      }
    }
  }
  return {
    ...completion,
    object: "chat.completion",
    choices: choices.map((choice) => ({
      ...choice,
      message: {
        content: null,
        refusal: null,
        ...(choice.message as JsonObject),
      },
    })),
  };
}

/** The Response object a Responses API stream ends with. */
export function openAIResponse(
  events: readonly ResponseStreamEvent[],
): unknown {
  for (const event of [...events].reverse()) {
    if (
      event.type === "response.completed" ||
      event.type === "response.incomplete" ||
      event.type === "response.failed"
    ) {
      return event.response;
    }
  }
  return undefined;
}
