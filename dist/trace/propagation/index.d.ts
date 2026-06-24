import { type Context, type TextMapGetter, type TextMapPropagator, type TextMapSetter } from "@opentelemetry/api";
/** Return the active composite propagator (W3C TraceContext + Judgment Baggage). */
export declare function getGlobalTextmap(): TextMapPropagator;
/** Replace the global text-map propagator. */
export declare function setGlobalTextmap(propagator: TextMapPropagator): void;
/**
 * Inject trace context and baggage into an outgoing carrier (e.g. HTTP
 * headers).
 *
 * Call this before making an outbound HTTP request to propagate the
 * current trace across service boundaries.
 *
 * @param carrier - A mutable object to write propagation headers into.
 * @param context - The context to inject. Defaults to the current
 *   Judgment context.
 * @param setter - Strategy for writing values into the carrier.
 *
 * @example
 * ```typescript
 * const headers: Record<string, string> = {};
 * propagation.inject(headers);
 * await fetch("https://api.example.com", { headers });
 * ```
 */
export declare function inject<Carrier>(carrier: Carrier, context?: Context, setter?: TextMapSetter<Carrier>): void;
/**
 * Extract trace context and baggage from an incoming carrier.
 *
 * Low-level primitive — most callers should use
 * {@link Tracer.continueTrace} instead, which extracts and installs the
 * context in one step.
 *
 * @param carrier - A mapping containing propagation headers (e.g.
 *   `request.headers`).
 * @param context - Base context to merge into. Defaults to the current
 *   active context.
 * @param getter - Strategy for reading values from the carrier.
 * @returns A new {@link Context} with the extracted trace and baggage
 *   data.
 */
export declare function extract<Carrier>(carrier: Carrier, context?: Context, getter?: TextMapGetter<Carrier>): Context;
//# sourceMappingURL=index.d.ts.map