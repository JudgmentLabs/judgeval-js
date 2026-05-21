import {
  type Baggage,
  type BaggageEntryMetadata,
  baggageEntryMetadataFromString,
} from "@opentelemetry/api";
import {
  BAGGAGE_ITEMS_SEPARATOR,
  BAGGAGE_KEY_PAIR_SEPARATOR,
  BAGGAGE_MAX_TOTAL_LENGTH,
  BAGGAGE_PROPERTIES_SEPARATOR,
} from "./constants";

/**
 * Serialize an array of key=value pairs into a baggage header string,
 * capping the result at {@link BAGGAGE_MAX_TOTAL_LENGTH}.
 */
export function serializeKeyPairs(keyPairs: string[]): string {
  return keyPairs.reduce((hValue, current) => {
    const value = `${hValue}${hValue !== "" ? BAGGAGE_ITEMS_SEPARATOR : ""}${current}`;
    return value.length > BAGGAGE_MAX_TOTAL_LENGTH ? hValue : value;
  }, "");
}

/**
 * Convert a {@link Baggage} into an array of `key=value;metadata` strings,
 * URI-encoding each key and value.
 */
export function getKeyPairs(baggage: Baggage): string[] {
  return baggage.getAllEntries().map(([key, value]) => {
    let entry = `${encodeURIComponent(key)}=${encodeURIComponent(value.value)}`;
    if (value.metadata !== undefined) {
      entry += BAGGAGE_PROPERTIES_SEPARATOR + value.metadata.toString();
    }
    return entry;
  });
}

/** Parse a single `key=value;metadata` baggage list-member. */
export function parsePairKeyValue(
  entry: string,
): { key: string; value: string; metadata?: BaggageEntryMetadata } | undefined {
  const valueProps = entry.split(BAGGAGE_PROPERTIES_SEPARATOR);
  if (valueProps.length <= 0) return;
  const keyPairPart = valueProps.shift();
  if (!keyPairPart) return;
  const separatorIndex = keyPairPart.indexOf(BAGGAGE_KEY_PAIR_SEPARATOR);
  if (separatorIndex <= 0) return;
  const key = decodeURIComponent(
    keyPairPart.substring(0, separatorIndex).trim(),
  );
  const value = decodeURIComponent(
    keyPairPart.substring(separatorIndex + 1).trim(),
  );
  let metadata: BaggageEntryMetadata | undefined;
  if (valueProps.length > 0) {
    metadata = baggageEntryMetadataFromString(
      valueProps.join(BAGGAGE_PROPERTIES_SEPARATOR),
    );
  }
  return { key, value, metadata };
}
