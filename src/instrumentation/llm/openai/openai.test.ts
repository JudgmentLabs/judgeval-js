import { describe, expect, test } from "bun:test";
import type { OpenAI } from "openai";
import { fakeStream, useTracerMocks } from "../test-helpers";
import { wrapOpenAI } from "./index";

// Minimal fake that satisfies the shape wrapOpenAI patches.
function fakeClient(overrides?: {
  chatCreate?: (...args: unknown[]) => Promise<unknown>;
  chatParse?: (...args: unknown[]) => Promise<unknown>;
  responsesCreate?: (...args: unknown[]) => Promise<unknown>;
  imagesGenerate?: (...args: unknown[]) => Promise<unknown>;
}): OpenAI {
  return {
    chat: {
      completions: {
        create: overrides?.chatCreate ?? (async () => ({})),
        parse: overrides?.chatParse ?? (async () => ({})),
      },
    },
    responses: {
      create: overrides?.responsesCreate ?? (async () => ({})),
    },
    images: {
      generate: overrides?.imagesGenerate ?? (async () => ({})),
    },
  } as unknown as OpenAI;
}

// Helper to call create without fighting overload resolution on fake clients.
async function chatCreate(
  client: OpenAI,
  body: Record<string, unknown>,
): Promise<unknown> {
  return (client.chat.completions.create as Function)(body);
}

async function responsesCreate(
  client: OpenAI,
  body: Record<string, unknown>,
): Promise<unknown> {
  return (client.responses.create as Function)(body);
}

async function imagesGenerate(
  client: OpenAI,
  body: Record<string, unknown>,
): Promise<unknown> {
  return (client.images.generate as Function)(body);
}

describe("wrapOpenAI", () => {
  const m = useTracerMocks();

  test("returns the same client instance", () => {
    const client = fakeClient();
    expect(wrapOpenAI(client)).toBe(client);
  });

  // -----------------------------------------------------------------------
  // chat.completions.create
  // -----------------------------------------------------------------------
  describe("chat.completions.create", () => {
    test("non-streaming: span lifecycle + input/output/usage", async () => {
      const response = {
        id: "chatcmpl-1",
        model: "gpt-4o",
        choices: [{ message: { content: "Hello!" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      const client = fakeClient({ chatCreate: async () => response });
      wrapOpenAI(client);

      const result = await chatCreate(client, {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toBe(response);
      expect(m.startSpan).toHaveBeenCalledWith("OPENAI_API_CALL");
      expect(m.setSpanKind).toHaveBeenCalledWith("llm", expect.anything());
      expect(m.setInput).toHaveBeenCalled();
      expect(m.setOutput).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });

    test("streaming: accumulates content, ends span after iteration", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" } }] },
        {
          choices: [{ delta: {} }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];
      const client = fakeClient({ chatCreate: async () => fakeStream(chunks) });
      wrapOpenAI(client);

      const result = await chatCreate(client, {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      const collected: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        collected.push(chunk);
      }

      expect(collected).toHaveLength(3);
      expect(m.setOutput).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });

    test("error: records error and ends span", async () => {
      const error = new Error("API error");
      const client = fakeClient({
        chatCreate: async () => { throw error; },
      });
      wrapOpenAI(client);

      try {
        await chatCreate(client, { model: "gpt-4o", messages: [] });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBe(error);
      }

      expect(m.setError).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // chat.completions.parse
  // -----------------------------------------------------------------------
  describe("chat.completions.parse", () => {
    test("non-streaming: span lifecycle", async () => {
      const response = {
        id: "chatcmpl-1",
        model: "gpt-4o",
        choices: [{ message: { content: "parsed" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      const client = fakeClient({ chatParse: async () => response });
      wrapOpenAI(client);

      const parse = (client.chat.completions as unknown as {
        parse: Function;
      }).parse;
      const result = await parse({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toBe(response);
      expect(m.startSpan).toHaveBeenCalledWith("OPENAI_API_CALL");
      expect(m.spans[0].ended).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // responses.create
  // -----------------------------------------------------------------------
  describe("responses.create", () => {
    test("non-streaming: span lifecycle", async () => {
      const response = {
        id: "resp-1",
        model: "gpt-4o",
        output: [{ type: "message", content: [{ text: "Hi" }] }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
          input_tokens_details: { cached_tokens: 0 },
        },
      };
      const client = fakeClient({ responsesCreate: async () => response });
      wrapOpenAI(client);

      const result = await responsesCreate(client, {
        model: "gpt-4o",
        input: "Hi",
      });

      expect(result).toBe(response);
      expect(m.startSpan).toHaveBeenCalledWith("OPENAI_API_CALL");
      expect(m.spans[0].ended).toBe(true);
    });

    test("streaming: accumulates text deltas, ends span", async () => {
      const chunks = [
        { type: "response.output_text.delta", delta: "Hel" },
        { type: "response.output_text.delta", delta: "lo" },
        {
          type: "response.completed",
          response: {
            model: "gpt-4o",
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
              input_tokens_details: { cached_tokens: 0 },
            },
          },
        },
      ];
      const client = fakeClient({
        responsesCreate: async () => fakeStream(chunks),
      });
      wrapOpenAI(client);

      const result = await responsesCreate(client, {
        model: "gpt-4o",
        input: "Hi",
        stream: true,
      });

      for await (const _chunk of result as AsyncIterable<unknown>) {
        // consume
      }

      expect(m.setOutput).toHaveBeenCalled();
      expect(m.spans[0].ended).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // images.generate
  // -----------------------------------------------------------------------
  describe("images.generate", () => {
    test("non-streaming: span lifecycle", async () => {
      const response = {
        data: [{ url: "https://example.com/image.png" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      const client = fakeClient({ imagesGenerate: async () => response });
      wrapOpenAI(client);

      const result = await imagesGenerate(client, {
        model: "dall-e-3",
        prompt: "A cat",
      });

      expect(result).toBe(response);
      expect(m.startSpan).toHaveBeenCalledWith("OPENAI_API_CALL");
      expect(m.spans[0].ended).toBe(true);
    });
  });
});
