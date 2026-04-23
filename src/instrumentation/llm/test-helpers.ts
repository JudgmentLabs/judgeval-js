import { type Mock, afterEach, beforeEach, mock } from "bun:test";
import type { Span, SpanContext } from "@opentelemetry/api";
import { BaseTracer } from "../../trace/BaseTracer";

// ---------------------------------------------------------------------------
// Fake span that satisfies the OTel Span interface
// ---------------------------------------------------------------------------
export interface FakeSpan extends Span {
  ended: boolean;
  attrs: Record<string, unknown>;
}

export function fakeSpan(): FakeSpan {
  const span: FakeSpan = {
    ended: false,
    attrs: {},
    isRecording: () => true,
    setAttribute(k: string, v: unknown) {
      span.attrs[k] = v;
      return span;
    },
    setAttributes() {
      return span;
    },
    setStatus() {
      return span;
    },
    recordException() {},
    end() {
      span.ended = true;
    },
    spanContext(): SpanContext {
      return {
        traceId: "0".repeat(32),
        spanId: "0".repeat(16),
        traceFlags: 1,
      };
    },
    updateName() {
      return span;
    },
    addEvent() {
      return span;
    },
    addLink() {
      return span;
    },
    addLinks() {
      return span;
    },
  };
  return span;
}

// ---------------------------------------------------------------------------
// BaseTracer mock — replaces static methods with bun mocks, restores after
// ---------------------------------------------------------------------------
export interface TracerMocks {
  spans: FakeSpan[];
  startSpan: Mock<(...args: unknown[]) => FakeSpan>;
  setSpanKind: Mock<(...args: unknown[]) => void>;
  recordLLMMetadata: Mock<(...args: unknown[]) => void>;
  setInput: Mock<(...args: unknown[]) => void>;
  setOutput: Mock<(...args: unknown[]) => void>;
  setError: Mock<(...args: unknown[]) => void>;
  setAttribute: Mock<(...args: unknown[]) => void>;
}

/**
 * Call inside a describe() block. Replaces BaseTracer static methods with
 * mocks in beforeEach and restores originals in afterEach. Returns a
 * stable reference object whose `.spans` and mock fields update each test.
 */
export function useTracerMocks(): TracerMocks {
  const originals = {
    startSpan: BaseTracer.startSpan,
    setSpanKind: BaseTracer.setSpanKind,
    recordLLMMetadata: BaseTracer.recordLLMMetadata,
    setInput: BaseTracer.setInput,
    setOutput: BaseTracer.setOutput,
    setError: BaseTracer.setError,
    setAttribute: BaseTracer.setAttribute,
  };

  const mocks: TracerMocks = {
    spans: [],
    startSpan: mock(() => fakeSpan()),
    setSpanKind: mock(),
    recordLLMMetadata: mock(),
    setInput: mock(),
    setOutput: mock(),
    setError: mock(),
    setAttribute: mock(),
  };

  beforeEach(() => {
    mocks.spans = [];
    mocks.startSpan = mock((..._args: unknown[]) => {
      const s = fakeSpan();
      mocks.spans.push(s);
      return s;
    });
    mocks.setSpanKind = mock();
    mocks.recordLLMMetadata = mock();
    mocks.setInput = mock();
    mocks.setOutput = mock();
    mocks.setError = mock();
    mocks.setAttribute = mock();

    BaseTracer.startSpan = mocks.startSpan as unknown as typeof BaseTracer.startSpan;
    BaseTracer.setSpanKind = mocks.setSpanKind as unknown as typeof BaseTracer.setSpanKind;
    BaseTracer.recordLLMMetadata = mocks.recordLLMMetadata as unknown as typeof BaseTracer.recordLLMMetadata;
    BaseTracer.setInput = mocks.setInput as unknown as typeof BaseTracer.setInput;
    BaseTracer.setOutput = mocks.setOutput as unknown as typeof BaseTracer.setOutput;
    BaseTracer.setError = mocks.setError as unknown as typeof BaseTracer.setError;
    BaseTracer.setAttribute = mocks.setAttribute as unknown as typeof BaseTracer.setAttribute;
  });

  afterEach(() => {
    BaseTracer.startSpan = originals.startSpan;
    BaseTracer.setSpanKind = originals.setSpanKind;
    BaseTracer.recordLLMMetadata = originals.recordLLMMetadata;
    BaseTracer.setInput = originals.setInput;
    BaseTracer.setOutput = originals.setOutput;
    BaseTracer.setError = originals.setError;
    BaseTracer.setAttribute = originals.setAttribute;
  });

  return mocks;
}

// ---------------------------------------------------------------------------
// Fake async iterable (simulates an SDK Stream)
// ---------------------------------------------------------------------------
export function fakeStream<T>(
  items: T[],
): AsyncIterable<T> & { controller: AbortController } {
  return {
    controller: new AbortController(),
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}
