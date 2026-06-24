import { type Context, type TextMapGetter, type TextMapPropagator, type TextMapSetter } from "@opentelemetry/api";
/**
 * Propagates {@link Baggage} through the W3C `baggage` header.
 *
 * Implements the W3C Baggage specification: https://w3c.github.io/baggage/
 */
export declare class JudgmentBaggagePropagator implements TextMapPropagator {
    inject(context: Context, carrier: unknown, setter: TextMapSetter): void;
    extract(context: Context, carrier: unknown, getter: TextMapGetter): Context;
    fields(): string[];
}
//# sourceMappingURL=JudgmentBaggagePropagator.d.ts.map