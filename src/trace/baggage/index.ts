import { type Baggage, type Context, propagation } from "@opentelemetry/api";
import { JudgmentTracerProvider } from "../JudgmentTracerProvider";

/**
 * Thin wrappers around the OpenTelemetry baggage API that resolve to the
 * active {@link JudgmentTracerProvider} context when no context is passed.
 *
 * Mirrors the surface of Python's `judgeval.trace.baggage` module.
 */

function resolveContext(context?: Context): Context {
  if (context !== undefined) return context;
  return JudgmentTracerProvider.getInstance().getCurrentContext();
}

function getBaggageFrom(context: Context): Baggage {
  return propagation.getBaggage(context) ?? propagation.createBaggage();
}

/**
 * Return all baggage entries as a read-only record.
 *
 * @param context - OTel context to read from. Defaults to the current
 *   Judgment context.
 */
export function getAll(context?: Context): Readonly<Record<string, string>> {
  const baggage = propagation.getBaggage(resolveContext(context));
  if (!baggage) return Object.freeze({});
  const out: Record<string, string> = {};
  for (const [key, entry] of baggage.getAllEntries()) {
    out[key] = entry.value;
  }
  return Object.freeze(out);
}

/**
 * Retrieve a single baggage value by key.
 *
 * @param name - The baggage key to look up.
 * @param context - OTel context to read from. Defaults to the current
 *   Judgment context.
 * @returns The baggage value, or `undefined` if the key is not set.
 */
export function getBaggage(
  name: string,
  context?: Context,
): string | undefined {
  const baggage = propagation.getBaggage(resolveContext(context));
  return baggage?.getEntry(name)?.value;
}

/**
 * Set a baggage key-value pair, returning a new context with the entry.
 *
 * @param name - The baggage key.
 * @param value - The baggage value.
 * @param context - Base context. Defaults to the current Judgment context.
 * @returns A new {@link Context} containing the updated baggage.
 */
export function setBaggage(
  name: string,
  value: string,
  context?: Context,
): Context {
  const ctx = resolveContext(context);
  const baggage = getBaggageFrom(ctx).setEntry(name, { value });
  return propagation.setBaggage(ctx, baggage);
}

/**
 * Remove a baggage entry by key, returning a new context without it.
 *
 * @param name - The baggage key to remove.
 * @param context - Base context. Defaults to the current Judgment context.
 * @returns A new {@link Context} with the entry removed.
 */
export function removeBaggage(name: string, context?: Context): Context {
  const ctx = resolveContext(context);
  const baggage = getBaggageFrom(ctx).removeEntry(name);
  return propagation.setBaggage(ctx, baggage);
}

/**
 * Remove all baggage entries, returning a clean context.
 *
 * @param context - Base context. Defaults to the current Judgment context.
 * @returns A new {@link Context} with an empty baggage map.
 */
export function clear(context?: Context): Context {
  return propagation.setBaggage(
    resolveContext(context),
    propagation.createBaggage(),
  );
}
