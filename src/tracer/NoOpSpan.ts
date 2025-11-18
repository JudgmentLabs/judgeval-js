import {
  INVALID_SPAN_CONTEXT,
  type Attributes,
  type AttributeValue,
  type Exception,
  type Link,
  type Span,
  type SpanContext,
  type SpanStatus,
  type TimeInput,
} from "@opentelemetry/api";

export class NoOpSpan implements Span {
  setAttribute(_key: string, _value: AttributeValue): this {
    return this;
  }

  setAttributes(_attributes: Attributes): this {
    return this;
  }

  addEvent(
    _name: string,
    _attributesOrStartTime?: Attributes | TimeInput,
    _startTime?: TimeInput,
  ): this {
    return this;
  }

  addLink(_link: Link): this {
    return this;
  }

  addLinks(_links: Link[]): this {
    return this;
  }

  setStatus(_status: SpanStatus): this {
    return this;
  }

  updateName(_name: string): this {
    return this;
  }

  end(_endTime?: TimeInput): void {
    return;
  }

  isRecording(): boolean {
    return false;
  }

  recordException(_exception: Exception, _time?: TimeInput): void {
    return;
  }

  spanContext(): SpanContext {
    return INVALID_SPAN_CONTEXT;
  }
}
