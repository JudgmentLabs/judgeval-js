import { type Baggage, type Context } from "@opentelemetry/api";
/**
 * Judgment baggage store. Baggage is a set of key-value pairs attached
 * to a {@link Context} and automatically propagated to child spans and
 * to downstream services through the `baggage` HTTP header.
 */
/** Create a new {@link Baggage}, optionally pre-populated with entries. */
export declare const createBaggage: typeof import("@opentelemetry/api/build/src/baggage/utils").createBaggage;
/** Retrieve the baggage attached to the given context. */
export declare function getBaggage(context: Context): Baggage | undefined;
/** Retrieve the baggage attached to the active context. */
export declare function getActiveBaggage(): Baggage | undefined;
/** Attach a baggage to the given context, returning a new context. */
export declare function setBaggage(context: Context, baggage: Baggage): Context;
/** Remove the baggage attached to the given context, returning a new context. */
export declare function deleteBaggage(context: Context): Context;
export { baggageEntryMetadataFromString } from "@opentelemetry/api";
export type { Baggage, BaggageEntry, BaggageEntryMetadata, } from "@opentelemetry/api";
export { JudgmentBaggagePropagator } from "./JudgmentBaggagePropagator";
//# sourceMappingURL=index.d.ts.map