import {
  type Context,
  defaultTextMapGetter,
  defaultTextMapSetter,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { dontThrow } from "../../utils/dont-throw";
import { JudgmentBaggagePropagator } from "../baggage/JudgmentBaggagePropagator";
import { getTraceRuntime } from "../runtime";

/**
 * Inject and extract trace context and baggage across service
 * boundaries through a composite W3C TraceContext + Baggage propagator.
 */

let _globalTextmap: TextMapPropagator = new CompositePropagator({
  propagators: [
    new W3CTraceContextPropagator(),
    new JudgmentBaggagePropagator(),
  ],
});

/** Return the active composite propagator (W3C TraceContext + Judgment Baggage). */
export function getGlobalTextmap(): TextMapPropagator {
  return _globalTextmap;
}

/** Replace the global text-map propagator. */
export function setGlobalTextmap(propagator: TextMapPropagator): void {
  _globalTextmap = propagator;
}

function _resolveContext(context?: Context): Context {
  if (context !== undefined) return context;
  return getTraceRuntime().getCurrentContext();
}

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
export function inject<Carrier>(
  carrier: Carrier,
  context?: Context,
  setter: TextMapSetter<Carrier> = defaultTextMapSetter as TextMapSetter<Carrier>,
): void {
  dontThrow("propagation.inject", () => {
    getGlobalTextmap().inject(_resolveContext(context), carrier, setter);
  });
}

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
export function extract<Carrier>(
  carrier: Carrier,
  context?: Context,
  getter: TextMapGetter<Carrier> = defaultTextMapGetter as TextMapGetter<Carrier>,
): Context {
  const base = _resolveContext(context);
  return dontThrow<Context>(
    "propagation.extract",
    () => getGlobalTextmap().extract(base, carrier, getter),
    base,
  );
}
