export type Serializer = (obj: unknown) => string;
export declare function safeStringify(obj: unknown): string;
/**
 * Serializes an attribute to an "Attribute" compatible value. Primitives are returned as is, objects are serialized using the provided serializer.
 *
 * @param value - The value to serialize.
 * @param serializer - The serializer to use.
 * @returns A string, number, or boolean value.
 */
export declare function serializeAttribute(value: unknown, serializer: Serializer): string | number | boolean;
//# sourceMappingURL=serializer.d.ts.map