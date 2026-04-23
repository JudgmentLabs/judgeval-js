import { describe, expect, test } from "bun:test";
import type { Anthropic } from "@anthropic-ai/sdk";
import { fakeStream, useTracerMocks } from "../test-helpers";
import { wrapAnthropic } from "./index";

// Minimal fake that satisfies the shape wrapAnthropic patches.
function fakeClient(overrides?: {
  messagesCreate?: (...args: unknown[]) => Promise<unknown>;
}): Anthropic {
  return {
    messages: {
      create: overrides?.messagesCreate ?? (async () => ({})),
    },
  } as unknown as Anthropic;
}

// Helper to call create without fighting overload resolution.
async function messagesCreate(
  client: Anthropic,
  body: Record<string, unknown>,
): Promise<unknown> {
  return (client.messages.create as Function)(body);
}

describe("wrapAnthropic", () => {
  const m = useTracerMocks();

  test("returns the same client instance", () => {
    const client = fakeClient();
    expect(wrapAnthropic(client)).toBe(client);
  });

  // -----------------------------------------------------------------------
  // messages.create — non-streaming
  // -----------------------------------------------------------------------
  describe("messages.create (non-streaming)", () => {
    test("span lifecycle: start, input, output, usage, end", async () => {
      const response = {
        id: "msg_01abc",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        content: [{ type: "text", text: "Hello!" }],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 12,
          output_tokens: 8,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
        },
      };
      const client = fakeClient({ messagesCreate: async () => response });
      wrapAnthropic(client);

      const result = await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toBe(response);
      expect(m.startSpan).toHaveBeenCalledWith("ANTHROPIC_API_CALL");
      expect(m.setSpanKind).toHaveBeenCalledWith("llm", expect.anything());
      expect(m.recordLLMMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          provider: "anthropic",
        }),
        expect.anything(),
      );
      expect(m.setInput).toHaveBeenCalled();
      expect(m.setOutput).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });

    test("records cache tokens when present", async () => {
      const response = {
        id: "msg_02abc",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        content: [{ type: "text", text: "Cached" }],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 50,
          output_tokens: 20,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 200,
        },
      };
      const client = fakeClient({ messagesCreate: async () => response });
      wrapAnthropic(client);

      await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hi" }],
      });

      const usageCall = m.recordLLMMetadata.mock.calls.find(
        (c) =>
          (c[0] as Record<string, unknown>).cache_read_input_tokens !==
          undefined,
      );
      expect(usageCall).toBeDefined();
      const meta = usageCall![0] as Record<string, unknown>;
      expect(meta.cache_read_input_tokens).toBe(200);
      expect(meta.cache_creation_input_tokens).toBe(100);
    });

    test("returns original result unmodified", async () => {
      const response = {
        id: "msg_01abc",
        content: [{ type: "text", text: "Hello!" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
        },
      };
      const client = fakeClient({ messagesCreate: async () => response });
      wrapAnthropic(client);

      const result = (await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hi" }],
      })) as typeof response;

      expect(result).toBe(response);
      expect(result.content[0].text).toBe("Hello!");
    });

    test("error: records error and ends span", async () => {
      const error = new Error("API error");
      const client = fakeClient({
        messagesCreate: async () => { throw error; },
      });
      wrapAnthropic(client);

      try {
        await messagesCreate(client, {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [],
        });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBe(error);
      }

      expect(m.setError).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // messages.create — streaming
  // -----------------------------------------------------------------------
  describe("messages.create (streaming)", () => {
    test("accumulates text deltas, records usage from message_delta, ends span", async () => {
      const chunks = [
        {
          type: "message_start",
          message: {
            id: "msg_01",
            model: "claude-sonnet-4-20250514",
            usage: {
              input_tokens: 10,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        },
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hel" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "lo!" },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: {
            output_tokens: 5,
            input_tokens: 10,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
          },
        },
        { type: "message_stop" },
      ];
      const client = fakeClient({
        messagesCreate: async () => fakeStream(chunks),
      });
      wrapAnthropic(client);

      const result = await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      const collected: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        collected.push(chunk);
      }

      expect(collected).toHaveLength(7);
      expect(m.startSpan).toHaveBeenCalledWith("ANTHROPIC_API_CALL");
      expect(m.setOutput.mock.calls[0][0]).toBe("Hello!");
      expect(m.spans[0].ended).toBe(true);
    });

    test("ignores thinking deltas for output accumulation", async () => {
      const chunks = [
        {
          type: "message_start",
          message: {
            id: "msg_01",
            model: "claude-sonnet-4-20250514",
            usage: {
              input_tokens: 10,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me think..." },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "Answer" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: {
            output_tokens: 10,
            input_tokens: 10,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
          },
        },
        { type: "message_stop" },
      ];
      const client = fakeClient({
        messagesCreate: async () => fakeStream(chunks),
      });
      wrapAnthropic(client);

      const result = await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Think" }],
        stream: true,
      });

      for await (const _chunk of result as AsyncIterable<unknown>) {
        // consume
      }

      expect(m.setOutput.mock.calls[0][0]).toBe("Answer");
    });

    test("streaming error: records error and ends span", async () => {
      const error = new Error("Stream error");
      const errorStream: AsyncIterable<unknown> & {
        controller: AbortController;
      } = {
        controller: new AbortController(),
        async *[Symbol.asyncIterator]() {
          yield {
            type: "message_start",
            message: {
              id: "msg_01",
              model: "claude-sonnet-4-20250514",
              usage: {
                input_tokens: 10,
                output_tokens: 0,
                cache_creation_input_tokens: null,
                cache_read_input_tokens: null,
              },
            },
          };
          throw error;
        },
      };

      const client = fakeClient({ messagesCreate: async () => errorStream });
      wrapAnthropic(client);

      const result = await messagesCreate(client, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      try {
        for await (const _chunk of result as AsyncIterable<unknown>) {
          // consume
        }
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBe(error);
      }

      expect(m.setError).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });
  });
});
