import { type Baggage, type BaggageEntryMetadata } from "@opentelemetry/api";
/**
 * Serialize an array of key=value pairs into a baggage header string,
 * capping the result at {@link BAGGAGE_MAX_TOTAL_LENGTH}.
 */
export declare function serializeKeyPairs(keyPairs: string[]): string;
/**
 * Convert a {@link Baggage} into an array of `key=value;metadata` strings,
 * URI-encoding each key and value.
 */
export declare function getKeyPairs(baggage: Baggage): string[];
/** Parse a single `key=value;metadata` baggage list-member. */
export declare function parsePairKeyValue(entry: string): {
    key: string;
    value: string;
    metadata?: BaggageEntryMetadata;
} | undefined;
//# sourceMappingURL=utils.d.ts.map