import {
  type Baggage,
  type Context,
  createContextKey,
  propagation,
} from "@opentelemetry/api";
import { getTraceRuntime } from "../runtime";

/**
 * Judgment baggage store. Baggage is a set of key-value pairs attached
 * to a {@link Context} and automatically propagated to child spans and
 * to downstream services through the `baggage` HTTP header.
 */

/** Create a new {@link Baggage}, optionally pre-populated with entries. */
export const createBaggage = propagation.createBaggage.bind(propagation);

const BAGGAGE_KEY = createContextKey("baggage");

/** Retrieve the baggage attached to the given context. */
export function getBaggage(context: Context): Baggage | undefined {
  return context.getValue(BAGGAGE_KEY) as Baggage | undefined;
}

/** Retrieve the baggage attached to the active context. */
export function getActiveBaggage(): Baggage | undefined {
  return getBaggage(getTraceRuntime().getCurrentContext());
}

/** Attach a baggage to the given context, returning a new context. */
export function setBaggage(context: Context, baggage: Baggage): Context {
  return context.setValue(BAGGAGE_KEY, baggage);
}

/** Remove the baggage attached to the given context, returning a new context. */
export function deleteBaggage(context: Context): Context {
  return context.deleteValue(BAGGAGE_KEY);
}

export { baggageEntryMetadataFromString } from "@opentelemetry/api";
export type {
  Baggage,
  BaggageEntry,
  BaggageEntryMetadata,
} from "@opentelemetry/api";

export { JudgmentBaggagePropagator } from "./JudgmentBaggagePropagator";
